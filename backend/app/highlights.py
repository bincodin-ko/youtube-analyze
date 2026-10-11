"""하이라이트·메모. 노트별 data/media/<id>/highlights.json (문장 텍스트·섹션 id·메모·만든 날짜)."""
import json, secrets
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db

router = APIRouter()
MEDIA = Path(__file__).resolve().parents[2] / "data" / "media"


def _load(nid):
    f = MEDIA / nid / "highlights.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def _save(nid, items):
    (MEDIA / nid).mkdir(parents=True, exist_ok=True)
    (MEDIA / nid / "highlights.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")


def _check(nid):
    if not db.get(nid): raise HTTPException(404, "노트가 없습니다")  # 실제 노트 id만 통과 → 경로 조작 방지


class New(BaseModel):
    text: str
    section: str = ""
    memo: str = ""


class Memo(BaseModel):
    memo: str


@router.get("/api/notes/{nid}/highlights")
def get_all(nid: str):
    _check(nid)
    return _load(nid)


@router.post("/api/notes/{nid}/highlights")
def add(nid: str, b: New):
    _check(nid)
    if not b.text.strip(): raise HTTPException(400, "선택한 글이 비었어요")
    items = _load(nid)
    h = {"id": secrets.token_hex(4), "text": b.text.strip()[:2000], "section": b.section, "memo": b.memo,
         "created_at": datetime.now().isoformat(timespec="seconds")}
    _save(nid, items + [h])
    return h


@router.put("/api/notes/{nid}/highlights/{hid}")
def edit(nid: str, hid: str, b: Memo):
    _check(nid)
    items = _load(nid)
    for h in items:
        if h["id"] == hid: h["memo"] = b.memo
    _save(nid, items)
    return {"ok": True}


@router.delete("/api/notes/{nid}/highlights/{hid}")
def remove(nid: str, hid: str):
    _check(nid)
    _save(nid, [h for h in _load(nid) if h["id"] != hid])
    return {"ok": True}


@router.get("/api/highlights")
def everything():
    """모든 노트의 하이라이트 모아보기: 노트별 묶음, 가장 최근에 남긴 노트 먼저."""
    out = []
    for n in db.list_all():
        f = MEDIA / n["id"] / "highlights.json"
        if f.exists():
            items = json.loads(f.read_text(encoding="utf-8"))
            if items: out.append({"note": {k: n[k] for k in ("id", "title", "channel", "thumbnail", "kind")}, "items": items})
    out.sort(key=lambda g: max(h["created_at"] for h in g["items"]), reverse=True)
    return out
