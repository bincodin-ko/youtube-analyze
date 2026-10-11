"""구간 스크랩(브라우저 확장에서 보냄). data/clips.json 한 파일 — video_id로 노트와 연결."""
import json, secrets
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
FILE = Path(__file__).resolve().parents[2] / "data" / "clips.json"


def _load() -> list:
    try:
        return json.loads(FILE.read_text("utf-8"))
    except Exception:
        return []


class NewClip(BaseModel):
    video_id: str
    url: str = ""
    start: float
    end: float
    memo: str = ""
    title: str = ""


@router.post("/api/clips")
def add(b: NewClip):
    if b.end <= b.start or b.start < 0:
        raise HTTPException(400, "끝 시각이 시작보다 뒤여야 해요")
    c = {"id": secrets.token_hex(4), "created_at": datetime.now().isoformat(timespec="seconds"), **b.model_dump(), "memo": b.memo[:500]}
    FILE.parent.mkdir(exist_ok=True)
    FILE.write_text(json.dumps(_load() + [c], ensure_ascii=False, indent=1), "utf-8")  # ponytail: 동시 쓰기 잠금 없음(개인용)
    return c


@router.get("/api/clips")
def list_clips(video_id: str | None = None):
    return [c for c in _load() if not video_id or c["video_id"] == video_id]


@router.delete("/api/clips/{cid}")
def delete(cid: str):
    FILE.write_text(json.dumps([c for c in _load() if c["id"] != cid], ensure_ascii=False, indent=1), "utf-8")
    return {"ok": True}
