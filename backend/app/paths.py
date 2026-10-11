"""데이터 폴더 한 곳: 환경변수 VN_DATA_DIR(없으면 프로젝트/data). verify·worktree가 각자 폴더를 쓰게."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("VN_DATA_DIR") or ROOT / "data").resolve()
MEDIA = DATA / "media"
