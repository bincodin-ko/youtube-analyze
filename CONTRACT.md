# 1차 묶음 공통 약속 (프론트·백엔드·AI가 같이 따름)

## 폴더
```
backend/            uv 프로젝트 (Python 3.12)
  app/main.py       FastAPI: API + web/dist 정적 서빙 + /media
  app/db.py         sqlite3 (표준 라이브러리) — data/notes.db
  app/transcript.py 메타·자막(yt-dlp json3)·음성인식(faster-whisper)
  app/scenes.py     720p 화면만 받기 → 후보 장면 → jpg 저장 → 원본 삭제
  app/ai.py         요약 리포트·장면 고르기 (claude -p, 실패 시 Ollama)
web/                Vite + React + TypeScript + Tailwind v4 + shadcn/ui
data/               notes.db, media/<note_id>/*.jpg  (git 제외)
start.bat           명령 1개 실행: web 빌드(dist 없을 때) → uvicorn 127.0.0.1:8765 → 브라우저 열기
```

## API
| 메서드 | 경로 | 응답 |
|---|---|---|
| POST | `/api/notes` `{url}` | `{id}` (바로 반환, 처리는 백그라운드) |
| GET | `/api/notes` | `[{id, title, channel, thumbnail, duration, created_at, status}]` 최신순 |
| GET | `/api/notes/{id}` | Note 전체 (아래) |
| GET | `/api/notes/{id}/events` | SSE. `data: {"step":"transcript|summary|scenes|done|error","status":"start|done","message":"..."}` |
| GET | `/media/{id}/{file}` | 장면 jpg |

## Note JSON
```json
{
  "id": "78f1gpZXz4k-1759800000",
  "url": "https://www.youtube.com/watch?v=78f1gpZXz4k",
  "video_id": "78f1gpZXz4k",
  "title": "원제목", "channel": "채널", "thumbnail": "https://i.ytimg.com/...", "duration": 1234,
  "upload_date": "2026-09-24", "created_at": "2026-10-07T12:00:00",
  "status": "processing|done|error", "step": "transcript|summary|scenes|done", "error": null,
  "lang": "ko",
  "transcript": [ {"start": 0.0, "end": 14.2, "text": "문단 텍스트"} ],
  "report": {
    "title": "한국어 리포트 제목",
    "overview": "총평 2~3문장. **키워드**는 굵게",
    "key_points": ["핵심 요약 3~5줄"],
    "sections": [
      { "id": "1", "title": "소제목", "start": 0.0,
        "children": [
          { "id": "1.1", "title": "하위 소제목", "start": 14.0,
            "bullets": [ {"text": "문장", "refs": [2, 3]} ],
            "scene": {"time": 15.0, "file": "s_0015.jpg"} }
        ] }
    ]
  },
  "scenes": [ {"time": 15.0, "file": "s_0015.jpg"} ]
}
```
- `refs` = `transcript` 배열 인덱스. 화면에는 `[n]`(n=인덱스)으로, 클릭 시 `transcript[n].start`로 이동.
- `scene`은 없으면 `null`. 대본 줄은 5~20초 단위 문단으로 묶는다(릴리스 스크립트처럼).
- 모든 생성 글은 한국어(해외 영상도).
