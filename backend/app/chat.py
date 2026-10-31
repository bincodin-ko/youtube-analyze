"""영상 채팅: 추천 질문 3개 + 요약·대본 기반 답변(스트리밍, 영상 밖은 (일반 지식) 표시). 기록은 data/media/<id>/chat.json."""
import json, os, re, shutil, subprocess, urllib.request
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import ai, db

router = APIRouter()
from app.paths import MEDIA
USAGE = {}  # 마지막 채팅 호출의 비용·토큰(사용량 확인용)
TURNS = 4   # 프롬프트에 다시 넣는 이전 대화 쌍 수

CHAT_PROMPT = """너는 아래 유튜브 영상의 요약과 대본을 바탕으로 사용자와 대화하는 도우미다. 대본은 한 줄이 `[인덱스 mm:ss] 텍스트` 형식이다.
규칙: 한국어로, 간결하게(핵심부터 3~6문장 또는 짧은 목록). 영상 내용은 대본을 우선 근거로 삼고, 사실 주장마다 근거 대본 줄의 인덱스를 문장 끝에 [12] 형태로 붙인다(여러 개면 [3][7], 실제 존재하는 번호만, 시간 표기 금지). 영상에 없는 배경지식·의견·응용 질문은 네 일반 지식으로 답하되 그 문장 앞에 (일반 지식)이라고 붙여 영상 내용과 구분한다. 이전 대화가 있으면 이어서 답한다. 마크다운 제목·코드펜스는 쓰지 않는다.
"""
# 채팅 모드: local_strict(기본, 로컬·영상 안만) / local_open(로컬·영상 밖도) / claude(Claude·영상 밖도)
# auto(자동 · 로컬+Claude): 질문을 영상 안/밖으로 나눠 안은 로컬, 밖은 Claude가 답함(_stream_auto)
MODES = ("local_strict", "local_open", "claude", "auto")
OPEN_RULE = "영상에 없는 배경지식·의견·응용 질문은 네 일반 지식으로 답하되 그 문장 앞에 (일반 지식)이라고 붙여 영상 내용과 구분한다."
STRICT_RULE = "영상(대본·요약)에 없는 내용은 지어내지 말고 \"영상에서 다루지 않은 내용이에요\"라고만 답한다. 일반 지식으로 보충하지 않는다."
OLLAMA_MODEL = lambda: os.environ.get("VN_OLLAMA_MODEL", "gemma4:12b")


def rule(prompt, mode):
    """모드가 local_strict면 '일반 지식' 규칙을 '영상 안만' 규칙으로 바꾼다."""
    return prompt.replace(OPEN_RULE, STRICT_RULE) if mode == "local_strict" else prompt


SPLIT_PROMPT = """아래 「{title}」의 요약을 보고, 사용자 질문을 두 부분으로 나눠라.
- inside: 요약(자료)에서 답할 수 있는 부분을 질문 형태로. 없으면 빈 문자열.
- outside: 사용자가 실제로 물었는데 자료에 없는 부분(다른 도구·비교·추천·배경지식·최신 정보 등)만, 자료를 안 본 사람도 알아듣게 무엇에 관한 것인지 맥락을 넣은 질문으로. 없으면 빈 문자열.
질문이 자료만으로 답해지면 outside는 반드시 빈 문자열이다. 사용자가 묻지 않은 내용을 덧붙이거나 질문을 넓히지 마라.
이전에 같은 질문을 했더라도 이번 질문 그대로 다시 나눠라. JSON 객체 하나만 출력: {{"inside":"...","outside":"..."}}

요약:
{summ}

사용자 질문: {q}"""


def _split(q, title, summ):
    """자동 모드: 질문을 자료 안/밖으로 나눈다(로컬, 생각 끔, JSON). 실패하면 (q, "")."""
    body = json.dumps({"model": OLLAMA_MODEL(), "stream": False, "think": False, "format": "json", "options": {"num_ctx": 8192},
                       "messages": [{"role": "user", "content": SPLIT_PROMPT.format(title=title, summ=summ[:6000], q=q)}]}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(ai.OLLAMA_URL, body, {"Content-Type": "application/json"}), timeout=120) as r:
            o = json.loads(json.load(r)["message"]["content"])
        return str(o.get("inside") or "").strip(), str(o.get("outside") or "").strip()
    except (OSError, ValueError, KeyError) as e:
        print(f"[chat] 질문 나누기 실패: {e}")
        return q, ""


def _stream_auto(make, q, title, summ):
    """자동: ①질문을 자료 안/밖으로 먼저 나누고(_split) ②안 부분은 로컬이 자료로만 답하고 ③밖 부분은 Claude가 이어 답한다.
    (예전엔 로컬이 답을 쓰다 [[영상 밖]] 표시를 붙여야 Claude가 불렸는데, 같은 질문에도 빠뜨리는 일이 있어 나누는 단계를 따로 둠)
    Claude에는 영상 제목·밖 질문·로컬 답 첫 문장만 보낸다(대본은 PC 밖으로 안 나감)."""
    inside, q2 = _split(q, title, summ)
    print(f"[chat] 자동 나누기: 안={inside!r} 밖={q2!r}")
    text = ""
    if inside or not q2:
        for t in _stream_ollama(make(inside or q)):
            text += t
            yield t
    if not q2: return
    before = text or summ  # 로컬 답이 없으면(전부 영상 밖) 요약 첫 문장을 맥락으로
    head = "\n" * max(0, 2 - (len(text) - len(text.rstrip("\n")))) if text.strip() else ""  # 로컬 답과 빈 줄 하나
    # 맥락: 로컬 답의 첫 문장만(근거 번호 빼고 200자 이내). 대본·요약 전체는 보내지 않는다
    ctx = re.split(r"(?<=[.!?다요])\s", re.sub(r"\s*\[\d{1,5}\]", "", before).strip(), maxsplit=1)[0][:200]
    p2 = (f"아래는 「{title}」 영상을 본 사용자의 질문 중 영상에서 다루지 않은 부분이다."
          + (f" 영상에서 확인된 내용: {ctx} 이 내용을 사실로 받아들이고, 그 대상을 모른다는 말 없이 답하라." if ctx else "")
          + " 네 일반 지식으로 한국어로 간결하게(3~5문장) 답하라. 마크다운 제목·코드펜스를 쓰지 말고, 숫자를 대괄호로 감싸지 마라."
          + f"\n\n질문: {q2}\n답변:")
    try:
        first = True
        for t in _stream_claude(p2):
            if first: yield head + "(Claude) "; first = False  # 화면은 이 표시부터 끝까지를 따로 접는 Claude 칸으로 보여 줌
            yield t
    except (RuntimeError, OSError) as e:
        yield head + f"(영상 밖 질문 「{q2}」은 Claude가 답해요. 입력창 설정에서 Claude를 연결해 주세요. — {str(e)[:120]})"


SUG_PROMPT = """아래는 유튜브 영상 대본이다(한 줄 `[인덱스 mm:ss] 텍스트`). 시청자가 이 영상에 대해 물어볼 만한 구체적인 한국어 질문 3개를 만들어라. 각 질문은 30자 이내, 서로 다른 주제, 대본에서 답이 나오는 것만.
JSON 객체 하나만 출력(설명·코드펜스 금지): {"questions":["...","...","..."]}

대본:
"""


def _tr(nid):
    n = db.get(nid)
    if not n: raise HTTPException(404, "노트가 없습니다")
    if not n.get("transcript"): raise HTTPException(409, "대본이 아직 없어요")
    return "\n".join(f"[{i} {ai._mmss(s['start'])}] {s['text']}" for i, s in enumerate(n["transcript"])), n


def _load(nid):
    f = MEDIA / nid / "chat.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {"suggestions": [], "messages": []}


def _save(nid, d):
    (MEDIA / nid).mkdir(parents=True, exist_ok=True)
    (MEDIA / nid / "chat.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")


def clean(text, n):
    """존재하지 않는 [인덱스] 제거 + 근거 목록(중복 제거, 등장 순)."""
    refs = []
    def fix(m):
        i = int(m.group(1))
        if 0 <= i < n:
            if i not in refs: refs.append(i)
            return m.group(0)
        return ""
    return re.sub(r"[ ]?\[(\d{1,5})\]", fix, text).strip(), refs


def _stream_claude(prompt):
    """claude -p stream-json: 글자 조각을 yield. 끝나면 USAGE 갱신."""
    exe = shutil.which("claude")
    if not exe: raise RuntimeError("claude CLI를 PATH에서 찾지 못함")
    cmd = [exe, "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--model", "sonnet",
           "--no-session-persistence", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands"]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    p.stdin.write(prompt); p.stdin.close()
    got = False
    try:
        for line in p.stdout:
            try: ev = json.loads(line)
            except ValueError: continue
            if ev.get("type") == "stream_event":
                d = ev["event"].get("delta") or {}
                if d.get("type") == "text_delta": got = True; yield d["text"]
            elif ev.get("type") == "result":
                if ev.get("is_error"): raise RuntimeError(f"claude 오류/한도: {str(ev.get('result'))[:300]}")
                USAGE.update(cost_usd=ev.get("total_cost_usd"), usage=ev.get("usage"), seconds=ev.get("duration_ms", 0) / 1000)
        p.wait(timeout=30)
        if not got: raise RuntimeError(f"claude 실패(코드 {p.returncode}): {p.stderr.read()[:300]}")
    finally:
        if p.poll() is None: p.kill()


def _ollama_text(prompt):
    return "".join(_stream_ollama(prompt))


def _stream_ollama(prompt):
    """Ollama 로컬 모델 스트리밍: 글자 조각을 yield. think=False: gemma4가 답 전에 보이지 않는 생각을 1~2천 토큰 써서 1분 넘게 걸리던 것을 끔(실측 70초→11초)."""
    model = OLLAMA_MODEL()
    body = json.dumps({"model": model, "stream": True, "think": False, "options": {"num_ctx": 32768}, "messages": [{"role": "user", "content": prompt}]}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(ai.OLLAMA_URL, body, {"Content-Type": "application/json"}), timeout=300) as r:
            for line in r:
                if not line.strip(): continue
                ev = json.loads(line)
                if ev.get("error"): raise RuntimeError(f"로컬 모델 오류: {ev['error']}")
                t = (ev.get("message") or {}).get("content")
                if t: yield t
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"로컬 모델 '{model}'이 없어요({e.code}). `ollama pull {model}`로 받거나 입력창 설정에서 Claude를 고르세요.") from e
    except OSError as e:
        raise RuntimeError(f"로컬 모델(Ollama)에 연결하지 못했어요. Ollama를 켜거나 입력창 설정에서 Claude를 고르세요. ({e})") from e


_STATUS = {"at": 0, "data": None}


@router.get("/api/claude/status")
def claude_status(fresh: bool = False):
    """채팅이 쓰는 Claude 계정(claude CLI 로그인) 상태. 30초 캐시."""
    import time
    if not fresh and _STATUS["data"] and time.time() - _STATUS["at"] < 30:
        return _STATUS["data"]
    exe = shutil.which("claude")
    if not exe:
        d = {"installed": False, "loggedIn": False}
    else:
        try:
            r = subprocess.run([exe, "auth", "status"], capture_output=True, text=True, encoding="utf-8", timeout=30)
            s = json.loads(r.stdout)
            d = {"installed": True, "loggedIn": bool(s.get("loggedIn")), "email": s.get("email"), "plan": s.get("subscriptionType"), "method": s.get("authMethod")}
        except (OSError, ValueError, subprocess.SubprocessError):
            d = {"installed": True, "loggedIn": False}
    _STATUS.update(at=time.time(), data=d)
    return d


@router.post("/api/claude/login")
def claude_login():
    """보이는 터미널 창에서 claude auth login 실행 → 사용자가 자기 브라우저에서 로그인."""
    exe = shutil.which("claude")
    if not exe: raise HTTPException(404, "claude 명령이 없어요. Claude Code를 먼저 설치해 주세요.")
    subprocess.Popen(["cmd", "/k", exe, "auth", "login"], creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
    _STATUS["data"] = None
    return {"ok": True}


@router.post("/api/claude/logout")
def claude_logout():
    """Claude 계정 연결 끊기(claude auth logout). 이후 Claude 모드는 다시 연결해야 씀."""
    exe = shutil.which("claude")
    if not exe: raise HTTPException(404, "claude 명령이 없어요")
    r = subprocess.run([exe, "auth", "logout"], capture_output=True, text=True, encoding="utf-8", timeout=60)
    _STATUS["data"] = None
    if r.returncode: raise HTTPException(502, f"연결을 끊지 못했어요: {(r.stderr or r.stdout)[:200]}")
    return {"ok": True}


@router.get("/api/chat/models")
def chat_models():
    """입력창 설정 메뉴용: 로컬 모델 이름·설치 여부."""
    model = OLLAMA_MODEL()
    try:
        with urllib.request.urlopen(ai.OLLAMA_URL.replace("/api/chat", "/api/tags"), timeout=3) as r:
            names = [m["name"] for m in json.load(r)["models"]]
        ok = model in names or f"{model}:latest" in names
    except OSError:
        ok = None  # Ollama 꺼짐
    return {"local": model, "local_ready": ok}


@router.get("/api/notes/{nid}/chat")
def get_chat(nid: str):
    d = _load(nid)
    if settle(d): _save(nid, d)
    if not d["suggestions"]:  # 처음 한 번만 만들어 저장
        tr, note = _tr(nid)
        try:
            qs = ai._ask(ai._kind(note, SUG_PROMPT) + tr, 180, lambda r: [q for q in r["questions"] if isinstance(q, str)][:3])
        except Exception as e:
            raise HTTPException(502, f"추천 질문을 만들지 못했어요: {e}")
        d["suggestions"] = qs
        _save(nid, d)
    return d


class Ask(BaseModel):
    q: str
    mode: str = "local_strict"


@router.post("/api/notes/{nid}/chat")
def ask(nid: str, body: Ask):
    q = body.q.strip()
    if not q: raise HTTPException(400, "질문이 비었어요")
    tr, n = _tr(nid)
    d = _load(nid)
    if any(m.get("pending") and m.get("id") in RUNNING for m in d["messages"]): raise HTTPException(409, "앞 질문의 답을 아직 만드는 중이에요")
    settle(d)
    hist = history(d)
    summ = "\n요약:\n" + ai.report_text(n["report"]) + "\n" if n.get("report") else ""
    # 자동 모드는 로컬이 자료 안 부분만 답하므로 '영상 안만' 규칙으로, 나눈 질문을 넣어 만든다
    make = lambda qq: ai._kind(n, rule(CHAT_PROMPT, "local_strict" if body.mode == "auto" else body.mode)) + summ + "\n대본:\n" + tr + ("\n\n이전 대화:" + hist + NO_REPEAT if hist else "") + f"\n\n사용자 질문: {qq}\n답변:"
    prompt = make if body.mode == "auto" else make(q)
    return _sse(prompt, d, q, lambda t: clean(t, len(n["transcript"])), lambda: _save(nid, d), body.mode, n.get("title") or "",
                (q, ai.report_text(n["report"]) if n.get("report") else tr[:6000]))


RUNNING = set()  # 지금 서버 뒤에서 답을 만드는 중인 메시지 id


def settle(d):
    """앱이 다시 켜져서 끊긴 '작성 중' 답은 오류로 바꾼다. 바뀌었으면 True."""
    ch = False
    for m in d.get("messages", []):
        if m.get("pending") and m.get("id") not in RUNNING:
            m.pop("pending"); m["err"] = True; m["text"] = m.get("text") or "앱이 다시 켜지는 바람에 답을 끝까지 받지 못했어요. 다시 물어봐 주세요."; ch = True
    return ch


# 이전 대화가 있을 때 붙이는 규칙: 이미 한 설명을 다음 답에서 되풀이하지 않게
NO_REPEAT = ("\n\n(규칙) 위 이전 대화에서 이미 답한 내용은 다시 설명하지 마라. 필요하면 \"앞에서 말씀드린 대로\" 한 구절로만 짚고, "
             "이번 질문에서 새로 묻는 부분만 답하라. 같은 질문을 다시 하면 앞 답을 한두 문장으로만 요약하라.")


def history(d):
    return "".join(f"\n{'사용자' if m['role'] == 'user' else '답변'}: {m['text']}" for m in d["messages"][-2 * TURNS:] if not m.get("pending") and not m.get("err"))


def _sse(prompt, d, q, fix, save, mode="local_strict", title="", auto=None):
    """모드대로 Claude 또는 로컬(Ollama)로 답한다. 다른 쪽으로 몰래 넘어가지 않는다.
    질문은 바로 저장하고, 답은 화면 연결과 상관없이 뒤 스레드가 끝까지 만들어 저장한다(나갔다 와도 남음).
    SSE는 그 진행을 흘려보내기만 한다."""
    import queue, threading, time
    if mode not in MODES: raise HTTPException(400, f"모드는 {', '.join(MODES)} 중 하나")
    # auto면 prompt는 make(질문)->로컬 프롬프트 함수, auto=(원래 질문, 요약)
    stream = _stream_claude if mode == "claude" else (lambda p: _stream_auto(p, auto[0], title, auto[1])) if mode == "auto" else _stream_ollama
    mid = f"m{int(time.time() * 1000)}"
    a = {"role": "assistant", "text": "", "mode": mode, "id": mid, "pending": True}
    d["messages"] += [{"role": "user", "text": q}, a]
    RUNNING.add(mid); save()
    qu = queue.Queue()

    def work():
        text = ""
        try:
            for t in stream(prompt):
                text += t
                qu.put({"t": t})
            text, refs = fix(text)
            a.update(text=text, refs=refs)
            qu.put({"done": True, "text": text, "refs": refs})
        except Exception as e:
            a.update(text=str(e), err=True)
            qu.put({"error": str(e)})
        finally:
            a.pop("pending", None); RUNNING.discard(mid)
            try: save()
            except OSError: pass
            qu.put(None)
    threading.Thread(target=work, daemon=True).start()

    def gen():
        sse = lambda o: f"data: {json.dumps(o, ensure_ascii=False)}\n\n"
        while (o := qu.get()) is not None:
            yield sse(o)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
