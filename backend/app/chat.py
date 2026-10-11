"""영상 채팅: 추천 질문 3개 + 대본 기반 답변(스트리밍). 기록은 data/media/<id>/chat.json."""
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

CHAT_PROMPT = """너는 아래 유튜브 영상 대본만 근거로 질문에 답하는 도우미다. 대본은 한 줄이 `[인덱스 mm:ss] 텍스트` 형식이다.
규칙: 한국어로, 간결하게(핵심부터 3~6문장 또는 짧은 목록). 대본에 없는 내용은 모른다고 말한다. 사실 주장마다 근거 대본 줄의 인덱스를 문장 끝에 [12] 형태로 붙인다(여러 개면 [3][7], 실제 존재하는 번호만, 시간 표기 금지). 이전 대화가 있으면 이어서 답한다. 마크다운 제목·코드펜스는 쓰지 않는다.

대본:
"""
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
    model = os.environ.get("VN_OLLAMA_MODEL", "gemma4:12b")
    body = json.dumps({"model": model, "stream": False, "options": {"num_ctx": 32768}, "messages": [{"role": "user", "content": prompt}]}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(ai.OLLAMA_URL, body, {"Content-Type": "application/json"}), timeout=300) as r:
            return json.load(r)["message"]["content"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Ollama 모델 '{model}' 사용 불가({e.code}): `ollama pull {model}` 로 설치하거나 VN_OLLAMA_MODEL 설정") from e
    except OSError as e:
        raise RuntimeError(f"Ollama(127.0.0.1:11434)에 연결 못 함: {e}") from e


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


@router.post("/api/notes/{nid}/chat")
def ask(nid: str, body: Ask):
    q = body.q.strip()
    if not q: raise HTTPException(400, "질문이 비었어요")
    tr, n = _tr(nid)
    d = _load(nid)
    hist = "".join(f"\n{'사용자' if m['role'] == 'user' else '답변'}: {m['text']}" for m in d["messages"][-2 * TURNS:])
    prompt = ai._kind(n, CHAT_PROMPT) + tr + ("\n\n이전 대화:" + hist if hist else "") + f"\n\n사용자 질문: {q}\n답변:"

    def gen():
        sse = lambda o: f"data: {json.dumps(o, ensure_ascii=False)}\n\n"
        text = ""
        try:
            try:
                for t in _stream_claude(prompt):
                    text += t
                    yield sse({"t": t})
            except (RuntimeError, OSError) as e:
                if text: raise  # 이미 일부 보냈으면 이어붙일 수 없음
                text = _ollama_text(prompt)  # claude 실패 → Ollama(스트리밍 없이 한 번에)
                yield sse({"t": text})
            text, refs = clean(text, len(n["transcript"]))
            d["messages"] += [{"role": "user", "text": q}, {"role": "assistant", "text": text, "refs": refs}]
            _save(nid, d)
            yield sse({"done": True, "text": text, "refs": refs})
        except Exception as e:
            yield sse({"error": str(e)})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
