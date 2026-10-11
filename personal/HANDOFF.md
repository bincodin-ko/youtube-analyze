# HANDOFF — 영상노트 (덮어쓰기)

**마지막 갱신:** 2026-10-11

## 지금 상태
- 된 것: 1~5차 묶음 전부(유튜브·웹 글·PDF·음성/영상 파일 입력, 대본·리포트·장면·마인드맵·용어·번역·길이 조절, 채팅·하이라이트·통합 요약, 확장 템플릿·플래시카드·퀴즈, 인포그래픽·카툰, 데스크톱 앱, 브라우저 확장). 2026-10-11: 채팅 콘솔 깜박임 제거·글자 복사, 유튜브 링크 7종, 채팅 [시간] 토글, 영상 크게 보기·PIP·2배속, 기록 파일 personal/ 정리, 기록 정리(완료 항목 삭제).
- verify.bat: headless, 기본 25/25 통과(36초). `--online` 옵션은 실제 유튜브로 player_real_2x(재생·2배속 시간 측정)까지 26/26 통과(48초). 실행: `cmd //c "C:\Users\gusql\Desktop\youtube-analyze\verify.bat --online"`.
- 진행 중: 없음. 사용자 확인 대기(NOTSOLUTION 「사용자가 직접 할 일」 5건, C 칸).

## 다음에 할 일 (순서대로)
1. 사용자가 확장 설치·앱 재시작을 알려 주면 NOTSOLUTION 표를 확인한 뒤 완료 처리(완료된 줄은 지운다).
3. NOTSOLUTION A의 열린 문제 중 사용자 확인으로 풀리는 것부터 정리.
4. 새 작업은 사용자 신호가 있을 때만 시작(묶음 3~5개, 측정 가능한 완료 기준을 먼저 OK 받기).

## 주의할 점
- 코드를 바꾸면 verify.bat으로 확인(결과 .verify/summary.md, 스크린샷 .verify/shots/). 새 화면은 verify/run.py의 SCENARIOS에 한 줄 추가. 데이터 폴더는 환경변수 VN_DATA_DIR.
- git 커밋은 `git -c user.name=gusql -c user.email=devhanghang@gmail.com commit ...`. push 금지.
- 8765의 `python -m http.server`는 건드리지 않는다. 영상노트는 8765~8775 중 빈 포트(보통 8766), ComfyUI는 127.0.0.1 고정.
- 릴리스(lilys.ai)에서 크레딧을 쓰는 동작은 사용자 허락 없이 하지 않는다. 로그인·결제·글쓰기 금지.
- 서버 둘을 띄우지 않는다(data/server.lock). 테스트 서버는 처리 중 노트가 없을 때만. data/notes.db는 작업 전 백업(data/notes.db.bak-날짜).
- 이 폴더 밖 삭제·전역 설치 금지. data/pw-browsers(700MB)는 사용자가 직접 삭제 예정.
- 터미널 창이 가끔 뜨는 문제는 사용자가 시점을 알려 줄 때까지 보류.
- 기록 규칙: personal/ 6개 파일. 완료·해결된 항목은 지운다(git이 옛 내용 보관). 옛 루트 기록은 data/_old/records-2026-10-11/.

## 참고 파일
- 프로젝트 규칙: CLAUDE.md / 기능 목록·계약: FEATURES.md, CONTRACT.md, DESIGN_DIRECTION.md
- 기록: personal/NOTSOLUTION.md, PLAN.md, CHANGES.md
- 점검: verify.bat, verify/run.py / 릴리스 조사·캡처: research/, design-ref/
- 서버: backend/app/main.py / 화면: web/src/ / 데스크톱: app.pyw / 확장: extension/
