# HANDOFF — 영상노트 (덮어쓰기)

**마지막 갱신:** 2026-10-11

## 지금 상태
- 된 것: 1~5차 묶음 전부(유튜브·웹 글·PDF·음성/영상 파일 입력, 대본·리포트·장면·마인드맵 v2·용어·번역·길이 조절, 채팅·하이라이트·통합 요약, 확장 템플릿·플래시카드·퀴즈, 인포그래픽·카툰(ComfyUI), 데스크톱 앱, 브라우저 확장). 2026-10-11: 채팅 콘솔 깜박임 제거, 글자 선택/복사, 채팅 복사 버튼, 기록 파일을 personal/로 정리. **verify.bat 완성**(headless, 18단계, 메인·worktree 2개 동시 실행 모두 통과, 커밋 98cccb6).
- 진행 중: 없음. 사용자 확인 대기(NOTSOLUTION 「사용자가 직접 할 일」 6건, C 27건).

## 다음에 할 일 (순서대로)
1. 사용자가 확장 설치·앱 재시작을 알려 주면 NOTSOLUTION 표를 확인한 뒤 완료로 바꾸고 날짜를 적는다.
2. NOTSOLUTION A의 남은 15건 중 사용자 확인으로 풀리는 것부터 정리.
3. 새 작업은 사용자 신호가 있을 때만 시작(묶음 3~5개, 측정 가능한 완료 기준을 먼저 OK 받기).

## 주의할 점
- 코드를 바꾸면 verify.bat으로 확인(결과 .verify/summary.md, 스크린샷 .verify/shots/). 새 화면은 verify/run.py의 SCENARIOS 목록에 한 줄 추가. 데이터 폴더는 환경변수 VN_DATA_DIR(backend/app/paths.py).
- git 커밋은 `git -c user.name=gusql -c user.email=devhanghang@gmail.com commit ...`(전역 설정 없음). push 금지.
- 8765의 `python -m http.server`는 건드리지 않는다(다른 프로그램). 영상노트는 8765~8775 중 빈 포트(보통 8766), ComfyUI는 127.0.0.1 고정.
- 릴리스(lilys.ai)에서 크레딧을 쓰는 동작은 사용자 허락 없이 하지 않는다. 로그인·결제·글쓰기 금지, 사용자 Chrome 로그인은 사용자가 직접.
- 서버 둘을 띄우지 않는다(data/server.lock). 테스트 서버는 처리 중 노트가 없을 때만. data/notes.db는 작업 전 백업(data/notes.db.bak-날짜).
- 이 폴더 밖 삭제·전역 설치 금지. data/pw-browsers(700MB)는 사용자가 직접 삭제 예정(tools/comfyui/dl은 2026-10-09 삭제 완료).
- 기록 규칙: personal/ 6개 파일(CHATS·PLAN·NOTSOLUTION·CHANGES·HANDOFF·ARCHITECTURE). 옛 루트 기록 원본은 data/_old/records-2026-10-11/.

## 참고 파일
- 프로젝트 규칙: CLAUDE.md / 기능 목록·계약: FEATURES.md, CONTRACT.md, DESIGN_DIRECTION.md
- 릴리스 조사·캡처: research/, design-ref/(compare/ 비교 캡처)
- 서버: backend/app/main.py / 화면: web/src/ / 데스크톱: app.pyw / 확장: extension/
