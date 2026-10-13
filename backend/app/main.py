"""API + SSE + web/dist 정적 서빙 + /media. 처리는 백그라운드 스레드 1개 큐."""
import asyncio, atexit, hashlib, json, os, queue, re, shutil, threading, time, traceback
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import article, db, export, files, scenes, transcript

try:
    from app import ai
except Exception as e:  # AI 담당 파일이 없거나 깨져도 파이프라인은 끝까지
    print(f"[ai] 불러오기 실패, 요약 건너뜀: {e}")
    ai = None

from app.paths import DATA, ROOT
DIST = ROOT / "web" / "dist"
MEDIA, WORK, UP = DATA / "media", DATA / "work", DATA / "uploads"
MEDIA.mkdir(parents=True, exist_ok=True)
db.init()

app = FastAPI()


def code_stamp():
    """코드·화면 파일의 가장 최근 수정 시각. 앱이 옛 코드로 떠 있는 서버를 알아보는 데 씀(app.pyw와 같은 계산)"""
    fs = [*(ROOT / "backend" / "app").glob("*.py"), ROOT / "web" / "dist" / "index.html"]
    return max((f.stat().st_mtime for f in fs if f.exists()), default=0)


STAMP = code_stamp()


@app.get("/api/version")
def version():
    return {"stamp": STAMP}


@app.post("/api/shutdown")
def shutdown():  # 옛 코드 서버를 새 앱이 끌 때만 씀(127.0.0.1 전용 서버)
    threading.Timer(0.3, os._exit, [0]).start()
    return {"ok": True}
try:
    from app import chat
    app.include_router(chat.router)
except Exception as e:  # 채팅이 깨져도 나머지는 동작
    print(f"[chat] 불러오기 실패: {e}")
try:  # 통합 요약·하이라이트(4차)
    from app import combine, highlights
    app.include_router(combine.router)
    app.include_router(highlights.router)
except Exception as e:
    print(f"[combine/highlights] 불러오기 실패: {e}")
try:  # 브라우저 확장: chrome-extension:// 출처만 허용(127.0.0.1 서버라 외부 노출 없음) + 구간 스크랩
    from fastapi.middleware.cors import CORSMiddleware
    from app import clips
    app.add_middleware(CORSMiddleware, allow_origin_regex=r"chrome-extension://[a-p]{32}", allow_methods=["*"], allow_headers=["*"])
    app.include_router(clips.router)
except Exception as e:
    print(f"[clips] 불러오기 실패: {e}")
EVENTS: dict[str, list] = {}  # 노트별 SSE 이벤트 기록(메모리)
Q: queue.Queue = queue.Queue()


def emit(nid, step, status="start", message=""):
    ev = {"step": step, "status": status, "message": message}
    print(f"[{nid}] {ev}")
    EVENTS.setdefault(nid, []).append(ev)


def process(nid):
    n, work, t0 = db.get(nid), WORK / nid, time.time()
    try:
        db.update(nid, step="transcript")  # 대기(queued) → 처리 시작
        emit(nid, "transcript")
        t = time.time()
        kind = n.get("kind")  # video | article | pdf | audio | localvideo (내 파일은 url = 저장된 파일 경로)
        if kind == "article": meta = article.fetch(n["url"], MEDIA / nid)  # 웹 글: 본문 추출 + 본문 이미지
        elif kind == "pdf": meta = files.pdf(n["url"])
        elif kind in ("audio", "localvideo"): meta = files.media(n["url"])
        else: meta = transcript.fetch(n["url"], work, force_asr=os.environ.get("VN_FORCE_ASR") == "1")
        meta = {k: v for k, v in meta.items() if v is not None}  # 제목 없으면 업로드한 파일 이름 유지
        db.update(nid, **meta, step="summary")
        n.update(meta)
        emit(nid, "transcript", "done", f"{meta['source']} {len(meta['transcript'])}문단 {time.time() - t:.1f}초")

        note = {**n, "media_dir": str(MEDIA / nid)}
        if kind == "pdf": note["kind"] = "article"  # ai는 문단 번호 기준 프롬프트를 씀(DB의 kind는 그대로)
        if ai:
            emit(nid, "summary")
            t, msg = time.time(), ""
            try:
                note["report"] = ai.summarize(note)
            except Exception as e:
                note["report"], msg = None, f"요약 실패: {e}"
            db.update(nid, report=note["report"])
            emit(nid, "summary", "done", msg or f"{time.time() - t:.1f}초")
            if not note["report"]:  # 요약 없이 "완료"로 두면 화면이 진행 중에서 멈춤 → 오류로 끝냄
                raise RuntimeError(msg or "요약을 만들지 못했어요")

        db.update(nid, step="scenes")
        emit(nid, "scenes")
        t, msg = time.time(), ""
        if kind == "article": note["scenes"] = n["images"]
        elif kind in ("pdf", "audio"): note["scenes"] = []  # 장면 없음
        else: note["scenes"] = scenes.extract(n["url"], MEDIA / nid, work, n.get("duration"))  # 내 영상은 파일 경로 그대로
        db.update(nid, scenes=note["scenes"])
        if ai and note.get("report") and note["scenes"]:
            try:
                db.update(nid, report=ai.pick_scenes(note))
            except Exception as e:
                msg = f"장면 고르기 실패: {e} · "
        emit(nid, "scenes", "done", f"{msg}{len(note['scenes'])}장 {time.time() - t:.1f}초")

        db.update(nid, status="done", step="done")
        emit(nid, "done", "done", f"총 {time.time() - t0:.1f}초")
    except Exception as e:
        traceback.print_exc()
        db.update(nid, status="error", error=str(e))
        emit(nid, "error", "done", str(e))
    finally:
        shutil.rmtree(work, ignore_errors=True)  # 받은 영상·오디오 찌꺼기 정리


def worker():
    while True:  # ponytail: 한 번에 1개만 처리(GPU·네트워크 단순화). 동시 처리가 필요하면 스레드 수 늘리기
        process(Q.get())


threading.Thread(target=worker, daemon=True).start()


# ---- 서버 잠금: 처리 중 노트를 다시 큐에 넣는 건 잠금을 쥔 서버 하나만 ----
def _alive(pid):
    if os.name != "nt":
        try: os.kill(pid, 0); return True
        except OSError: return False
    import ctypes
    k = ctypes.windll.kernel32
    h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h: return False
    code = ctypes.c_ulong(); k.GetExitCodeProcess(h, ctypes.byref(code)); k.CloseHandle(h)
    return code.value == 259  # STILL_ACTIVE


def _take_lock():
    lock = DATA / "server.lock"
    try: old = int(lock.read_text())
    except (OSError, ValueError): old = 0
    if old and old != os.getpid() and _alive(old):  # ponytail: PID 재사용이면 잘못 막힘 → 잠금 파일 지우면 됨
        print(f"[경고] 서버(PID {old})가 이미 떠 있어요. 이 서버는 처리 중이던 노트를 이어받지 않아요(새로 넣은 노트만 처리).")
        return False
    lock.write_text(str(os.getpid()))
    atexit.register(lambda: lock.read_text() == str(os.getpid()) and lock.unlink(missing_ok=True))
    return True


if _take_lock():  # 꺼지기 전 처리 중이던 노트는 error로 두지 않고 이어서 처리
    for _id in db.processing_ids():
        print(f"[재개] {_id}")
        db.update(_id, step="queued"); Q.put(_id)


class NewNote(BaseModel):
    url: str


@app.post("/api/notes")
def create(body: NewNote):
    m = re.search(r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/|embed/)|youtu\.be/)([\w-]{11})", body.url)
    if m:
        return {"id": _enqueue(m.group(1))}
    u = body.url.strip()
    if not re.match(r"https?://[^\s/]+\.[^\s/]+", u):
        raise HTTPException(400, "http(s)로 시작하는 링크를 넣어 주세요")
    return {"id": _enqueue_article(u)}


@app.post("/api/upload")
def upload(file: UploadFile):
    name = Path(file.filename or "").name
    kind = files.kind_of(name)
    if not kind:
        raise HTTPException(400, "PDF, 음성(mp3·m4a·wav), 영상(mp4·mkv·mov) 파일만 올릴 수 있어요")
    nid = f"u{hashlib.md5(name.encode()).hexdigest()[:8]}-{int(time.time() * 1000)}"
    dest = UP / nid / ("source" + Path(name).suffix.lower())
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    db.insert({"id": nid, "url": str(dest), "kind": kind, "title": Path(name).stem, "channel": "내 파일", "created_at": _now(),
               "status": "processing", "step": "queued"})
    Q.put(nid)
    return {"id": nid}


@app.get("/media/{nid}/source.{ext}")
def source(nid: str, ext: str):  # 내 영상·음성 재생용 원본(Range 지원)
    f = UP / nid / f"source.{ext}"
    if not re.fullmatch(r"[\w-]+", nid) or not f.is_file():
        raise HTTPException(404, "파일이 없어요")
    return FileResponse(f)


def _now(): return datetime.now().isoformat(timespec="seconds")


def _enqueue(vid, collection_id=None, title=None):
    nid = f"{vid}-{int(time.time())}"
    # 제목·썸네일은 처리 전에도 보이게 미리 채움(대본 단계에서 실제 값으로 덮어씀)
    db.insert({"id": nid, "url": f"https://www.youtube.com/watch?v={vid}", "video_id": vid, "created_at": _now(), "title": title,
               "thumbnail": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
               "status": "processing", "step": "queued", "collection_id": collection_id})
    Q.put(nid)
    return nid


def _enqueue_article(url):
    nid = article.new_id(url)
    db.insert({"id": nid, "url": url, "kind": "article", "title": urlparse(url).hostname, "created_at": _now(), "status": "processing", "step": "queued"})
    Q.put(nid)
    return nid


@app.get("/api/notes")
def list_notes():
    return db.list_all()


# ---- 재생목록·채널 ----
class Url(BaseModel):
    url: str


@app.post("/api/playlist/preview")
def playlist_preview(body: Url):
    try:
        return transcript.playlist(body.url)
    except Exception as e:
        why = "비공개이거나 삭제된 재생목록이에요. 공개 재생목록 링크나 영상 링크를 넣어 주세요" if "does not exist" in str(e) or "private" in str(e).lower() else str(e)
        raise HTTPException(400, f"재생목록을 불러오지 못했어요: {why}")


class Video(BaseModel):
    id: str
    title: str | None = None


class NewPlaylist(BaseModel):
    title: str
    videos: list[Video]


@app.post("/api/playlist")
def playlist_create(body: NewPlaylist):
    vs = list({v.id: v for v in body.videos if re.fullmatch(r"[\w-]{11}", v.id)}.values())[:10]  # 중복 제거, 최대 10개
    if not vs:
        raise HTTPException(400, "영상이 없어요")
    cid = db.add_collection(body.title.strip() or "재생목록", _now())
    for v in vs:  # 재생목록 순서대로 큐에 넣음(영상 id가 달라 노트 id도 겹치지 않음)
        _enqueue(v.id, cid, v.title)
    return {"collection_id": cid}


# ---- 컬렉션 ----
class NewCollection(BaseModel):
    name: str


@app.get("/api/collections")
def list_collections():
    return db.collections()


@app.post("/api/collections")
def create_collection(body: NewCollection):
    if not body.name.strip():
        raise HTTPException(400, "이름을 입력하세요")
    return {"id": db.add_collection(body.name.strip(), _now())}


@app.get("/api/collections/{cid}")
def get_collection(cid: int):
    c = db.get_collection(cid) or _404()
    return {**c, "notes": db.list_all(cid)}


class Move(BaseModel):
    collection_id: int | None


@app.put("/api/notes/{nid}/collection")
def move_note(nid: str, body: Move):
    db.get(nid) or _404()
    if body.collection_id is not None and not db.get_collection(body.collection_id):
        raise HTTPException(400, "컬렉션이 없어요")
    db.update(nid, collection_id=body.collection_id)
    return {"ok": True}


@app.get("/api/search")
def search(q: str = ""):
    return db.search(q)


# ---- 내보내기 ----
@app.get("/api/notes/{nid}/export")
def export_note(nid: str, fmt: str = "md"):
    n = db.get(nid) or _404()
    if not n.get("report"):
        raise HTTPException(400, "리포트가 아직 없어요")
    name = re.sub(r'[\\/:*?"<>|\s]+', "_", (n["report"].get("title") or n.get("title") or nid))[:60]
    if fmt == "md":
        body, mt = export.to_md(n).encode(), "text/markdown; charset=utf-8"
    elif fmt in ("html", "pdf"):
        h = export.to_html(n, MEDIA / nid)
        body, mt = (h.encode(), "text/html; charset=utf-8") if fmt == "html" else (export.to_pdf(h), "application/pdf")
    else:
        raise HTTPException(400, "형식은 md·html·pdf")
    from urllib.parse import quote
    return Response(body, media_type=mt, headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}.{fmt}"})


@app.get("/api/notes/{nid}")
def get_note(nid: str):
    return db.get(nid) or _404()


@app.get("/api/notes/{nid}/events")
async def events(nid: str):
    n = db.get(nid) or _404()

    async def gen():
        if nid not in EVENTS and n["status"] != "processing":  # 서버 재시작 뒤 끝난 노트: 결과만 한 번
            ev = {"step": "done" if n["status"] == "done" else "error", "status": "done", "message": n["error"] or ""}
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            return
        i = 0
        while True:  # ponytail: 0.5초 폴링. 노트 수가 많아지면 asyncio.Queue로 바꾸기
            evs = EVENTS.get(nid, [])
            for ev in evs[i:]:
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                if ev["step"] in ("done", "error"):
                    return
            i = len(evs)
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ---- 마인드맵 v2: data/media/<id>/mindmap_<short|normal|detailed>.md ----
@app.post("/api/notes/{nid}/mindmap")
def make_mindmap(nid: str, level: str = "normal"):
    """글자 조각을 스트리밍하고, 끝에 NUL(\x00) + 정리된 마크다운(또는 \x00ERR:사유)을 붙인다."""
    from app import mindmap
    n = db.get(nid) or _404()
    if not n.get("report"): raise HTTPException(400, "리포트가 아직 없어요")
    if level not in mindmap.LEVELS: raise HTTPException(400, "상세도는 short/normal/detailed")

    def gen():
        try:
            g = mindmap.stream(n, level)
            while True:
                try: yield next(g)
                except StopIteration as e: md = e.value; break
            mindmap.path(MEDIA, nid, level).write_text(md, encoding="utf-8")
            yield "\x00" + md
        except Exception as e:
            yield f"\x00ERR:마인드맵 생성 실패: {e}"
    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-cache"})


@app.delete("/api/notes/{nid}/mindmap")
def del_mindmap(nid: str, level: str = "normal"):
    from app import mindmap
    db.get(nid) or _404()
    if level in mindmap.LEVELS: mindmap.path(MEDIA, nid, level).unlink(missing_ok=True)
    return {"ok": True}


@app.get("/api/notes/{nid}/mindmap")
def get_mindmap(nid: str, level: str = "normal"):
    from app import mindmap
    db.get(nid) or _404()
    f = mindmap.path(MEDIA, nid, level) if level in mindmap.LEVELS else _404()
    return {"markdown": f.read_text(encoding="utf-8") if f.exists() else None}


# ---- 번역 대본 (B4): data/media/<id>/transcript_ko.json ----
def _tstate(nid):
    """번역 상태: 저장본이 있으면 완료, 아니면 진행 중 작업의 부분 결과."""
    from app import translate
    f = translate.path(MEDIA, nid)
    if f.exists(): return {"texts": json.loads(f.read_text(encoding="utf-8")), "partial": None, "done": 1, "total": 1, "busy": False, "err": None}
    j = translate.JOBS.get(nid)
    if not j: return {"texts": None, "partial": None, "done": 0, "total": 0, "busy": False, "err": None}
    return {"texts": None, "partial": j["texts"], "done": j["done"], "total": j["total"], "busy": not j["finished"], "err": j["err"]}


@app.get("/api/notes/{nid}/translate")
def get_translation(nid: str):
    db.get(nid) or _404()
    return _tstate(nid)


@app.post("/api/notes/{nid}/translate")
def make_translation(nid: str):
    from app import translate
    n = db.get(nid) or _404()
    if not n["transcript"]:
        raise HTTPException(400, "대본이 아직 없어요")
    if not translate.path(MEDIA, nid).exists():
        translate.start(MEDIA, nid, n["transcript"])  # 백그라운드 시작, 진행은 GET으로 확인
    return _tstate(nid)


# ---- 삭제·컬렉션 관리 ----
@app.delete("/api/notes/{nid}")
def delete_note(nid: str, forever: bool = False):
    """기본은 휴지통으로(릴리스처럼). forever=1이면 영구 삭제(휴지통에서만)."""
    n = db.get(nid) or _404()
    if n["status"] == "processing":
        raise HTTPException(409, "처리 중인 노트는 지울 수 없어요")
    if not forever:
        db.trash(nid, _now()); return {"ok": True, "trash": True}
    if not n.get("deleted_at"):
        raise HTTPException(400, "휴지통에 있는 노트만 영구 삭제할 수 있어요")
    db.delete_note(nid)
    shutil.rmtree(MEDIA / nid, ignore_errors=True)
    shutil.rmtree(UP / nid, ignore_errors=True)  # 내 파일 노트: 올린 원본도 지움
    return {"ok": True}


@app.get("/api/trash")
def trash_list():
    return db.trashed()


@app.post("/api/notes/{nid}/restore")
def restore_note(nid: str):
    db.get(nid) or _404()
    db.trash(nid, None); return {"ok": True}


# ---- 구독(릴리스 「구독」): 채널을 등록하면 새 영상 목록만 보여 주고, 노트는 사용자가 누를 때 만든다(AI 사용량을 사용자가 정함) ----
SUBS = DATA / "subs.json"
_subs_cache: dict = {}  # url → (시각, 새 영상 목록). ponytail: 메모리 30분 캐시, 앱 재시작 시 다시 받음


def _subs() -> list:
    try: return json.loads(SUBS.read_text(encoding="utf-8"))
    except Exception: return []


@app.get("/api/subs")
def subs_list():
    return _subs()


@app.post("/api/subs")
def subs_add(body: Url):
    url = body.url.strip()
    if not re.search(r"youtube\.com/(@[^/?#]+|channel/[^/?#]+|c/[^/?#]+)", url):
        raise HTTPException(400, "유튜브 채널 링크를 넣어 주세요(예: https://www.youtube.com/@채널이름)")
    url = url.split("?")[0].rstrip("/").removesuffix("/videos")
    subs = _subs()
    if any(x["url"] == url for x in subs): return subs
    try: info = transcript.playlist(url, 5)
    except Exception as e: raise HTTPException(400, f"채널을 불러오지 못했어요: {e}")
    subs.append({"url": url, "name": info["title"], "added_at": _now()})
    SUBS.write_text(json.dumps(subs, ensure_ascii=False, indent=1), encoding="utf-8")
    _subs_cache[url] = (time.time(), info["entries"])
    return subs


@app.delete("/api/subs")
def subs_del(url: str):
    SUBS.write_text(json.dumps([x for x in _subs() if x["url"] != url], ensure_ascii=False, indent=1), encoding="utf-8")
    _subs_cache.pop(url, None); return _subs()


@app.get("/api/subs/videos")
def subs_videos():
    """구독 채널마다 최신 5개 중 아직 노트가 없는 영상."""
    have = {n["id"][:11] for n in db.list_all()} | {n["id"][:11] for n in db.trashed()}
    out = []
    for x in _subs():
        t, es = _subs_cache.get(x["url"], (0, None))
        if es is None or time.time() - t > 1800:
            try: es = transcript.playlist(x["url"], 5)["entries"]; _subs_cache[x["url"]] = (time.time(), es)
            except Exception: es = es or []
        out += [{**e, "channel": x["name"]} for e in es if e["id"] not in have]
    return out


@app.put("/api/collections/{cid}")
def rename_collection(cid: int, body: NewCollection):
    db.get_collection(cid) or _404()
    if not body.name.strip():
        raise HTTPException(400, "이름을 입력하세요")
    db.rename_collection(cid, body.name.strip())
    return {"ok": True}


@app.delete("/api/collections/{cid}")
def delete_collection(cid: int):
    db.get_collection(cid) or _404()
    db.delete_collection(cid)
    return {"ok": True}


# ---- 길이·난이도 리포트 (short|long|easy): data/media/<id>/report_<style>.json ----
@app.get("/api/notes/{nid}/report")
def get_style_report(nid: str, style: str):
    db.get(nid) or _404()
    f = MEDIA / nid / f"report_{style}.json"
    return {"report": json.loads(f.read_text(encoding="utf-8")) if style in ("short", "long", "easy") and f.exists() else None}


@app.post("/api/notes/{nid}/report")
def make_style_report(nid: str, style: str):
    n = db.get(nid) or _404()
    if style not in ("short", "long", "easy") or not ai:
        raise HTTPException(400, "style은 short|long|easy")
    if not n.get("report"):
        raise HTTPException(400, "리포트가 아직 없어요")
    try:
        rep = ai.regroup_scenes(ai.summarize(n, style), n["report"])
    except Exception as e:
        raise HTTPException(502, f"리포트 생성 실패: {e}")
    (MEDIA / nid / f"report_{style}.json").write_text(json.dumps(rep, ensure_ascii=False), encoding="utf-8")
    return {"report": rep}


# ---- 용어 풀이 (C4): data/media/<id>/terms.json, 처음 열 때 한 번 생성 ----
@app.get("/api/notes/{nid}/terms")
def get_terms(nid: str):
    n = db.get(nid) or _404()
    f = MEDIA / nid / "terms.json"
    if not f.exists():
        if not n.get("report") or not ai:
            return {"terms": []}
        try:
            f.write_text(json.dumps(ai.terms(n), ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            raise HTTPException(502, f"용어 풀이 실패: {e}")
    return {"terms": json.loads(f.read_text(encoding="utf-8"))}


# ---- 확장 리포트 템플릿 (templates.py): 결과 data/media/<id>/ext_<key>.json, 나만의 템플릿 data/templates.json ----
class Tpl(BaseModel):
    name: str
    prompt: str


def _tpl_check(b: Tpl):
    if not b.name.strip() or not b.prompt.strip():
        raise HTTPException(400, "이름과 지시문을 모두 입력하세요")


@app.get("/api/templates")
def list_templates():
    from app import templates
    return templates.listing()


@app.post("/api/templates")
def add_template(body: Tpl):
    from app import templates
    _tpl_check(body)
    return templates.new_custom(body.name, body.prompt)


@app.put("/api/templates/{key}")
def edit_template(key: str, body: Tpl):
    from app import templates
    _tpl_check(body)
    items = templates.load_custom()
    it = next((x for x in items if x["key"] == key), None) or _404()
    it.update(name=body.name.strip(), prompt=body.prompt.strip())
    templates.save_custom(items)
    return it


@app.delete("/api/templates/{key}")
def del_template(key: str):
    from app import templates
    templates.save_custom([x for x in templates.load_custom() if x["key"] != key])
    return {"ok": True}


@app.get("/api/notes/{nid}/ext")
def get_exts(nid: str):
    """이 노트에 만들어 둔 확장 리포트 전부 {key: 결과}(만든 순서)."""
    db.get(nid) or _404()
    fs = sorted((MEDIA / nid).glob("ext_*.json"), key=lambda f: f.stat().st_mtime)
    return {f.stem[4:]: json.loads(f.read_text(encoding="utf-8")) for f in fs}


class ExtOpts(BaseModel):
    style: str | None = None   # 인포그래픽 스타일 키
    extra: str | None = None   # 「고급 설정 > 추가 프롬프트」


@app.post("/api/notes/{nid}/ext/{key}")
def make_ext(nid: str, key: str, body: ExtOpts | None = None):
    from app import cartoon, templates
    n = db.get(nid) or _404()
    if not n.get("report") or not ai or not templates.get(key) or templates.get(key)["kind"] in ("mindmap", "cartoon", "ppt"):
        raise HTTPException(400, "만들 수 없는 템플릿이거나 리포트가 아직 없어요")
    try:
        res = templates.generate(n, key, body.model_dump() if body else None)
    except Exception as e:
        raise HTTPException(502, f"확장 리포트 생성 실패: {e}")
    templates.path(MEDIA, nid, key).write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
    if key == "podcast": shutil.rmtree(MEDIA / nid / "podcast", ignore_errors=True)  # 문단이 바뀌었으니 예전 음성은 버림
    if any(b.get("illust") for b in res.get("blocks") or []):
        cartoon.illustrate(MEDIA, nid, key)  # 소제목 삽화는 뒤에서 한 장씩(그림 모델 없으면 건너뜀)
    return res


@app.get("/api/notes/{nid}/ext/{key}/illust")
def illust_state(nid: str, key: str):
    from app import cartoon
    db.get(nid) or _404()
    return {"job": cartoon.JOBS.get(f"{nid}:{key}")}


# ---- 리포트 아래 👍👎: data/media/<id>/feedback.json {키: 1|-1} (요약은 키 "report") ----
@app.get("/api/notes/{nid}/feedback")
def get_feedback(nid: str):
    db.get(nid) or _404()
    f = MEDIA / nid / "feedback.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


@app.put("/api/notes/{nid}/feedback/{key}")
def set_feedback(nid: str, key: str, v: int = 0):
    db.get(nid) or _404()
    f = MEDIA / nid / "feedback.json"
    d = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    if v in (1, -1): d[key] = v
    else: d.pop(key, None)
    f.write_text(json.dumps(d), encoding="utf-8")
    return d


@app.delete("/api/notes/{nid}/ext/{key}")
def del_ext(nid: str, key: str):
    from app import templates
    db.get(nid) or _404()
    if not re.fullmatch(r"[A-Za-z0-9_]{1,40}", key): raise HTTPException(400, "잘못된 리포트 키")  # ..\ 같은 경로로 폴더 밖을 지우지 못하게
    templates.path(MEDIA, nid, key).unlink(missing_ok=True)
    shutil.rmtree(MEDIA / nid / f"ext_{key}", ignore_errors=True)  # 소제목 삽화
    if key == "podcast": shutil.rmtree(MEDIA / nid / "podcast", ignore_errors=True)
    return {"ok": True}


# ---- 팟캐스트 음성 (podcast.py, Edge 온라인 음성): 시작 POST, 진행·준비된 문단 GET ----
@app.post("/api/notes/{nid}/podcast/audio")
def podcast_audio(nid: str):
    from app import podcast
    db.get(nid) or _404()
    if not (MEDIA / nid / "ext_podcast.json").exists(): raise HTTPException(404, "팟캐스트를 먼저 만들어 주세요")
    return podcast.start(MEDIA, nid)


@app.get("/api/notes/{nid}/podcast/audio")
def podcast_state(nid: str):
    from app import podcast
    db.get(nid) or _404()
    return podcast.state(MEDIA, nid)


# ---- 요약 화면 첫 소제목 도식(릴리스 요약의 그림 한 장): data/media/<id>/diagram.svg, 처음 볼 때 한 번 만듦 ----
@app.get("/api/notes/{nid}/diagram")
def get_diagram(nid: str):
    db.get(nid) or _404()
    f = MEDIA / nid / "diagram.svg"
    return {"svg": f.read_text(encoding="utf-8") if f.exists() else None}


@app.post("/api/notes/{nid}/diagram")
def make_diagram(nid: str):
    from app import templates
    n = db.get(nid) or _404()
    rep = n.get("report") or {}
    if not rep.get("sections") or not ai: raise HTTPException(400, "리포트가 아직 없어요")
    s = rep["sections"][0]
    body = f"주제: {rep.get('title')}\n소제목: {s['title']}\n" + "\n".join(f"- {c['title']}: " + " / ".join(b["text"] for b in c["bullets"]) for c in s["children"])
    prompt = ("아래 내용을 한눈에 보여 주는 도식(인포그래픽) SVG 하나를 그려라. <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 960 540\">, 흰 배경, "
              "맨 위 굵은 한국어 제목과 회색 부제, 단계·관계를 상자(rect rx)·아이콘 같은 단순 도형·화살표로 배치, 상자 안 글자는 한 줄 14자 이내 2줄까지, 색은 #6663fd·#dfff32·#222·#888 위주, 글꼴 sans-serif. "
              "<script>·이벤트 속성·외부 링크·이미지·foreignObject 금지. SVG만 출력(설명·코드펜스 금지).\n\n" + body)
    try: svg = templates.clean_svg(ai._claude(prompt, 180))
    except Exception as e: raise HTTPException(502, f"도식 생성 실패: {e}")
    if not svg: raise HTTPException(502, "도식 생성 실패: SVG가 없어요")
    (MEDIA / nid / "diagram.svg").write_text(svg, encoding="utf-8")
    return {"svg": svg}


# ---- PPT (ppt.py): 만들기·장별 수정본·PPTX 다운로드·레퍼런스 이미지(최대 4장) ----
class PptOpts(BaseModel):
    style: str = "minimal"
    count: int = 5
    extra: str = ""


class PptRevise(BaseModel):
    changes: dict[int, str]


@app.post("/api/notes/{nid}/ppt")
def make_ppt(nid: str, body: PptOpts):
    from app import ppt
    n = db.get(nid) or _404()
    if not n.get("report") or not ai: raise HTTPException(400, "리포트가 아직 없어요")
    try: deck = ppt.generate(MEDIA, n, body.style, body.count, body.extra)
    except Exception as e: raise HTTPException(502, f"PPT 생성 실패: {e}")
    ppt.path(MEDIA, nid).write_text(json.dumps(deck, ensure_ascii=False), encoding="utf-8")
    return deck


@app.post("/api/notes/{nid}/ppt/revise")
def revise_ppt(nid: str, body: PptRevise):
    from app import ppt
    n = db.get(nid) or _404()
    f = ppt.path(MEDIA, nid)
    if not f.exists(): raise HTTPException(404, "PPT가 아직 없어요")
    try: deck = ppt.revise(MEDIA, n, json.loads(f.read_text(encoding="utf-8")), body.changes)
    except Exception as e: raise HTTPException(502, f"수정본 생성 실패: {e}")
    f.write_text(json.dumps(deck, ensure_ascii=False), encoding="utf-8")
    return deck


@app.get("/api/notes/{nid}/ppt.pptx")
def ppt_file(nid: str):
    from app import ppt
    n = db.get(nid) or _404()
    f = ppt.path(MEDIA, nid)
    if not f.exists(): raise HTTPException(404, "PPT가 아직 없어요")
    refs = sorted(ppt.ref_dir(MEDIA, nid).glob("*")) if ppt.ref_dir(MEDIA, nid).exists() else []
    body = ppt.to_pptx(json.loads(f.read_text(encoding="utf-8")), refs[0] if refs else None)
    name = re.sub(r'[\\/:*?"<>|]', "", n.get("title") or "slides")[:60] or "slides"
    from urllib.parse import quote
    return Response(body, media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}.pptx"})


@app.get("/api/notes/{nid}/ppt/ref")
def list_ppt_refs(nid: str):
    from app import ppt
    db.get(nid) or _404()
    d = ppt.ref_dir(MEDIA, nid)
    return [f.name for f in sorted(d.glob("*"))] if d.exists() else []


@app.post("/api/notes/{nid}/ppt/ref")
async def add_ppt_ref(nid: str, file: UploadFile):
    from app import ppt
    db.get(nid) or _404()
    d = ppt.ref_dir(MEDIA, nid); d.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"): raise HTTPException(400, "PNG·JPG·WEBP 이미지만 넣을 수 있어요")
    if len(list(d.glob("*"))) >= 4: raise HTTPException(400, "레퍼런스 이미지는 최대 4장이에요")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024: raise HTTPException(400, "이미지는 8MB 이하만 넣을 수 있어요")
    name = f"{int(time.time() * 1000)}{ext}"; (d / name).write_bytes(data)
    return {"name": name}


@app.delete("/api/notes/{nid}/ppt/ref/{name}")
def del_ppt_ref(nid: str, name: str):
    from app import ppt
    db.get(nid) or _404()
    f = ppt.ref_dir(MEDIA, nid) / Path(name).name
    f.unlink(missing_ok=True)
    return {"ok": True}


# ---- 카툰 (cartoon.py): 시작은 POST(칸 번호를 주면 그 칸만 다시), 진행·결과는 GET 폴링 ----
@app.post("/api/notes/{nid}/cartoon")
def start_cartoon(nid: str, panel: int | None = None, body: ExtOpts | None = None):
    from app import cartoon
    n = db.get(nid) or _404()
    if not n.get("report") or not ai:
        raise HTTPException(400, "리포트가 아직 없어요")
    return cartoon.start(MEDIA, n, panel, (body.style if body else None), (body.extra if body else None))


@app.get("/api/notes/{nid}/cartoon")
def get_cartoon(nid: str):
    from app import cartoon, templates
    db.get(nid) or _404()
    f = templates.path(MEDIA, nid, "cartoon")
    return {"job": cartoon.JOBS.get(nid), "result": json.loads(f.read_text(encoding="utf-8")) if f.exists() else None, "installed": cartoon.installed()}


def _404():
    raise HTTPException(404, "노트가 없습니다")


app.mount("/media", StaticFiles(directory=MEDIA), name="media")


@app.get("/{path:path}")
def web(path: str):
    if not DIST.exists():
        return HTMLResponse("<p>web/dist 가 없습니다. <code>cd web && npm install && npm run build</code> 후 다시 여세요.</p>")
    f = (DIST / path).resolve()
    if path and f.is_file() and f.is_relative_to(DIST.resolve()):
        return FileResponse(f)
    return FileResponse(DIST / "index.html")  # SPA 라우팅
