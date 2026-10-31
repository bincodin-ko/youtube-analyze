"""여러 노트 통합 요약: 공통 주제·노트별 차이·비교표·종합 결론. 저장: data/combined/<id>.json"""
import json, re, time
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import ai, db

router = APIRouter()
from app.paths import DATA
DIR = DATA / "combined"
MARK = re.compile(r"\[(\d{1,2}):(\d{1,5})\]")  # 출처 표기 [노트번호:대본줄]

PROMPT = """너는 같은 주제의 자료 여러 개를 비교해 하나의 통합 리포트로 정리하는 편집자다. 아래에 노트 1..N의 요약이 있다. 각 문장 끝의 [노트번호:줄번호]는 근거 위치다.
JSON 객체 하나만 출력하라(설명·코드펜스 금지):
{"title":"통합 리포트 제목","overview":"총평 2~3문장, 핵심 키워드는 **굵게**",
 "common":["여러 노트가 함께 다루는 공통 주제·주장 한 문장 [1:3][2:5]"],
 "differences":[{"note":1,"points":["이 노트만의 관점·사례·수치 한 문장 [1:7]"]}],
 "table":{"columns":["비교 항목","노트1 약칭","노트2 약칭"],"rows":[["항목 이름","노트1의 내용","노트2의 내용"]]},
 "conclusion":"종합 결론 3~5문장, 근거 [1:3] 표기 포함"}
규칙: 한국어. common 3~5개. differences는 모든 노트마다 하나씩, points 2~4개. table은 columns 첫 칸이 '비교 항목', 이후 노트마다 한 칸(약칭 6자 이내). rows 4~7줄, 칸마다 짧게. 출처는 입력에 실제 있는 [노트번호:줄번호]만 그대로 쓰고 지어내지 말 것(칸 안에도 가능). 노트에 없는 내용은 쓰지 않는다.

"""


def _src(notes):
    out = []
    for k, n in enumerate(notes, 1):
        if not (n and n.get("report")):  # 채팅: 지워진 노트는 통합 요약 내용만으로
            out.append(f"### 노트 {k}: (지워진 노트 — 아래 통합 요약 내용만 근거)"); continue
        r = n["report"]
        lines = [f"### 노트 {k}: {n['title']}", r["overview"]]
        for s in r["sections"]:
            for c in s["children"]:
                lines.append(f"## {c['title']}")
                lines += [f"- {b['text']} " + "".join(f"[{k}:{i}]" for i in b["refs"][:2]) for b in c["bullets"]]
        out.append("\n".join(lines))
    return "\n\n".join(out)


def build(notes):
    starts = {}  # "노트번호:줄" -> 시작 시각(화면 이동용)

    def fx(s):  # 없는 출처 표기는 지우고, 있는 건 시각을 기록
        def sub(m):
            k, i = int(m[1]), int(m[2])
            if 1 <= k <= len(notes) and i < len(notes[k - 1]["transcript"]):
                starts[f"{k}:{i}"] = notes[k - 1]["transcript"][i]["start"]
                return m[0]
            return ""
        return MARK.sub(sub, str(s)).strip()

    def parse(r):
        cols = [fx(c) for c in r["table"]["columns"]]
        rows = [([fx(c) for c in row] + [""] * len(cols))[:len(cols)] for row in r["table"]["rows"]]
        out = {"title": fx(r["title"]), "overview": fx(r["overview"]), "common": [fx(x) for x in r["common"]],
               "differences": [{"note": int(d["note"]), "points": [fx(p) for p in d["points"]]}
                               for d in r["differences"] if 1 <= int(d["note"]) <= len(notes)],
               "table": {"columns": cols, "rows": rows}, "conclusion": fx(r["conclusion"])}
        if not (out["common"] and out["differences"] and rows): raise ValueError("통합 리포트 형식 오류")
        return out

    t = time.time()
    res = ai._ask(PROMPT + _src(notes), 900, parse)
    return {**res, "starts": starts, "seconds": round(time.time() - t, 1)}


class Req(BaseModel):
    note_ids: list[str]
    collection_id: int | None = None


@router.post("/api/combine")
def combine(body: Req):
    ids = list(dict.fromkeys(body.note_ids))
    if not 2 <= len(ids) <= 10:
        raise HTTPException(400, "노트를 2~10개 골라 주세요")
    notes = []
    for i in ids:
        n = db.get(i)
        if not n: raise HTTPException(404, f"노트 {i}가 없어요")
        if n["status"] != "done" or not n.get("report"): raise HTTPException(409, f"「{n['title']}」은 아직 리포트가 없어요")
        n["title"] = n["title"] or n["id"]
        notes.append(n)
    try:
        res = build(notes)
    except Exception as e:
        raise HTTPException(502, f"통합 요약 생성 실패: {e}")
    cid = f"c{int(time.time())}"
    doc = {"id": cid, "created_at": datetime.now().isoformat(timespec="seconds"), "collection_id": body.collection_id,
           "notes": [{"id": n["id"], "title": n["title"], "channel": n.get("channel"), "kind": n.get("kind"), "thumbnail": n.get("thumbnail")} for n in notes],
           **res}
    DIR.mkdir(parents=True, exist_ok=True)
    (DIR / f"{cid}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"id": cid}


def _file(cid):  # c=통합 요약, g=통합 요약 없이 바로 시작한 여러 노트 대화
    if not re.fullmatch(r"[cg]\d+", cid): raise HTTPException(404, "통합 요약이 없어요")
    f = DIR / f"{cid}.json"
    if not f.exists(): raise HTTPException(404, "통합 요약이 없어요")
    return f


@router.get("/api/combined")
def list_combined(collection_id: int | None = None):
    docs = [json.loads(f.read_text(encoding="utf-8")) for f in DIR.glob("c*.json")] if DIR.exists() else []
    docs = [d for d in docs if collection_id is None or d.get("collection_id") == collection_id]
    docs.sort(key=lambda d: d["created_at"], reverse=True)
    return [{"id": d["id"], "title": d["title"], "created_at": d["created_at"], "count": len(d["notes"]), "collection_id": d.get("collection_id")} for d in docs]


@router.get("/api/combined/{cid}")
def get_combined(cid: str):
    return json.loads(_file(cid).read_text(encoding="utf-8"))


@router.delete("/api/combined/{cid}")
def delete_combined(cid: str):
    _file(cid).unlink()
    return {"ok": True}


@router.post("/api/groupchat")
def new_groupchat(body: Req):
    """노트 1~10개를 골라 통합 요약 없이 바로 Claude와 대화. 저장: data/combined/g<시각>.json"""
    ids = list(dict.fromkeys(body.note_ids))
    if not 1 <= len(ids) <= 10: raise HTTPException(400, "노트를 1~10개 골라 주세요")
    notes = []
    for i in ids:
        n = db.get(i)
        if not n: raise HTTPException(404, f"노트 {i}가 없어요")
        if n["status"] != "done" or not n.get("report"): raise HTTPException(409, f"「{n['title']}」은 아직 리포트가 없어요")
        notes.append(n)
    gid = f"g{int(time.time() * 1000)}"
    t0 = notes[0]["title"] or notes[0]["id"]
    doc = {"id": gid, "created_at": datetime.now().isoformat(timespec="seconds"), "collection_id": body.collection_id,
           "title": t0 if len(notes) == 1 else f"{t0} 외 {len(notes) - 1}개",
           "notes": [{"id": n["id"], "title": n["title"] or n["id"], "channel": n.get("channel"), "kind": n.get("kind"), "thumbnail": n.get("thumbnail")} for n in notes],
           "starts": {}, "messages": []}
    DIR.mkdir(parents=True, exist_ok=True)
    (DIR / f"{gid}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"id": gid}


@router.get("/api/groupchat")
def list_groupchat():
    docs = [json.loads(f.read_text(encoding="utf-8")) for f in DIR.glob("g*.json")] if DIR.exists() else []
    docs.sort(key=lambda d: d["created_at"], reverse=True)
    return [{"id": d["id"], "title": d["title"], "created_at": d["created_at"], "count": len(d["notes"]), "turns": len(d["messages"]) // 2} for d in docs]


CHAT_PROMPT = """너는 아래 노트 1..N(영상·글 요약)을 함께 보고 사용자와 대화하는 도우미다. 각 문장 끝의 [노트번호:줄번호]는 근거 위치다.
규칙: 한국어로, 간결하게(핵심부터 3~6문장 또는 짧은 목록). 노트끼리 비교·연결해서 답해도 된다. 노트 내용을 말할 때는 입력에 실제 있는 [노트번호:줄번호]를 문장 끝에 그대로 붙인다(지어내지 말 것). 노트에 없는 배경지식·의견은 네 일반 지식으로 답하되 그 문장 앞에 (일반 지식)이라고 붙인다. 이전 대화가 있으면 이어서 답한다. 마크다운 제목·코드펜스는 쓰지 않는다.

"""


OPEN_RULE = "노트에 없는 배경지식·의견은 네 일반 지식으로 답하되 그 문장 앞에 (일반 지식)이라고 붙인다."
STRICT_RULE = "노트에 없는 내용은 지어내지 말고 \"고른 노트에서 다루지 않은 내용이에요\"라고만 답한다. 일반 지식으로 보충하지 않는다."


class Ask(BaseModel):
    q: str
    mode: str = "local_strict"


@router.post("/api/combined/{cid}/chat")
def chat(cid: str, body: Ask):
    from app.chat import TURNS, _sse
    q = body.q.strip()
    if not q: raise HTTPException(400, "질문이 비었어요")
    f = _file(cid)
    doc = json.loads(f.read_text(encoding="utf-8"))
    notes = [db.get(x["id"]) for x in doc["notes"]]  # 지워진 노트는 None
    for n, x in zip(notes, doc["notes"]):
        if n: n["title"] = x["title"]
    doc.setdefault("messages", [])
    hist = "".join(f"\n{'사용자' if m['role'] == 'user' else '답변'}: {m['text']}" for m in doc["messages"][-2 * TURNS:])
    summ = "\n\n통합 요약:\n" + "\n".join([f"총평: {doc['overview']}", *("공통: " + t for t in doc["common"]),
                      *(f"노트 {d['note']}만의 점: {p}" for d in doc["differences"] for p in d["points"]), f"결론: {doc['conclusion']}"]) if doc.get("overview") else ""
    from app.chat import AUTO_RULE
    head = CHAT_PROMPT.replace(OPEN_RULE, {"local_strict": STRICT_RULE, "auto": AUTO_RULE.replace("영상(대본·요약)", "노트")}.get(body.mode, OPEN_RULE))
    prompt = (head + _src(notes) + summ
              + ("\n\n이전 대화:" + hist if hist else "") + f"\n\n사용자 질문: {q}\n답변:")

    def fix(text):  # 없는 [노트:줄]은 지우고, 있는 건 starts에 시각 기록(화면 링크용)
        refs = []
        def sub(m):
            k, i = int(m[1]), int(m[2])
            n = notes[k - 1] if 1 <= k <= len(notes) else None
            if n and i < len(n["transcript"]):
                doc["starts"][f"{k}:{i}"] = n["transcript"][i]["start"]
            if f"{k}:{i}" in doc["starts"]:  # 지워진 노트는 통합 요약에 이미 있던 출처만
                refs.append(f"{k}:{i}")
                return m[0]
            return ""
        return MARK.sub(sub, text).strip(), refs

    save = lambda: f.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    return _sse(prompt, doc, q, fix, save, body.mode, doc.get("title", ""))
