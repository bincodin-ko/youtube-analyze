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
MODES = ("local_strict", "local_open", "claude")
OPEN_RULE = "영상에 없는 배경지식·의견·응용 질문은 네 일반 지식으로 답하되 그 문장 앞에 (일반 지식)이라고 붙여 영상 내용과 구분한다."
STRICT_RULE = "영상(대본·요약)에 없는 내용은 지어내지 말고 \"영상에서 다루지 않은 내용이에요\"라고만 답한다. 일반 지식으로 보충하지 않는다."
OLLAMA_MODEL = lambda: os.environ.get("VN_OLLAMA_MODEL", "gemma4:12b")


def rule(prompt, mode):
    """모드가 local_strict면 '일반 지식' 규칙을 '영상 안만' 규칙으로 바꾼다."""
    return prompt.replace(OPEN_RULE, STRICT_RULE) if mode == "local_strict" else prompt
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
    """Ollama 로컬 모델 스트리밍: 글자 조각을 yield."""
    model = OLLAMA_MODEL()
    body = json.dumps({"model": model, "stream": True, "options": {"num_ctx": 32768}, "messages": [{"role": "user", "content": prompt}]}).encode()
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
    hist = "".join(f"\n{'사용자' if m['role'] == 'user' else '답변'}: {m['text']}" for m in d["messages"][-2 * TURNS:])
    summ = "\n요약:\n" + ai.report_text(n["report"]) + "\n" if n.get("report") else ""
    prompt = ai._kind(n, rule(CHAT_PROMPT, body.mode)) + summ + "\n대본:\n" + tr + ("\n\n이전 대화:" + hist if hist else "") + f"\n\n사용자 질문: {q}\n답변:"
    return _sse(prompt, d, q, lambda t: clean(t, len(n["transcript"])), lambda: _save(nid, d), body.mode)


def _sse(prompt, d, q, fix, save, mode="local_strict"):
    """모드대로 Claude 또는 로컬(Ollama) 스트리밍 → SSE. 다른 쪽으로 몰래 넘어가지 않는다.
    끝나면 fix(text)->(text, refs)로 정리해 d["messages"]에 붙이고 save()."""
    if mode not in MODES: raise HTTPException(400, f"모드는 {', '.join(MODES)} 중 하나")
    stream = _stream_claude if mode == "claude" else _stream_ollama
    def gen():
        sse = lambda o: f"data: {json.dumps(o, ensure_ascii=False)}\n\n"
        text = ""
        try:
            for t in stream(prompt):
                text += t
                yield sse({"t": t})
            text, refs = fix(text)
            d["messages"] += [{"role": "user", "text": q}, {"role": "assistant", "text": text, "refs": refs, "mode": mode}]
            save()
            yield sse({"done": True, "text": text, "refs": refs})
        except Exception as e:
            yield sse({"error": str(e)})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
