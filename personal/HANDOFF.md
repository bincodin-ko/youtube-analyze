# HANDOFF — 영상노트 (덮어쓰기)

<!-- namunil:begin — 남은일이 자동으로 쓰는 칸. 고칠 때는 남은일 앱이나 namunil MCP로 -->
## 남은일 · 마지막 인계 2026-10-30 (자동)

(자동 인계 — Claude 가 남기지 않음) 마지막 답 앞부분:
장부 `personal/ledger.json`을 이 요청(prompt_id=9145ff9d)으로 쓰고, 항목 1개를 done으로 닫았습니다.

`data/` 아래에서 바뀐 파일은 제가 고친 게 아닙니다.
- 바뀐 파일은 `app.log`, `notes.db`, `media` 안의 jpg 3장입니다.
- 켜져 있던 영상노트 앱이 쓴 것으로 보입니다(짐작).
- 이번 일에서 제가 한 것은 `extension/` 폴더 목록 확인뿐입니다.

확장은 아직 Chrome에 다시 로드되지 않았습니다. 폴더 선택 창은 직접 누르셔야 합니다. 앞의 5단계로 추가하신 뒤 알려 주시면 확장이 실제로 동작하는지 확인하겠습니다.

열린 남은 일 0개
<!-- namunil:end -->


**마지막 갱신:** 2026-10-13

## 지금 상태
- 2026-10-13 밤: 릴리스 홈·노트 배치(31c74ba) 뒤, 앱 창 멈춤 고침(app.pyw Api._window), verify seed 칸 맞춤, verify --app 47/47. feature-mimic 스킬 v13 계정 업로드 완료.
- 2026-10-12~13 릴리스 확장 기능 가져오기(feature-mimic, mimic/lilys-ext/) 3묶음 + e2e 완료, 커밋 0394aa9: 인포그래픽·카툰 스타일 선택, 배경지식·반대 시각·심화조사 웹 출처+FLUX 삽화, 리포트 아래 👍👎↻·확장 추천·컬렉션, 추가 창 릴리스 구성, 글 템플릿 10개·표, 댓글분석, PPT(9스타일·장별 수정·PPTX), 팟캐스트(음성: Edge 403이라 윈도우 Heami로 대체), 애니메이션 SVG, 요약 도식·미니 목차·요점 접기·용어 질문, 앱 재시작 후 설정 유지(app.pyw private_mode=False). verify 42/42, ai-qa 6/6(복사본 .verify/e2e-data 사용).
- 된 것(이전): 1~5차 묶음 전부(유튜브·웹 글·PDF·음성/영상 파일 입력, 대본·리포트·장면·마인드맵·용어·번역·길이 조절, 채팅·하이라이트·통합 요약, 확장 템플릿·플래시카드·퀴즈, 인포그래픽·카툰, 데스크톱 앱, 브라우저 확장). 2026-10-11: 채팅 콘솔 깜박임 제거·글자 복사, 유튜브 링크 7종, 채팅 [시간] 토글, 크게 보기(왼쪽 영상·스크립트 칸 확장)·스페이스 2배속·유튜브 전체화면, 말소리 없는 영상 설명글 요약, 옛 코드 서버 재사용 방지, 용어 풀이 반복 수정, 기록 파일 personal/ 정리, 기록 정리(완료 항목 삭제).
- verify.bat: headless 42개 시나리오(약 50초), `--online`은 실제 유튜브 2개 추가.
- 진행 중: 없음. 사용자 확인 대기(NOTSOLUTION 「사용자가 직접 할 일」 5건, C 칸).

## 다음에 할 일 (순서대로)
1. 사용자가 앱 재시작을 알려 주면 NOTSOLUTION 표를 확인한 뒤 완료 처리(완료된 줄은 지운다).
2. NOTSOLUTION A의 열린 문제 중 사용자 확인으로 풀리는 것부터 정리.
3. 새 작업은 사용자 신호가 있을 때만 시작(묶음 3~5개, 측정 가능한 완료 기준을 먼저 OK 받기).

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

- pywebview js_api 객체(Api)에 창·큰 객체를 밑줄 없는 이름으로 붙이지 말 것: pywebview가 끝없이 훑어 창이 멈춤.
