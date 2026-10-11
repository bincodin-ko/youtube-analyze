"""여러 노트 통합 요약: 공통 주제·노트별 차이·비교표·종합 결론. 저장: data/combined/<id>.json"""
import json, re, time
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import ai, db

router = APIRouter()
DIR = Path(__file__).resolve().parents[2] / "data" / "combined"
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


def _file(cid):
    if not re.fullmatch(r"c\d+", cid): raise HTTPException(404, "통합 요약이 없어요")
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
