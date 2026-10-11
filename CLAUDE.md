# 영상노트 프로젝트 — Claude 작업 규칙

## 안전 가이드 (PC·계정·외부에 영향 주는 도구를 쓰기 전 기준)

**만져도 되는 것**
- 이 폴더(`C:\Users\gusql\Desktop\youtube-analyze`) 안의 파일, `backend/.venv`, `web/node_modules`, `data/`
- 화면 점검: Playwright(설치된 Chrome, 새 창·headless)로 `127.0.0.1` 영상노트만 열기. 릴리스 화면 확인은 사용자 Chrome의 새 탭에서 보기만
- 설치: `uv`(backend 안), `npm`(web 안), `ollama pull`(사용자 확인 후)
- 유튜브: yt-dlp로 공개 영상의 자막·720p 화면·오디오를 받아 처리 후 즉시 삭제

**절대 하지 않는 것**
- 로그인·비밀번호 입력, 글쓰기·댓글·메시지 전송, 결제
- 릴리스에서 크레딧을 쓰는 동작(노트·확장 리포트 생성)은 사용자 허락 없이 하지 않음
- 이 폴더 밖 파일 삭제, 다른 프로그램 종료(예: 8765를 쓰는 `python -m http.server`는 건드리지 않음)
- 전역 설치(`npm -g`, 시스템 pip), 시스템·보안 설정 변경
- 바탕화면 조작(Cua Driver 등)으로 다른 앱 클릭·입력

**멈추고 물어볼 때**
- 로그인·CAPTCHA·결제 화면이 나올 때
- 1GB 넘는 다운로드(모델 등), 이 폴더 밖을 지워야 할 때
- 같은 문제를 2번 시도해도 안 될 때(→ personal/NOTSOLUTION.md의 「A 나중에 고칠 것」에 적고 다음으로)

**실수했을 때 되돌리기**
- 코드: 바뀐 파일 목록을 personal/CHANGES.md에 남김 → 그 기록대로 되돌림
- 데이터: `data/notes.db`는 작업 전 `data/notes.db.bak-날짜`로 복사
- 처리 중 서버: 터미널에서 Ctrl+C, 또는 해당 포트 프로세스만 종료
- 받은 영상이 남았으면 `data/` 아래 임시 파일만 삭제

## 기록 규칙
- 기록 파일은 `personal/` 6개: CHATS.md(대화) · PLAN.md(계획·미룬 기능 큐) · NOTSOLUTION.md(사용자가 직접 할 일 / A 나중에 고칠 것 / B 받아들인 한계 / C 눈·귀로 확인 / 디자인 오류 + 상세 이력) · CHANGES.md(바뀐 점 + 릴리스와 달라진 점, 새 항목이 위, 세션별 파일 만들지 않음) · HANDOFF.md · ARCHITECTURE.md
- 옛 루트 기록(PLAN·NOT_SOLVED·LILYS_CHANGES·WORKLOG)은 data/_old/records-2026-10-11/에 보관
- 화면은 매번 design-ref/ 릴리스 캡처와 비교

## 안전 가이드 — 카툰용 ComfyUI (2026-10-09 추가)
- 만져도 되는 것: `tools/comfyui/` 폴더 안 설치·실행, 공식 출처(ComfyUI GitHub 릴리스, Hugging Face black-forest-labs·Comfy-Org) 다운로드(사용자 승인 11~15GB), `data/media/<id>/cartoon/` 이미지
- 절대 안 하는 것: 전역 설치(pip·시스템 Python), 127.0.0.1 외 주소로 ComfyUI 열기(`--listen 127.0.0.1` 고정), 다른 프로그램·8766 포트 종료, 로그인 필요한 모델 받기
- 멈추는 때: 다운로드가 로그인·약관 동의를 요구할 때, 디스크 여유 50GB 미만일 때
- 되돌리기: `tools/comfyui` 폴더 삭제(=설치 전 상태). 실행 중이면 ComfyUI 프로세스(python_embeded 경로)만 종료
