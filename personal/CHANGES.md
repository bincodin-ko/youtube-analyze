# CHANGES — 바뀐 점 · 릴리스와 달라진 점

> 날짜순, 새 항목이 위. 두 칸: 「바뀐 점」(날짜·무엇·왜·어디) / 「참고 서비스(릴리스AI)와 달라진 점」(날짜 / 릴리스는 / 우리는 / 왜).



## 2026-10-13 확장 추가 창 미리 선택 없앰
- 「확장 리포트 추가」 창을 열면 영상 노트는 「중요 인용구」가 미리 선택돼 있던 것을 없앰(아무것도 선택 안 된 상태로 열림, 「추가」는 고를 때까지 꺼짐). 왜: 사용자 요청. 어디: components/ExpandModal.tsx, verify/run.py 확장 시나리오 5곳.
- 참고 서비스와 달라진 점: 릴리스는 영상이면 「중요 인용구」를 미리 선택 / 우리는 선택 없음 / 사용자 요청.

## 2026-10-13 칸 크기 직접 조절 · 리포트 폭 넓힘 · 라이브러리 카드 축소·확대
- 노트 화면: 왼쪽(영상·스크립트)·가운데(리포트)·오른쪽(AI 채팅) 사이 경계선을 끌어 너비 조절(←/→ 키, Shift는 크게, 두 번 누르면 기본 330px). 가운데는 최소 420px 보장. 왜: 사용자 요청(요약이 좁게 떨어져 보임). 어디: components/Panes.tsx(Splitter·useLayout), pages/Note.tsx.
- 리포트 글 폭·여백: 머리줄 ↔ 버튼 메뉴에서 글 폭 480~1600px·꽉 채움, 양옆 여백 0~120px, 모두 기본값. 기본값을 560px+여백 60px → 900px+여백 32px로 넓힘(1440 화면에선 칸을 꽉 채움). 「크게 보기」는 같은 왼쪽 너비 값을 46vw로 바꾸는 방식으로 통합. 값은 localStorage vn-layout에 기억.
- 라이브러리·컬렉션 카드 크기 5단계(최소 150~440px): − / 슬라이더 / +, 목록 위에서 Ctrl+휠. 작게 하면 한 줄에 7칸(1440 기준), 크게 하면 2칸. localStorage vn-lib-zoom. 어디: pages/Library.tsx NoteGrid.
- 참고 서비스와 달라진 점: 릴리스는 칸 너비가 고정(끌기 없음) / 우리는 끌어서 조절 / 사용자가 직접 요청.

## 2026-10-13 데스크톱 앱이 안 켜지던 문제 · verify 시험 데이터 복사
- 앱 창 멈춤(응답 없음, 서버도 안 뜸): app.pyw의 창 기능 객체(Api)에 창을 `window`로 붙여 두어, pywebview가 화면용 함수 목록을 만들 때 창의 .NET 객체 속(AccessibilityObject.Bounds.Empty…)까지 끝없이 파고들며 UI 스레드를 막음 → `_window`로 바꿔 훑기 대상에서 뺌(pywebview는 `_`로 시작하는 이름을 건너뜀). 어디: app.pyw Api. 확인: 고친 뒤 창 Responding=True, /api/notes 응답, data/app.log 오류 0줄.
- verify 시험 데이터: 시험용 웹 글 노트(a24a0876c78)가 실제 DB에서 지워져 옛 백업에서 가져오는데, 옛 백업엔 deleted_at 칸이 없어 `SELECT *`가 실패 → 두 DB에 다 있는 칸만 옮김. 어디: verify/run.py seed(). 결과 verify --app 47/47.
- feature-mimic 스킬: 범위 3택·화면 대조표(1-2b)·완료 조건 넣은 zip을 claude.ai 사용자 지정 > Skills > feature-mimic > 교체로 올림(v12 → v13, 내용에 「가져올 범위」「1-2b」 확인).

## 2026-10-13 릴리스 홈·노트 화면 배치 맞춤(사용자 캡처 2장, 대조표 mimic/lilys-home/screen-diff.md)
- 홈: 큰 회색 「새로 추가하기」 상자 → 위 줄 오른쪽 검은 버튼. 「최근 노트」 3열 큰 카드 → 「라이브러리」 + 「→ 전체 보기」 + 212px 작은 카드(종류 아이콘·제목·유튜브/웹사이트·날짜). 어디: web/src/pages/Home.tsx
- 구독(새): 채널 링크 등록 → 최신 5개 중 노트 없는 영상 목록, 누르면 노트 만들기(자동 생성 안 함, 사용자 결정). 어디: backend/app/main.py /api/subs*, data/subs.json, pages/Subs.tsx(/subscriptions)
- 휴지통(새): 삭제는 휴지통으로(복원 가능), 영구 삭제는 휴지통에서만. 어디: db.py deleted_at 열, main.py /api/trash·/restore·?forever=1, pages/Trash.tsx
- 사이드바: 라이브러리 ⌄ 접기(기억) + 최근 노트 5개 + 컬렉션 + 휴지통, 「구독」 메뉴. 어디: components/Sidebar.tsx
- 노트(웹 글) 왼쪽 머리말: 제목 가운데 크게 + 바깥 링크 아이콘. 채팅 입력 문구 「무엇이든 요청하세요 (질문, 작성, 수정)」. 리포트 아래 「공유 & 내보내기 & 복사」 첫 안내(× 누르면 다시 안 뜸)
- 릴리스와 다른 점: 업그레이드·NOW·앰배서더·도움말·다운로드·계정·홍보 카드·일반모델·Notion/Slack은 넣지 않음(결제·계정·서버 추천 피드·외부 로그인 없음). 채팅 탭 이름은 「LILY」 대신 「채팅」(브랜드)
- 확인: verify --app 47/47(home·trash·subscriptions·home_390·note_article 시나리오 추가), ai-qa 6/6(카드 메뉴 Esc 검사는 라이브러리로 옮김), 실제 채널 구독 Y Combinator 추가·새 영상 5개·취소(임시 폴더)

## 2026-10-13 독립 검사(별도 에이전트)로 찾은 문제 고침
- 요약 아래 💡 추천이 이미 만든 리포트도 띄워 누르면 덮어씀 → 만든 것 빼기(요약 화면에서도 결과 목록을 읽음)
- 확장 리포트 삭제 키에 경로(..\)가 들어가면 폴더 밖을 지울 수 있던 것 → 영문·숫자·_만 허용(400)
- PPT 로고가 WEBP면 PPTX 실패 → PNG로 바꿔 넣음(자체 점검 추가)
- ↻ 다시 만들 때 「추가 프롬프트」가 빠짐 → 결과에 저장해 다시 보냄
- 팟캐스트 음성 만드는 중 새로고침하면 진행이 멈춘 것처럼 보임 → 이어서 확인
- Esc로 안 닫히던 창 3개(추가 창·↻ 확인·도식 크게 보기), ↻ 확인 창 포커스, 복사 실패 안내, 컬렉션 표시 갱신, PPT 수정본 오류 시 버튼 멈춤, 같은 레퍼런스 파일 다시 고르기, 도식 실패 시 「다시 시도」, 만드는 중 진행 막대
- 확인: verify --app 44/44(재발 방지 시나리오 inspector_fixes), ai-qa 6/6

## 2026-10-13 사용자 확인 없애기: 실제 앱 창 검사·Edge 음성 복구
- 무엇: verify `--app` 추가 — 앱(app.pyw)과 같은 옵션의 WebView2 창을 두 번 띄워 CDP로 스타일 창·PPT 창·앱 재시작 후 ☆ 유지까지 확인(verify/app_window.py·app_check.py). Edge 음성 403은 MS 새 주소(api.msedgeservices.com, edge-tts PR #491)로 우회 + 429는 쉬었다 재시도 → 실제 mp3 생성 확인.
- 왜: "내가 확인할 거 없게 만들어야지" — 사용자에게 넘긴 확인을 직접 함. 전역 Stop 훅 no_user_check.py도 추가(사용자 확인 요청 문장을 막음).
- 확인: verify --app 43/43, Edge 음성 engine=edge mp3 2개.

## 2026-10-13 e2e 버그 조사(ai-qa)로 찾은 버그 3개 고침
- 확장 리포트를 보다 「요약」으로 가도 주소에 ?ext=가 남아 새로고침하면 확장 탭이 열림 → 요약으로 가면 지움(재현 테스트 ai-qa/tests/youtube-analyze/bug-ext-url-summary.e2e.ts 실패→통과)
- 없는 키(?ext=zzz)로 들어오면 만들 수 없는 「만들기」가 뜸 → 마인드맵으로(bug-ext-url-invalid.e2e.ts 실패→통과)
- 폭 390px에서 추가 창·스타일 창·PPT 창이 화면 밖으로 넘침, 툴바 「요약」「기본」 글자가 세로로 쪼개짐 → 창 폭을 화면에 맞추고 글자 줄바꿈 막음(verify ext_narrow_390 실패→통과)
- 기타: ai-qa 설정이 실제 data/로 서버를 띄우던 것 → 복사본 .verify/e2e-data 사용으로 바꿈(C:/Users/gusql/Desktop/ai-qa/e2e.youtube-analyze.config.ts), 지워진 노트("Me at the zoo")를 쓰던 테스트 1개를 있는 노트로
- 확인: ai-qa 6/6, verify 42/42

## 2026-10-13 릴리스 확장 기능 3묶음 (spec K·L·M)
- 무엇:
  - 팟캐스트(이해 점검하기): 해설자 1명(이름·역할·동그란 머리글자)의 말풍선 문단 — 인사·다룰 내용 목록·본문·마무리. 우리만 추가: 「음성으로 듣기」(1순위 Edge 온라인 음성, 막히면 윈도우 내장 한국어 음성 Heami로 자동 전환), 읽는 문단 강조, 문단마다 ▷.
  - 애니메이션(시각자료): 쉬운 말 리포트(목차·도입·소제목 3개) + 소제목마다 AI가 그린 움직이는 SVG 도식(<animate>). SVG는 서버에서 스크립트·이벤트·외부 링크를 지우고 화면에서는 <img>로만 그림.
  - 요약 화면: 첫 소제목 아래 도식 한 장(처음 볼 때 한 번 AI로 만들어 diagram.svg 저장, 크게 보기), 오른쪽 미니 목차 줄(지금 읽는 곳 길게, 마우스를 올리면 목차), 핵심 요점 접기 ^, 용어 말풍선 안 「질문하기」 → 채팅 입력창.
- 확인: verify 41/41(시나리오 3개 + backend:podcast 자체 점검), 실제 생성(시험 복사본) 팟캐스트 14문단 28초·음성 2문단(윈도우 음성 wav), 애니메이션 SVG 3개 모두 <animate> 포함 35초.
- 어디: backend/app/templates.py(podcast·animation·clean_svg), podcast.py(새 파일, edge-tts LGPLv3 + 윈도우 SAPI), main.py(/podcast/audio·/diagram), web/src/components/Listen.tsx·SummaryBits.tsx(새 파일)·Expand.tsx·ExpandModal.tsx·ReportExtras.tsx, pages/Note.tsx

### 참고 서비스(릴리스AI)와 달라진 점 (2026-10-13)
- 팟캐스트 — 릴리스: 글만(음성 없음) / 우리: 글 + 음성으로 듣기 / 왜: 사용자 선택. Edge 온라인 음성은 이 PC에서 MS가 403으로 막아(2회 시도) 윈도우 음성으로 대신 읽음 → NOTSOLUTION A.
- 요약 도식 — 릴리스: 그림 AI 이미지 / 우리: AI가 그린 SVG 도식(한글 정확, 무료).

## 2026-10-13 릴리스 확장 기능 2묶음 (spec H·I·J)
- 무엇:
  - 「그 외」 칸에 릴리스 순서대로 글 템플릿 10개 추가: 스크립트(AI 없이 대본을 3분 단위 문단으로)·타임스탬프·교재·보고서·사용자 인터뷰(표)·문헌검토·투자 종목 분석(표)·투자 방법론·논문 리뷰·말씀. 리포트 안 표(table) 표시·Markdown 복사 지원.
  - 댓글분석(유튜브 노트만, 「더 깊이 이해하기」): yt-dlp로 공개 댓글을 좋아요 순 최대 150개 읽기만 → 분위기·공감 의견·비판·질문·시사점.
  - PPT(시각자료, NEW): 만들기 창(스타일 9종 3×3 견본·슬라이드 수 2–30 기본 5·커스텀 지시·레퍼런스 이미지 최대 4장) → 카드(▷ 슬라이드쇼·✎ 수정·⬇ PPTX) → 슬라이드 수정 창(지시 적은 장만 다시) / 슬라이드쇼(‹ › ←→ Esc).
  - 이름을 릴리스와 같게: 「블로그 글」→「블로그」, 「액션아이템 도출」→「내 액션아이템 도출」.
- 확인: verify 37/37, 실제 생성(시험 복사본) PPT 5장 8초·PPTX 5장 열어 글자 확인, 댓글분석 12개 댓글, 타임스탬프, 투자 종목 분석 표 1개.
- 어디: backend/app/templates.py(10개·TABLE_HINT·script_blocks·_comments), comments.py·ppt.py(새 파일), main.py(/ppt·/ppt/revise·/ppt.pptx·/ppt/ref), pyproject(python-pptx MIT), web/src/components/Ppt.tsx(새 파일)·Expand.tsx·ExpandModal.tsx, verify/run.py(시나리오 4개 + backend:ppt 자체 점검)

### 참고 서비스(릴리스AI)와 달라진 점 (2026-10-13)
- PPT — 릴리스: 슬라이드가 이미지(그림 AI), PPTX도 그림 / 우리: 슬라이드를 HTML로 그리고 PPTX는 글자 편집 가능한 상자 / 왜: 무료·한글 정확, 내려받은 뒤 고치기 쉬움. 스타일 이름 9개는 같지만 모양은 우리 해석(색·띠·테두리·글꼴).
- PPT 레퍼런스 이미지 — 릴리스: 슬라이드 그림에 반영 / 우리: 첫 장은 로고로 모든 슬라이드 구석에, 이미지들은 AI가 열어 보고 강조색·문체에 반영.
- 글 템플릿 10개 — 릴리스 결과를 보지 못해(크레딧) 고객센터 설명으로 형식을 정함(추측). 스크립트는 AI 없이 즉시.

## 2026-10-12 릴리스 확장 기능 1묶음 (mimic/lilys-ext/spec.md A~G)
- 무엇:
  - 인포그래픽·카툰은 「추가」 뒤 바로 만들지 않고 **스타일 선택 창**이 뜸. 인포그래픽 6종(원페이저·컬러풀·과학적·손글씨·미니멀·기업용), 카툰 6종(웹툰·사실적·일본 애니·치비·디즈니·코믹북), 미리보기, 「고급 설정 > 추가 프롬프트」.
  - 관련 배경지식·반대 시각 조사·**심화조사(새 템플릿)**는 claude가 웹을 검색(읽기만)해 문장마다 출처 칩(도메인)을 붙이고, 소제목마다 로컬 FLUX 삽화를 뒤에서 채움. 웹 검색이 안 되면 "웹 검색 없이 만들었어요" 표시.
  - 모든 리포트(요약 포함) 맨 아래에 👍👎↻·공유·다운로드·복사 줄, 「컬렉션 지정」 상자, 「💡 확장」 추천 3줄.
  - 추가 창을 릴리스 구성으로 바꿈: 추천(자료별)·나만의 템플릿·더 깊이 이해하기·시각자료·이해 점검하기·그 외(접기). ☆가 있으면 추천 자리가 「즐겨찾기」, 이미 만든 것은 흐리게, 영상 노트는 「중요 인용구」 미리 선택. 드롭다운 「…」 메뉴에서 삭제, 새 리포트가 위.
  - 확장 리포트 주소 `?ext=키`(새로고침해도 같은 리포트). 마인드맵에 ⓘ·🗑(확인 후).
  - [기존 변경] app.pyw가 사생활 모드여서 앱을 다시 켜면 ☆·크게 보기·채팅 시간 표시가 초기화되던 것 → 저장소 `data/webview` 유지.
- 왜: 사용자 요청 "릴리스를 빠짐없이 확인해 반영" — 릴리스 크롬 직접 탐색(크레딧 5회 허락받아 사용) 결과대로.
- 어디: backend/app/templates.py(WEB_FORMAT·deep·generate(opts)), cartoon.py(STYLES·illustrate), main.py(ExtOpts·/illust·/feedback·DELETE /mindmap), app.pyw, web/src/components/StylePicker.tsx·ReportFoot.tsx(새 파일)·Infographic.tsx(THEMES·Poster)·Expand.tsx·ExpandModal.tsx·Mindmap.tsx, pages/Note.tsx, web/public/styles/cartoon-*.jpg(로컬 FLUX로 만든 견본), npm `@fontsource/gaegu`(OFL 손글씨 글꼴), verify/run.py(시나리오 6개 + desktop:storage), verify/webview_storage.py

### 참고 서비스(릴리스AI)와 달라진 점 (2026-10-12)
- 인포그래픽 — 릴리스: 이미지 AI가 그림 한 장(스타일 6종) / 우리: 같은 6종을 HTML 테마(색·글꼴·모양)로 그림 / 왜: 무료 로컬 그림 모델은 한글 글자를 못 그림, HTML이면 한글이 정확하고 레이아웃 5종 전환·[n] 재생이 됨. 미리보기도 고정 그림 대신 실제 포스터 축소본.
- 카툰 — 릴리스: 칸 전체가 한 장의 이미지(말풍선 글자도 그림 안) / 우리: 칸마다 로컬 FLUX 그림 + 한국어 말풍선은 HTML / 왜: 같은 이유(한글), 칸별 다시 그리기 가능.
- 웹 출처·삽화 — 릴리스: 서버 검색·클라우드 그림 / 우리: claude CLI의 WebSearch·WebFetch(구독 안에서), 삽화는 로컬 FLUX(장당 20~40초, 글 먼저 보임) / 왜: 무료·로컬 조건.
- 리포트 아래 줄 — 릴리스: Notion·Slack 내보내기, 「아카이브로 이동」 / 우리: Notion·Slack 없음(외부 로그인 필요), 아카이브 대신 「컬렉션 지정」 / 왜: 로그인 금지 규칙, 우리 보관함 구조.
- 즐겨찾기 — 릴리스: 계정에 저장 / 우리: 이 PC(앱 저장소)에 저장 / 왜: 한 사람용 로컬 앱.
- 「💡 확장」 추천 — 릴리스에서 눌렀을 때 동작은 미확인(크레딧) → 우리는 누르면 바로 만듦.

## 2026-10-12 ai-qa 로 찾은 버그 3개 고침
- 메뉴(카드 더보기·요약 길이·확장 종류·노트 메뉴·공유·사이드바·라이브러리)가 Esc 로 안 닫힘 → 공용 `Backdrop`(바깥 누르기·Esc 닫기)으로 6곳 교체. 어디: web/src/components/Backdrop.tsx 외 6파일
- 검색 미리보기에 장면 파일 이름(s_0306.jpg)·번호 id 가 보임 → 검색 색인에서 `id`·`file` 값 뺌, 예전 색인은 시작할 때 다시 만듦(노트는 그대로, 백업 data/notes.db.bak-20261012). 어디: backend/app/db.py
- 확인: ai-qa 재현 테스트 3개 실패→통과(`ai-qa/tests/youtube-analyze/bug-*.e2e.ts`), verify 25/25

## 2026-10-11 크게 보기 때 꾹 누르기 2배속 복귀
- 무엇: 크게 보기일 때만 영상 가운데(위 56px·아래 136px 비움)를 꾹 누르면 2배속, 짧게 누르면 재생/정지. 작게 볼 땐 스페이스만
- 왜: 사용자 요청. 작은 영상은 버튼이 가운데에 흩어져 덮개가 가렸지만, 큰 영상은 위아래에 모여 비켜 갈 수 있음
- 어디: web/src/components/Stage.tsx(hold), Note.tsx, verify/run.py(player_big_hold, player_real_big)

## 2026-10-11 용어 풀이 반복·유튜브 전체화면·크게 보기 배치 수정
- 무엇 1: 「용어 풀이」(용어 전체 목록)가 소제목마다 반복됨 → 리포트 맨 끝에 한 번. 원인: <TermList>가 소제목 반복문 안에 잘못 들어가 있었음. 어디: web/src/pages/Note.tsx. verify note_video에 「용어 풀이 제목이 정확히 1개」 검사 추가
- 무엇 2: 유튜브 플레이어 전체화면 버튼이 안 눌림 → 원인: 꾹 누르기 2배속용 투명 덮개가 작은 플레이어(330×185, 유튜브 모바일형 화면)의 전체화면·음소거·설정·일시정지 버튼을 덮음. 덮개 제거. 유튜브 전체화면에 들어가면 데스크톱 앱 창도 같이 전체화면(pywebview js_api fullscreen). 어디: web/src/components/Stage.tsx, app.pyw Api
- 무엇 3: 2배속은 스페이스 누르고 있기만(영상 클릭 뒤에도 되게 포커스를 앱으로 되돌림). 마우스 꾹 누르기 2배속은 뺌 — 유튜브 임베드에는 자체 꾹 누르기 2배속이 없고, 덮개 없이는 iframe 안 마우스를 알 수 없음
- 무엇 4: 크게 보기 = 영상을 리포트 위에 얹던 방식(양옆 빈 공간) → 왼쪽 영상·스크립트 칸을 min(46vw, 100vw-770px)로 넓힘(1440에서 영상 661×372, 1920에서 882×496). 리포트는 오른쪽 그대로, 최소 440px. PIP는 영상이 늘 보이므로 제거. 어디: Note.tsx, Stage.tsx
- verify: player_pip 제거(기능 제거), player_big을 새 배치 검사로, player_hold2x에 덮개 없음 검사, --online player_real_2x에 「영상 클릭→재생→스페이스 2배→유튜브 전체화면 버튼」 검사. 25/25(--online 포함)
- 확인: 앱과 같은 WebView2(숨긴 창)에서 전체화면 버튼 → iframe 전체화면 + 창 전체화면 요청(fullscreen(True)) 기록 확인

### 릴리스와 달라진 점
- 2026-10-11 / 릴리스: 영상 위 마우스 꾹 누르기 배속 / 우리: 스페이스 누르고 있기만 / 왜: 유튜브 임베드 위에 덮개를 씌우면 유튜브 자체 버튼(전체화면 등)이 막힘

## 2026-10-11 실제 유튜브 링크로 직접 돌려 본 오류 3개 수정
- 무엇 1: 말소리 없는 영상(요리 쇼츠 등)은 음성 인식 0문단 → 요약 실패인데 「완료」로 저장돼 화면이 「장면 캡처 중」에서 영원히 멈춤. → 영상 설명글(링크·해시태그 줄 제외)을 대본 대신 사용, 설명글도 없으면 이유를 적은 오류. 요약이 없으면 「완료」 대신 오류로 끝냄. 화면도 완료+요약 없음이면 안내 문구 표시. 어디: backend/app/transcript.py fetch, backend/app/main.py process, web/src/pages/Note.tsx Progress 호출
- 무엇 2: 비공개·없는 재생목록이면 yt-dlp 영어 원문 오류가 그대로 보임 → 한국어 안내. 어디: backend/app/main.py playlist_preview
- 무엇 3: 앱을 다시 켜도 8765~8775에 옛 코드 서버가 떠 있으면 그걸 재사용해 고친 내용이 적용 안 됨 → /api/version(코드 수정 시각) 비교, 옛 서버면 /api/shutdown으로 끄고 새로 띄움. 어디: app.pyw running_port, backend/app/main.py
- 확인: 복사본 데이터 서버 + 설치된 Chrome headless로 「유튜브」 탭에 watch·youtu.be?si·&list=·shorts(말소리 있음/없음)·m.youtube·비공개 재생목록 7건 입력, 실제 앱과 같은 WebView2(숨긴 창)에서 노트 화면·유튜브 재생(시간 흐름) 확인
- 남은 점: 같은 영상을 여러 번 넣으면 노트가 여러 개 생김(중복 막기 없음)

## 2026-10-11 verify --online 추가
- 무엇: verify/run.py에 `--online` 옵션과 player_real_2x 시나리오(실제 유튜브 재생, 1배속 대비 스페이스 누르는 동안 1.6배 이상 빠른지 video.currentTime으로 측정). route 함수 인자를 키워드 전용으로(Playwright가 request를 2번째 인자로 넘기던 버그)
- 왜: 인터넷 차단 때문에 사용자에게 넘기던 실제 재생 확인을 자동화
- 어디: verify/run.py

## 바뀐 점

#### 2026-10-11 영상 크게 보기 · 떠 있는 PIP · 꾹 누르기/스페이스 2배속
##### 바뀐 점
- web/src/components/Stage.tsx(새): 플레이어를 fixed로 하나만 두고 자리표시자(왼쪽 열 / 크게 보기 때 리포트 위)의 위치·크기를 매 프레임 따라감 → iframe을 다시 만들지 않아 재생이 안 끊김. 크게 보기에서 슬롯이 스크롤로 나가면 리포트 영역 오른쪽 아래 400px PIP(닫기 버튼, 채팅 패널은 안 가림). 투명 덮개: 짧은 클릭=재생/일시정지, 0.4초 이상 누르면 2배속(+「2배속 ▶▶」 표시), 스페이스(입력창·버튼 포커스 아닐 때) 0.3초 이상 누르면 2배속·짧게 누르면 재생/일시정지. 유튜브가 2배를 지원 안 하면 getAvailablePlaybackRates 중 최대.
- web/src/pages/Note.tsx: 플레이어 부분만. 「크게 보기」 버튼(위 아이콘·아래 글자), 크게 보기 동안 왼쪽 열 접고 끝나면 복원, localStorage `vn-big` 유지, 로컬 영상(`<video>`)도 같은 Stage 사용(오디오는 기존 그대로). 1100px 미만은 기존 「영상 · 스크립트」 탭에서 100% 폭.
- verify/run.py: player_big · player_pip · player_hold2x · player_space_input 4개 추가. 전체 25/25.
##### 고른 이유(디자인 용어)
- 점진적 공개: 기본은 작게, 필요할 때만 크게 보기. PIP(떠 있는 플레이어)로 리포트를 읽으며 영상 유지. 덮개 아래 48px은 유튜브 컨트롤 막대용으로 비움.
##### 릴리스와 달라진 점
- 2026-10-11 / 릴리스는 330px 고정 / 우리는 크게 보기·PIP·꾹 누르기 2배속(유튜브 앱 방식) / 사용자 요청.
#### 2026-10-11 유튜브 탭 링크 7종 허용 · 채팅 [시간] 표시 토글
##### 바뀐 점
- web/src/api.ts: `isListUrl`이 영상 ID가 있는 링크(`watch?v=..&list=..`)는 재생목록으로 보지 않음(원인: list= 가 있으면 무조건 목록 미리보기로 가서 「소화하기」가 안 나옴). `ytId`에 `live/` 추가. 재생목록 전용(`playlist?list=`)·채널 링크는 그대로 목록 미리보기.
- web/src/components/Chat.tsx: 입력창 아래 「시간 표시」 스위치(aria-pressed, 포커스 링). 끄면 답변의 [n] 버튼과 앞 공백을 지움. localStorage `chatTime`(try/catch)로 기억, 기본 켜짐.
- verify/run.py: 시나리오 3개 추가(new_yt_links 7종, chat_time_off 새로고침 유지, chat_time_on). 전체 21/21.
#### 2026-10-11 headless verify (verify.bat) · 데이터 경로 환경변수화
##### 바뀐 점
- backend/app/paths.py(새 파일): 데이터 폴더를 한 곳에서 정함 — 환경변수 `VN_DATA_DIR`, 없으면 기존 프로젝트/data. 왜: verify·worktree가 각자 데이터 폴더를 써야 동시 실행이 안전함(server.lock도 그 폴더 기준이라 자동으로 분리).
- backend/app/db.py·main.py·chat.py·highlights.py·clips.py·combine.py·templates.py: 하드코딩된 `data/` 경로를 paths.py의 DATA/MEDIA로 바꿈(동작은 그대로, 환경변수 없으면 같은 경로).
- backend/app/cartoon.py: ComfyUI 포트를 환경변수 `VN_COMFY_PORT`로 바꿀 수 있게(기본 8188).
- verify.bat + verify/run.py(새 파일): 웹 빌드·린트 → 백엔드 자체 점검(files·scenes·transcript, 네트워크 없음)·임포트 → 실제 data에서 노트 3개를 .verify/data로 복사(원본은 읽기 전용) → 빈 포트 서버 → Playwright headless 9개 화면 시나리오 + 스크린샷(.verify/shots/) → .verify/summary.md, 실패 시 exit 1. AI 호출·쓰기 요청(POST 등)과 외부 주소는 막아 결정적으로 돈다. worktree에 node_modules가 없으면 그 안에서 npm ci, .venv는 uv가 그 안에 만듦. 시험 데이터 원본은 `VN_SEED_DIR`(기본: 메인 저장소의 data/).
##### 되돌리기
- git: `git revert 98cccb6` (커밋 하나에 위 변경 전부).

#### 2026-10-11 채팅 콘솔 깜박임 제거 · 글자 선택/복사 · 채팅 복사 버튼
##### 바뀐 점
- backend/app/__init__.py: Windows에서 모든 subprocess에 CREATE_NO_WINDOW를 붙임. 왜: 채팅 때마다 claude 콘솔 창이 깜박였음. 대조 시험: 패치 없을 때 cmd.exe 창이 잡힘 / 패치 후 채팅 중 새 창 0개.
- app.pyw: pywebview text_select=True. 왜: 기본값 False가 앱 전체의 글자 선택·복사를 막고 있었음.
- web/src/components/Chat.tsx: 메시지마다 복사 버튼, 클립보드 API가 실패하면 execCommand로 대체. 확인: Playwright로 클립보드 82자 확인, design-ref/compare/chat-copy_PC.png.
- 테스트 채팅 메시지 2쌍은 chat.json에서 지움(백업 chat.json.bak-2026-10-11).
- 기록 파일 정리: 루트의 PLAN.md·NOT_SOLVED.md·LILYS_CHANGES.md·WORKLOG.md를 personal/PLAN.md·NOTSOLUTION.md·CHANGES.md로 옮김(원본은 data/_old/records-2026-10-11/).
##### 되돌리기
- 위 3개 코드 파일의 변경 취소. chat.json은 chat.json.bak-2026-10-11로 복원.

#### 2026-10-09 마인드맵 넓게 보기
- 바뀜: web/src/components/Mindmap.tsx(autoFit 끔, 시작 100%·뿌리 왼쪽 세로 중앙, "전체 보기"/"100%" 버튼, 박스 높이 calc(100vh-48px)·최대폭 1800, 열릴 때 박스로 스크롤), web/src/pages/Note.tsx(확장+마인드맵이면 좌우 패널 접고 나갈 때 복원), web/src/index.css(`fullscreen` 변형 추가: 기존엔 없어 전체화면에서 박스가 반쪽이었음)
- 확인: Playwright(Chrome headless) 1440·390, 노드 글자 화면 크기 13px(zoom 1.0), 캡처 design-ref/compare/mindmap-v3-1440.png·-fit·-full, mindmap-v3-390.png. [m:ss] 클릭·노드 클릭 채팅 채움·전체화면(1440 실제 전체화면 True) 동작. npm run build 성공. 8790 서버는 종료함.
- 알려진 한계: 100%에서 지도 높이(약 1470px)가 박스(약 760px)보다 커 위·아래 가지는 끌어서 이동. 390px 위쪽 "요약" 버튼 줄바꿈은 기존.
- 되돌리기: 위 세 파일을 이전 내용으로.

#### 2026-10-09 카툰
- 추가: backend/app/cartoon.py(콘티·ComfyUI 기동·워크플로·잡 상태), templates.py 「cartoon」 항목, main.py `POST/GET /api/notes/{id}/cartoon`(?panel=n 은 그 칸만), web Cartoon.tsx, Expand.tsx 분기·폴링, Infographic.tsx에서 PNG 저장 함수(posterPng)·ICONS·pal 분리(export), tools/comfyui(설치+README), .gitignore, CLAUDE.md 안전 가이드.
- 확인: 8칸 생성(첫 165초/두 번째 89초), VRAM 최대 11.5GB, Playwright 캡처, web npm run build 성공. 테스트 서버 8795·8796과 ComfyUI는 종료함.
- 바뀐 파일을 되돌리려면 위 목록의 파일을 이전으로, 설치는 tools/comfyui 삭제.

#### 2026-10-09 마인드맵 v2
##### 바뀐 파일
- backend/app/mindmap.py: 전면 교체(리포트 전체+[m:ss] 입력, 상세도 3종 프롬프트, chat._stream_claude 재사용 스트리밍, 없는 시각 제거 clean)
- backend/app/main.py: POST /api/notes/{id}/mindmap?level= 스트리밍(끝에 NUL+마크다운 또는 NUL+ERR:), GET은 level별 파일
- web/src/components/Mindmap.tsx: 상세도 선택·진행 표시·가지별 색·13px·클릭 처리·화면 맞춤·PNG 스타일 보강
- web/src/pages/Note.tsx: 상세도별 상태·스트리밍 생성·onSeek/onAsk 연결·section에 @container
- web/src/components/Chat.tsx: 「로 시작하는 인용은 그대로 입력창에 채움
- data/media/*/mindmap.md → mindmap.md.old
- 되돌리기: 위 파일을 이전 내용으로(옛 mindmap.md.old 이름을 되돌리면 옛 파일 복원)
##### 확인한 방법
- 8791 테스트 서버에서 세 상세도 생성(NOT_SOLVED 상세 참조). Playwright(Chrome headless) 1440·390px: 노드 60개·시각 링크 39개, [m:ss] 클릭 시 영상 위치 이동(1440은 4:28, 390은 영상 탭 전환 2:06), 노드 클릭 시 입력창 채움(390은 채팅 탭 전환). 캡처 design-ref/compare/mindmap-v2-1440*.png, mindmap-v2-390*.png, -progress, -short
- npm run build 성공. 8791 서버는 내가 띄운 것만 종료
##### 직접 확인할 것 / 나중에
- NOT_SOLVED.md B·D 2026-10-09 마인드맵 v2 항목

#### 2026-10-09 채팅 탭 · 마인드맵 PNG 글꼴 · 기사 군더더기 · 번역 병렬
##### 변경 파일
- web/src/pages/Note.tsx: 1100px 미만 위쪽 탭에 '채팅' 추가(오른쪽 패널을 탭 폭 전체로, 접기 버튼은 큰 화면만), 번역 진행(2초 폴링, "번역 중 n/m", 끝난 줄 한국어·나머지 원문 흐리게)
- web/src/components/Mindmap.tsx: PNG 저장 시 Pretendard woff2를 base64로 SVG <style>에 넣고 document.fonts.ready 후 그림, 흰 배경 2배
- web/src/api.ts: getTranslation/translateNote가 {texts, partial, done, total, busy, err} 반환
- backend/app/article.py: trafilatura favor_precision=True + clean()(짧은 메뉴 단어·저작권·기자 이메일 문단 제거) + assert 자체 확인
- backend/app/translate.py: 25문단 묶음 4병렬(ThreadPoolExecutor), 번호 붙은 JSON 프롬프트, 개수 틀리면 반으로 쪼개 재시도, 실패 시 동시 2개로 재시도, 백그라운드 작업(JOBS)
- backend/app/main.py: POST /translate는 시작만, GET /translate가 진행 상황 반환
- 되돌리기: 위 파일들을 이전 내용으로(번역 저장 형식 transcript_ko.json은 그대로라 기존 번역본 호환)
##### 확인한 방법
- 1: Playwright(Chrome headless) 390·900px, 채팅 탭에서 textarea 입력, 하이라이트 탭 보임, 가로 스크롤 0(입력창 x=30, 폭 331/841). 캡처 design-ref/compare/chat-tab_390.png, chat-tab_900.png, chat-tab_hl_390.png, chat-tab_hl_900.png
- 2: 다운로드한 PNG 880x952, 배경 흰색(255,255,255), 한글 Pretendard로 열어 확인 design-ref/compare/mindmap-png.png(+crop). 임베드 유무 A/B(임베드 Pretendard 굵게 vs 명조 대체) 확인
- 3(전→후, 기본→favor_precision+필터): 연합뉴스 17→13문단(931→789자), 네이버 8→8, 한겨레 6→5. 지운 문단: 연합 'rock@yna.co.kr'·'제보는 카카오톡 okjebo <저작권자(c) 연합뉴스, 무단 전재-재배포, AI 학습 및 활용 금지> … 송고'(+favor_precision이 '송고 2026년10월08일…'·'구글 검색에서 연합뉴스 기사를 우선적으로 보여줍니다.' 제거), 한겨레 '정환봉 기자 bonge@hani.co.kr', 네이버 없음
- 4: Rob Pike 강연(31분, 영어 100문단 35,317자). 이전 방식(60문단 순차) 121.8초 → 새 방식(25문단 4병렬) 36.9초(묶음 완료 32.6/33.9/34.8/36.9초). 중간 도중 문단 합침으로 개수 틀림이 잦아(처음엔 190초) 프롬프트를 번호 객체로 바꿔 해결. 진행 캡처 translate-progress.png(번역 중 3/4), translate-done.png
- npm run build 성공. 테스트 서버는 8781에 띄웠다가 내가 띄운 것만 종료
##### 직접 확인할 것 / 나중에
- NOT_SOLVED.md D·A 2026-10-09 항목

#### 2026-10-09 인포그래픽
- 추가: templates.py(infographic 항목·ICONS·레이아웃 5종 검증), web/src/components/Infographic.tsx(새 파일, 800px 포스터·레이아웃 전환·PNG 2배), Expand.tsx(인포그래픽 분기·하단 버튼 foot 공용화). main.py 변경 없음(기존 /ext 라우트 그대로).
- 확인(포트 8791, 종료함): 영상 노트 78f1gpZXz4k 생성 8초, 웹 기사 노트 6초(목표 60초 이내). 레이아웃 5종 전환·PNG 저장(1600px, Pretendard)·[n] 버튼 확인. 캡처 design-ref/compare/infographic_*.png (1440·390, 다크 포함). npm run build 성공.
- PNG 저장은 Mindmap.tsx 함수가 따로 없어(인라인) 같은 방식(base64 글꼴+SVG foreignObject→canvas)으로 새로 작성.
- 되돌리기: Infographic.tsx 삭제, Expand.tsx의 Infographic import·분기·foot, templates.py의 infographic·ICONS 제거.

#### 2026-10-09 브라우저 확장
##### 변경
- extension/ 새 폴더(manifest MV3, background.js 포트 탐색·서버 호출, content.js 유튜브 구간 바·Alt+S/E, popup.*, icons 16/32/48/128, make_icons.py, README.md)
- backend/app/clips.py 새 파일(POST/GET/DELETE /api/clips, data/clips.json), main.py: CORS(chrome-extension:// 출처만) + clips 라우터 등록 try 블록 1곳
- web/src/components/Clips.tsx 새 파일, Note.tsx: import 1줄 + `<Clips>` 1줄(유튜브 영상 노트만). npm run build 성공
##### 확인 방법
- Playwright 번들 Chromium(data/pw-browsers)에 확장 로드, 서버 8785: 구간 2개 저장·영상/웹 글 보내기·앱 스크랩 목록·클릭 재생 확인. 캡처 design-ref/compare/ext-*.png. 테스트 데이터 삭제, 8785만 종료(8765·8766 그대로)
##### 되돌리는 법
- extension/·clips.py·Clips.tsx 삭제, main.py의 [clips] try 블록·Note.tsx의 Clips 2줄 제거, data/pw-browsers 삭제

#### 2026-10-09 데스크톱 앱 로딩 화면 · 기록 파일 하나로
##### 변경
- app.pyw: 창(pywebview)을 먼저 띄워 로딩 화면(LOADING HTML: 로고·문구·진행 막대, 다크·움직임 줄이기 대응) 표시 → start_server()가 백그라운드에서 서버를 띄우고 준비되면 load_url로 앱 화면 전환. 60초 안에 안 켜지면 화면에 사유 + data/app.log
- 기록: sessions/*.md 12개를 이 WORKLOG.md 하나로 합침(원본은 data/_old/sessions-2026-10-09), CLAUDE.md 기록 규칙 수정
- 창 2개 열리는 동작은 사용자 선호로 유지(NOT_SOLVED B)
##### 확인 방법
- 바로가기 실행 → 2.2초에 "영상노트" 창 + 로딩 화면, 20.6초에 서버 응답 후 홈 화면으로 자동 전환(창 영역 캡처로 확인, 다른 창이 함께 찍혀 캡처 파일은 삭제)
##### 직접 확인할 것
- 로딩 화면 모양, 전환이 자연스러운지

#### 2026-10-09 데스크톱 앱(바탕화면 아이콘)

##### 추가
- app.pyw: 서버(uvicorn)를 같은 프로세스에서 빈 포트(8765~8775)로 띄우고 pywebview(BSD-3, WebView2) 전용 창으로 엶. 이미 떠 있는 영상노트가 있으면 그 서버로 창만. 창 닫으면 종료(처리 중 노트는 다음 실행 때 이어서 처리 — server.lock)
- app.ico: 로고와 같은 모양 + 라임 점(Pillow로 생성)
- install.bat: uv sync → web 빌드(없을 때) → `app.pyw --install`로 바탕화면 "영상노트.lnk" 생성
- backend 의존성: pywebview 6.2.1(+pythonnet)

##### 확인 방법
- install.bat 실행 → C:\Users\gusql\Desktop\영상노트.lnk 생성, 대상 pythonw.exe app.pyw, 아이콘 app.ico 확인
- 바로가기 실행 → 13초 뒤 서버 응답, 창 제목 "영상노트" 보이는 창 확인(EnumWindows). 첫 실행은 느려서 테스트 창 3개가 쌓였던 것을 정리 후 한 번 다시 실행
- 처음 시도한 install.bat은 긴 줄에 한글이 섞여 cmd가 줄을 깨뜨림('ofile' 오류) → 바로가기 생성을 Python(app.pyw --install)으로 옮겨 해결

##### 지우는 법
- 바탕화면 "영상노트" 아이콘만 삭제(데이터는 data 폴더에 그대로)

##### 나중에 고칠 것 / 직접 확인할 것
- NOT_SOLVED.md A·D의 [데스크톱 앱] 항목

#### 2026-10-08 번역 대본·삭제·컬렉션 관리
##### 추가
- backend/app/translate.py(새), main.py: GET/POST /api/notes/{id}/translate, DELETE /api/notes/{id}(처리 중 409), PUT/DELETE /api/collections/{id}; db.py: delete_note·rename_collection·delete_collection
- web: components/NoteMenu.tsx(새: 결과 화면 … 메뉴 + 삭제 확인 모달), Note.tsx Script 번역 토글·… 메뉴, Library.tsx 카드 삭제, Sidebar.tsx 컬렉션 … 메뉴(이름 바꾸기·삭제), api.ts 함수 5개·Note 타입(lang, collection_id)
##### 확인(포트 8786 임시 서버, 끝나고 종료)
- 번역: Me at the zoo(en) 토글 → 한국어 표시 5~18초(첫 호출 11초 포함), data/media/<id>/transcript_ko.json 저장. 한국어 노트엔 토글 없음.
- 삭제: 노트 삭제 후 목록·검색·data/media 폴더·FTS 행 모두 사라짐(노트 10→8, FTS 8).
- 컬렉션 이름 바꾸기·삭제(노트는 컬렉션 없음으로 남음) UI로 확인.
- 캡처: design-ref/compare/v3-*_PC_light.png
##### 정리로 지운 것 (백업 data/notes.db.bak-2026-10-08-c)
- 노트 jNQXAC9IVRw-1791461369, jNQXAC9IVRw-1791461324 (Me at the zoo 중복; -1791461255만 남김) + 그 media 폴더
- 컬렉션 "하네스 공부"(노트 2개는 남김, 컬렉션 없음 상태). "기술 트렌드 [쇼츠]"는 유지
##### 고칠 것·직접 확인
- NOT_SOLVED.md D 항목 참고

#### 2026-10-08 확장 리포트 템플릿·플래시카드·퀴즈

##### 추가
- backend/app/templates.py (새 파일): 템플릿 12종, 나만의 템플릿(data/templates.json), generate()
- main.py: /api/templates(GET·POST·PUT·DELETE), /api/notes/{id}/ext(GET), /ext/{key}(POST·DELETE) 추가만
- web/src/components/Expand.tsx, ExpandModal.tsx, ExpandCards.tsx (새 파일)
- web/src/pages/Note.tsx: import 1줄, useExpand, 툴바 ExpandMenu, 확장 탭을 ExpandBody로 감쌈
- ai.py: STYLES["long"] 프롬프트만 변경

##### 바꾼 파일 (되돌리기 목록)
ai.py(long 한 줄), main.py(라우트 블록 `# ---- 확장 리포트 템플릿` 삭제), Note.tsx(위 4곳), 새 파일 4개 삭제. data/media/78f1.../report_long.json은 .old로 이름만 바꿔 두고 새로 생성.

##### 확인한 것(방법)
- 3개 동시 생성 15·17·24초, 플래시카드·퀴즈 16초, 나만의 템플릿을 다른 노트에서 13초 (8790 서버, 끝나고 내가 띄운 것만 종료)
- 길게 기본 4592자→8550자(단독 64초)·11577자(4개 동시 107초)
- npm run build 성공. Playwright 1440px 캡처 design-ref/compare/ours-expand-*.png + expand-modal_lilys-vs-ours.png, 콘솔 에러 0, 디자인 오류 1건(소제목 여백) 고침
##### 나중에 고칠 것 / 눈으로 확인
NOT_SOLVED.md 4차 템플릿 항목 참조 (8766 재시작 필요, 모바일 폭 미캡처, 생성 글 품질).

#### 2026-10-08 새 노트 화면 오류 수정 · start.bat

##### 추가·변경
- web/src/api.ts: 처리 중 노트의 null 값(제목·채널·날짜·대본)을 빈 값으로 채움(listNotes·getNote 공통)
- web/src/pages/Note.tsx: 날짜 없으면 숨김, 단계가 끝날 때마다 노트 다시 불러오기(대본 먼저 표시), 빈 상태 문구·채널 동그라미 정리
- start.bat: 8765~8775 빈 포트 자동 선택, 이미 떠 있으면 브라우저만 열기, CRLF

##### 확인 방법
- Playwright(설치된 Chrome)로 /new → 링크 입력 → 소화하기: 수정 전 `Cannot read properties of null (reading 'split')`로 빈 화면 → 수정 후 바로 진행 화면 → 21초 뒤 자동으로 리포트 표시, 페이지 오류 0건. 해외 영상이 한국어로 요약됨
- start.bat 직접 실행: 8765가 다른 프로그램에 점유된 상태에서 8766으로 기동, 두 번째 실행은 브라우저만 열고 종료

##### 나중에 고칠 것
- PLAN.md 미룬 기능 큐: 장면 [mm:ss] 재생 버튼 / 2차 후보: 재생목록 자동 처리

##### 직접 확인할 것
- 새 링크 넣고 "소화하기" → 홈으로 튕기지 않고 진행 화면 → 리포트까지 자동으로 넘어가는지

#### 2026-10-08 보관함·검색·내보내기·재생목록 (H1~H3 + 재생목록)

##### 추가
- backend/app/db.py: collections 테이블, notes.collection_id(ALTER TABLE ADD COLUMN, 기존 5개 노트 유지), notes_fts(FTS5 trigram, 리포트·대본 JSON에서 글자만 뽑음, 트리거로 자동 동기화), search()(3글자↑ MATCH, 2글자↓ LIKE), collections()/add_collection()/get_collection(), list_all(collection_id)
- backend/app/export.py(새): to_md / to_html(장면 base64) / to_pdf(Playwright channel="chrome")
- backend/app/transcript.py: playlist() — yt-dlp extract_flat, 앞 10개, 채널은 /videos 탭
- backend/app/main.py: /api/playlist/preview, /api/playlist, /api/collections(GET·POST), /api/collections/{id}, PUT /api/notes/{id}/collection, /api/search, /api/notes/{id}/export?fmt=md|html|pdf, 새 노트 step "queued"(처리 시작 시 transcript)
- backend/pyproject.toml: playwright 의존성
- web: pages/Library.tsx(새: 라이브러리·컬렉션·검색·NoteGrid 카드 … 메뉴), components/ShareMenu.tsx(새), Sidebar.tsx(컬렉션 목록·새 컬렉션, 돋보기→/search), New.tsx(재생목록 칩·목록·안내), Home.tsx(NoteGrid 사용), App.tsx(라우트 3개), api.ts(함수 추가), Note.tsx(공유 버튼 자리 → ShareMenu, import 1줄)

##### 확인(방법: uvicorn 127.0.0.1:8770 + Playwright 설치된 Chrome headless)
- 검색: "하네" 2건(LIKE), "하네스" 2건(MATCH), "루프 엔지니어링" 1건, 결과 클릭 → 노트 이동
- 컬렉션: 사이드바에서 "하네스 공부" 생성 → 라이브러리 카드 … → 지정 → API count 1
- 내보내기(78f1gpZXz4k-1791302454, 브라우저 다운로드): md 15,446B / html 1,662,095B(장면 13장, 열어서 13장 모두 로드) / pdf 1,403,735B(2.2초). 전체 복사 → 클립보드 9,148자
- 재생목록 PLZ9oz3tuRsNgJ2c2-Y9ZQ1x1cnmwFFhAt(6개 중 1개 빼고 5개): 컬렉션 자동 생성, 5개 모두 done, 약 2분(노트별 17~33초, 합 113.7초)
- npm run build 성공. data/work 비어 있음(임시 파일 없음)
- 캡처: design-ref/compare/ours-{home,library-card-menu,collection,collection-progress,collection-done,search-2char,search-3char,share-menu,share-menu-copy,new-playlist,export-html}_PC_light.png, 나란히 비교 side-{home,share-menu,new-playlist,sidebar-collection}.jpg
- 테스트로 만든 데이터: 컬렉션 "기술 트렌드 [쇼츠]"(노트 5개), "하네스 공부"(78f1… 노트) — 지우기 기능이 없어 남김

##### 나중에(NOT_SOLVED A)
- 서버 2개 동시 실행 시 db.init이 다른 서버의 처리 중 노트를 error로 바꿈
- 대기 중 제목 미리 채우기는 재생목록 재실행으로 확인 안 함

##### 눈으로 확인할 것(D)
- 카드 2열 크기, 공유 메뉴 모양(공유 탭 없음)

##### 되돌리기
- 위 파일들 원복 + data/notes.db.bak-2026-10-08 복사(컬렉션·검색 테이블은 남아도 옛 코드에 영향 없음)

#### 2026-10-08 길이·난이도·용어 풀이
##### 추가·변경
- backend/app/ai.py: summarize(note, style), STYLES, _kind(article 분기), regroup_scenes, terms
- backend/app/main.py: GET/POST /api/notes/{id}/report?style=, GET /api/notes/{id}/terms (data/media/<id>/report_<style>.json, terms.json; DB 변경 없음)
- web/src/components/ReportExtras.tsx(새): LengthMenu, RichT(밑줄·팝오버), TermList
- web/src/pages/Note.tsx: 가운데 리포트만(길이 상태, 진행 표시, RichT, TermList), 기존 LengthMenu 삭제
##### 확인
- 노트 78f1gpZXz4k-1791302454: 짧게 36초/길게 54초/쉽게 37초, 재선택 0.2초, 기본 복귀 동작, 글자수 1272/6212/3458(기본 5980)
- Playwright(Chrome headless 1440px): 용어 밑줄 15개, hover 팝오버 "G스택…", 클릭 팝오버 "프롬프트…" 텍스트 확인. 캡처 design-ref/compare/ours-length-menu|easy, ours-term-popover|list
- npm run build 성공. 테스트 서버 8791 띄웠다 종료.
##### 나중에 고침 / 직접 확인
- NOT_SOLVED.md 요약의 3차 항목 참조(길게가 기본과 비슷, 용어 밑줄은 기본 기준, 품질·모바일 터치 확인)
##### 되돌리기
- 위 파일 4개 + 새 파일 1개 삭제/복원. data/media/78f1.../report_*.json, terms.json 삭제.

#### 2026-10-08 최종 통합 (1~4차 묶음 완료)

##### 추가 (각 기능 상세는 같은 날 sessions/ 개별 기록)
- 3차: 웹 글·기사 입력, 용어 풀이, 짧게/기본/길게/쉽게, 해외 영상 번역 대본, 노트 삭제·컬렉션 관리
- 4차: 확장 리포트 템플릿 12종 + 나만의 템플릿, 플래시카드·퀴즈, 여러 노트 통합 요약, 하이라이트·메모(+모아보기), PDF·음성·내 영상 파일 입력, 서버 잠금(server.lock)·재시작 시 이어서 처리
- 메인 수정: ai._kind를 article·pdf·audio·localvideo로 확장, chat.py 추천 질문·답변 프롬프트에 적용(assert 확인)

##### 정리
- 테스트 서버 전부 종료 → web 다시 빌드 → 8766에 하나만 기동
- DB 백업 data/notes.db.bak-2026-10-08-final 후 테스트 노트 10개 삭제(Joel Test 중복 3, wsj 실패 4, 업로드 테스트 3: pdf untitled·audio test·video short) → 노트 13개, data/uploads 비어 있음

##### 확인 방법
- Playwright(Chrome headless) PC 1440×900·모바일 390×844로 홈·라이브러리·하이라이트·/new·영상 노트·기사 노트·영어 영상 노트 캡처: 페이지 오류 0, HTTP 4xx/5xx 0, 가로 스크롤 0

##### 나중에 고칠 것 / 직접 확인할 것
- NOT_SOLVED.md 맨 위 요약 A·D·디자인 오류 참고

#### 2026-10-08 내 파일 입력 + 서버 잠금

##### 추가·변경
- 새 파일: backend/app/files.py
- 수정: backend/app/{main,db,transcript,scenes}.py, backend/pyproject.toml(pypdf·python-multipart, dev: reportlab), web/src/{api.ts, pages/New.tsx, pages/Note.tsx, pages/Library.tsx}
- 기록: NOT_SOLVED.md, LILYS_CHANGES.md
- 백업: data/notes.db.bak-2026-10-08-d
- 되돌리기: New/Note/Library/api의 수정 전 사본은 스크래치 bak 폴더(Library·api는 썸네일/타입 수정 후 사본)

##### 확인한 것(방법)
- PDF 4쪽 16.0초·음성 75초 55.2초·영상 59초 25초 모두 done (curl 업로드, 8785)
- localvideo [n]·스크립트 클릭 → video.currentTime, 음성 [n] → audio.currentTime (Playwright)
- 서버 2개: 처리 중 두 번째 서버 → error 안 됨; 강제 종료 후 재시작 → 이어서 done (복사본 폴더 8786~8788)
- web npm run build 성공, tsc --noEmit 오류 없음
- 캡처: design-ref/compare/files-*.png (1440 + 모바일 1장)

##### 나중에 고칠 것
- NOT_SOLVED.md "4차 내 파일" 항목 참고(두 번째 서버 워커 유지, 콘솔 404)

##### 직접 확인할 것
- 진짜 PDF·mp3·mp4 업로드, 끌어다 놓기, 큰 파일, 테스트 노트 3개 정리, 8766 재시작

#### 2026-10-08 통합 요약 + 하이라이트·메모 (4차 묶음)

##### 추가
- backend/app/combine.py, backend/app/highlights.py (새 파일)
- web/src/components/Highlights.tsx, web/src/pages/Combined.tsx (새 파일)

##### 바꾼 파일 (되돌릴 때 이 목록 기준)
- backend/app/main.py: combine·highlights 라우터 등록(try 블록 1개)
- web/src/App.tsx: /combined/:id, /highlights 라우트
- web/src/components/Sidebar.tsx: "하이라이트" 메뉴
- web/src/pages/Library.tsx: NoteGrid 체크박스(sel/onSel), 컬렉션 화면 통합 요약 바·목록
- web/src/components/Chat.tsx: PanelTabs, quote 인용, 자료 종류별 문구, textarea 글자색
- web/src/pages/Note.tsx: import 3줄, useReportNotes 훅, data-report·data-sec 속성, 오른쪽 탭, SelectionMenu·HighlightLayer·DeepLink
- NOT_SOLVED.md, LILYS_CHANGES.md (덧붙임)

##### 확인한 것 (Playwright 1440px headless, 8795 임시 서버 → 종료)
- 통합 요약: 컬렉션 노트 4개 17초, 비교표 포함, 출처 18개 검증, 출처 클릭 시 /note/<id>?t= 이동
- 하이라이트: 드래그 3번 → 하이라이트 2·메모 1 저장, 새로고침 후 [2,1] 다시 칠함, 탭·모아보기 표시, 모아보기에서 본문 위치로 이동, 채팅 인용 입력
- 웹 글 노트 채팅 문구 "글/본문" 확인
- npm run build 성공
- 캡처: design-ref/compare/ours-combine-*, ours-highlight-*, ours-highlights-*, ours-chat-article-wording (라이트·다크)

##### 나중에 고칠 것
- chat.py 프롬프트의 "영상 대본" 표현, 같은 문장 중복 시 첫 위치만, 모바일 터치 드래그

##### 직접 확인할 것
- 실제 마우스 드래그 느낌, 다크 노란색, 통합 요약 글 품질·출처 라벨 가독성, 테스트로 남은 하이라이트 3개·통합 요약 1개 정리

#### 2026-10-08 채팅(G1·G2)
- 추가: backend/app/chat.py(GET/POST /api/notes/{id}/chat, SSE 스트리밍, claude 실패 시 Ollama), web/src/components/Chat.tsx
- 변경: main.py(라우터 include), Note.tsx(오른쪽 채팅 자리 -> <Chat/>, Send import 제거)
- 검증: 포트 8767 임시 서버 + Playwright(Chrome headless). 추천 질문 3개, 질문 2개 연속, [n] 클릭 시 스크립트 줄 이동, Shift+Enter 줄바꿈. 캡처 design-ref/compare/ours-chat-*.png
- 나중에 고침: 모바일 채팅 없음, 첨부/@/웹 아이콘 미동작
- 눈으로 확인: 마스코트·문구, 답변 품질
- 되돌리기: chat.py·Chat.tsx 삭제, main.py의 chat include 4줄과 Note.tsx <Chat/> 줄 원복

#### 2026-10-08 2차 묶음 통합 점검

##### 추가 (상세는 같은 날 chat / library-export-playlist 기록과 각 에이전트 보고)
- 마인드맵(확장 탭, markmap, PNG), 채팅(추천 질문 3개·근거 [n]·대화 이어가기), 보관함(컬렉션·FTS5+LIKE 검색), 내보내기(md/html/pdf/복사), 재생목록·채널 링크 자동 처리
- 1차 잔여: 소제목 출처 [번호], 소제목 시간순 정리, 장면 밑 [mm:ss] ▶

##### 확인 방법
- 테스트용 서버 3개(8766 옛 코드, 8770, 8777) 종료 → web 다시 빌드 → 8766에 하나만 기동
- API: 목록·검색("하네")·컬렉션·마인드맵·채팅 응답 확인
- Playwright(Chrome headless) 1440px: 홈·라이브러리·결과·확장 화면 캡처, 페이지 오류 0, 390px 가로 스크롤 없음(scrollWidth 390)

##### 나중에 고칠 것 → NOT_SOLVED.md 요약 A / PLAN.md 큐
- 노트 삭제·컬렉션 관리 없음, 1100px 미만 채팅 안 보임, 마인드맵 PNG 글꼴, 서버 2개 동시 실행 시 처리 중 노트가 error로 바뀜

##### 직접 확인할 것 (D)
- 라이브러리 카드: 제목이 2줄인 카드만 높이가 달라 줄이 살짝 어긋남
- 마인드맵 글자 크기, 채팅 아이콘·문구, 답변 품질

#### 2026-10-08 웹 글·기사 입력

##### 추가
- backend/app/article.py(새): trafilatura로 본문 추출 → 문단 배열(start=문단 번호), 본문 이미지 최대 15장 다운로드(data/media/<id>/a_NN.jpg, 240x140 미만 제외), 대표 이미지 thumb.jpg(없으면 회색)
- 의존성: trafilatura 2.3.1 (Apache-2.0, 상업 가능) — backend/pyproject.toml·uv.lock
- web New.tsx: 알약 탭 유튜브/웹사이트, Note.tsx: ArticlePanel(원문 접이식, [n] 클릭 → 스크롤+강조), 처리 단계 문구 "본문 읽는 중/이미지 고르는 중"

##### 변경
- db.py: kind 칼럼(ALTER ADD, 기본 video), 목록 SUMMARY에 kind. main.py: POST /api/notes가 유튜브 아니면 article, process 분기(article.fetch, 장면=본문 이미지), 실패 시 제목=도메인
- api.ts: Note.kind 타입. Note.tsx: Ref·소제목 title, 장면 [mm:ss]·라이트박스 재생 버튼은 웹 글에서 숨김
- 되돌리기: 위 파일 변경 취소 + article.py 삭제. DB 백업 data/notes.db.bak-20261008-article

##### 확인 방법 (서버 8782, 내가 띄웠다가 종료)
- 실제 처리 6건: 네이버뉴스 21초·연합뉴스 12초·한겨레 24초·BBC(영문→한국어 리포트) 33초·블로그(Joel on Software 영문, 77문단) 약 50초 모두 done, WSJ 유료 기사 → "본문을 가져올 수 없어요(로그인·유료 기사이거나 글이 없는 페이지)"
- 문단/이미지/고른 장면: 네이버 8/2/1, 연합 17/1/1, 한겨레 6/5/3, BBC 40/5/3, Joel 77/0/0
- Playwright(Chrome headless 1440): design-ref/compare/article-*.png 7장 확인, npm run build 성공

##### 나중에 고칠 것 / 직접 확인할 것
- NOT_SOLVED.md 요약 A·D·디자인 오류의 [3차 웹글] 항목 참조

## 참고 서비스(릴리스AI)와 달라진 점

#### 2026-10-09 카툰 요약 (릴리스 「카툰」 모방 — 확장 > 시각자료)
- 추가: 확장 템플릿 「카툰」(시각자료). 4~8칸 콘티(claude -p) → 칸마다 그림(로컬 ComfyUI + FLUX.2 klein 4B) → 격자 화면(넓으면 2열·좁으면 1열), 한국어 말풍선·캡션은 HTML, 칸의 [n] 클릭 시 그 시점 재생, PNG 한 장 저장(Pretendard 포함), 칸별 다시 그리기, 「n/8칸 그리는 중」 진행 표시.
- 대체: 그림 모델이 없거나 실패하면 「그림 모델 없이 만든 간단 버전」(아이콘 칸 + 말풍선).
- 릴리스와 차이: 릴리스는 서버 이미지 생성(클라우드), 우리는 내 PC GPU(약 10GB 모델 설치 필요).

#### 마인드맵 v2 — 릴리스보다 자세하게 (2026-10-09)
- 릴리스: 짧은 명사구(약 10~15자) 3단계, 깊이별 보라. 우리: 4단계 설명형(결론→섹션→"소주제—결론"→숫자·사례 든 55자 이내 문장+[m:ss]), 상세도 간단/보통/자세히, 처음부터 전부 펼침(부록 가지만 접음), 가지별 6색(첫 색 릴리스 보라), 글자 13px.
- 릴리스에 없는 것: [m:ss] 클릭 → 영상 이동, 노드 글 클릭 → 채팅 입력창에 "「노드」 이 부분 자세히 설명해줘" 채우기, 화면 맞춤 버튼. 같은 것: markmap 왼→오 트리, 회색 박스·하단 바, PNG 저장.

#### [2026-10-09] 작은 화면 채팅 · 번역 진행 표시
- 릴리스에서 확인한 모바일 화면 구성과 달리 우리는 1100px 미만에서 위쪽 탭을 "영상 · 스크립트 / 리포트 / 채팅" 3개로 둠(채팅 탭 안에 채팅·하이라이트).
- 번역: 릴리스에는 대본 번역 토글이 따로 없어 비교 불가. 우리는 끝난 묶음부터 한국어로 보이고 나머지는 흐린 원문 + "번역 중 n/m" 표시.

#### [2026-10-09] 인포그래픽 구현 방식 차이
- 릴리스: 이미지 생성 AI로 그림 인포그래픽(스타일 선택, 월 2회 무료). 우리: claude -p가 리포트 내용에서 JSON(layout·blocks·takeaway)만 만들고 React로 도식을 그림 — 한글 깨짐 없음, 레이아웃 5종(단계·비교·수치·타임라인·순환) 즉시 전환, [n] 클릭 시 그 시점 재생, 횟수 제한 없음, PNG 2배 저장. 스타일 선택·그림 느낌은 없음.

#### [2026-10-09] 크롬 확장: 이름·화면 새로, 구간 스크랩 추가
- 릴리스 확장(LilysAI - Save and Summarize Everything)은 웹 페이지·유튜브를 클라우드로 보내 요약해 저장하는 클리퍼. 영상노트 확장은 같은 "보내기"에 더해 내 PC(127.0.0.1)로만 보내고, 영상 구간 스크랩(Alt+S/E)과 노트 화면의 스크랩 목록이 추가됨. 릴리스 쪽 구간 스크랩 기능 유무는 스토어 설명에서 확인 못 함.
- 로그인·계정 없음, 외부 전송 없음. 이름·로고·문구는 영상노트 자체 것.

#### 내 파일 입력: PDF·영상/음성 파일 (2026-10-08)
- 릴리스 「자료 가져오기」의 PDF·영상/음성 파일 탭을 모방(알약 탭 + 끌어다 놓기 영역). 릴리스 업로드 화면은 로그인 뒤라 직접 못 보고 design-ref/new-source_PC_light.jpg의 탭 모양만 참고.
- 다른 점: PDF는 글자 PDF만(스캔 OCR 없음), 쪽 이미지는 안 가져옴. 내 영상·음성은 노트 왼쪽에서 바로 재생되고 [n]·스크립트 클릭으로 이동(릴리스는 업로드 영상 재생 방식을 못 봄). 원본은 이 PC에만 저장, 노트 삭제 시 같이 삭제.
- 홈 카드 썸네일은 종류 아이콘(문서·음성 파형·필름).

#### 여러 노트 통합 요약 + 하이라이트·메모 (2026-10-08)
- 릴리스 「멀티 자료」는 한 프로젝트에 자료 여러 개를 넣고 통합 요약+자료별 리뷰. 우리는 이미 만든 노트를 컬렉션 화면에서 2~10개 체크해 합침(릴리스 무료 10개와 같은 상한). 결과는 공통 주제·노트별 차이·비교표·종합 결론이며 별도 화면(/combined/<id>)과 컬렉션 안 목록에 저장. 출처는 [노트제목 n]으로 해당 노트 그 시점 이동.
- 릴리스 하이라이트·메모(드래그)는 로그인 후 화면이라 직접 못 봄(문서 설명만 참고). 우리는 드래그 → 하이라이트/메모/채팅에 질문 떠 있는 메뉴, 노란 배경(다크는 반투명 노랑), 오른쪽 「채팅|하이라이트」 탭, 사이드바 "하이라이트" 모아보기(노트별 묶음)로 구현. 릴리스의 날짜·리포트별 정렬 전환은 없음(최근 노트 순 고정).
- 채팅 패널 문구는 자료 종류(영상·글·문서·음성)에 맞춰 바뀜.

#### 확장 리포트 추가·플래시카드·퀴즈 (2026-10-08)
- 릴리스처럼: 확장 탭 툴바 "마인드맵▾" 드롭다운에서 만든 확장 리포트 전환, "확장 리포트 추가" 창(카테고리별 2열 카드·별·나만의 템플릿 "만들기"·취소/"N개 추가").
- 다른 점: 카테고리는 추천/나만의 템플릿/더 깊이 이해하기/노트 형식/시각자료/이해 점검하기(릴리스는 같은 카드를 여러 카테고리에 중복 배치, 인포그래픽·댓글분석 없음). 템플릿은 우리 문구로 새로 씀. 별은 즐겨찾기 표시만. 나만의 템플릿은 창 안에서 이름+지시문 폼으로 만들고(⚙로 수정·삭제), 결과는 소제목+문장+출처 [n] 형식으로 고정. 플래시카드·퀴즈는 릴리스 화면을 직접 보지 못해 일반적인 형태로 설계(카드 뒤집기, 4지선다·해설·근거·최종 점수).
- 길게 리포트 프롬프트를 하한 지정으로 강화(기본 대비 약 2배, 단독 생성 60초대).

#### 웹 글·기사 입력 (2026-10-08)
- 릴리스 「웹사이트」 탭 모방: /new 알약 탭 「유튜브」「웹사이트」(PDF·파일·녹음·책 탭은 없음). 입력창 안내 "https://...", 버튼 "소화하기".
- 결과 왼쪽: 릴리스는 원본 페이지를 보여 주지만 우리는 본문을 추출해 "원문" 문단 목록(번호 [n])으로 보여 주고, 리포트 출처 [n] 클릭 시 그 문단으로 스크롤 + 2초 강조. 사이트명·날짜·원문 링크 표시.
- 소제목·장면 밑 [mm:ss] ▶ 와 "이 장면부터 재생"은 웹 글에서 숨김(시간 개념 없음).
- 번역 대본(원문|한국어 토글), 노트 삭제(… 메뉴·확인 모달), 컬렉션 이름 바꾸기·삭제 추가: 릴리스 … 메뉴 모방(컬렉션 지정·삭제). 휴지통은 없음(바로 삭제, 되돌릴 수 없음)

#### 길이·난이도 + 용어 풀이 (2026-10-08)
- 릴리스 짧게/기본/길게/쉽게 메뉴 모방. 릴리스의 "커스텀 옵션 추가"·"설정"은 아직 없음(4차 나만의 템플릿). 우리는 기본 포함 현재 선택을 메뉴 위에 표시하고 체크 표시.
- 릴리스 "해설"(문장 클릭 → 쉬운 설명) 대신 용어 자동 추출: 용어마다 첫 등장에 점선 밑줄 + hover/클릭 팝오버, 리포트 맨 아래 "용어 풀이" 목록.

#### H1~H3 보관함·검색·내보내기 + 재생목록 (2026-10-08)
- 컬렉션: 릴리스 "프로젝트"·휴지통 대신 사이드바 라이브러리 아래 컬렉션 목록 + "+ 새 컬렉션"(이름 입력 후 Enter). 휴지통·이름 바꾸기·삭제 없음. 노트 넣기는 노트 카드 … 메뉴(릴리스는 결과 화면 … 메뉴 "컬렉션 지정").
- 검색: 사이드바 돋보기 → 검색 화면(/search). 제목·리포트·대본, 3글자 이상 FTS5 trigram, 2글자 이하 LIKE. 결과에 어디서 찾았는지(리포트/대본)와 앞뒤 글 + 라임 강조.
- 공유 메뉴: 릴리스 탭 "공유·내보내기·복사" 중 공유(나만 보기/비밀번호/링크 공개)는 로컬 앱이라 뺌 → "내보내기·복사" 2탭. 내보내기는 Markdown / HTML(장면 이미지 base64 한 파일) / PDF(Playwright, 설치된 Chrome) 줄을 누르면 바로 다운로드, 복사는 "전체 복사(Markdown)". Markdown에는 장면 이미지 대신 "(장면 mm:ss)" 표시, 출처는 [mm:ss] 유튜브 시점 링크.
- 재생목록·채널: 릴리스처럼 /new 입력창에 재생목록(list=)·채널(@이름) 링크 → 칩(재생목록 이름·개수, × 지우기) + 영상 목록(썸네일·제목·길이·× 빼기), 한 번에 10개까지. 버튼은 릴리스 "프로젝트 생성" 대신 "N개 소화하기". 재생목록 이름으로 컬렉션을 만들고 영상마다 노트를 순서대로 처리, 컬렉션 화면에서 카드마다 "대기 중/대본 받는 중/요약 중/장면 고르는 중" + 완료 막대. 안내 문구는 새로 씀.

#### F1 마인드맵 (2026-10-08)
- 릴리스: 「마인드맵」 드롭다운(확장 탭 안) + 노드 풍부. 우리: 확장 탭에 마인드맵 하나, 3단계까지 펼침(요점은 클릭해 펼침), 보라 가지·검정 뿌리.
- 소제목 출처 [mm:ss] → [번호], 장면 이미지 밑 `[mm:ss] ▶` 추가.

#### [2026-10-08] 채팅(LILY 패널 대응)
- 릴리스: 마스코트+제안 문구, 오른쪽 칩, 탭 "LILY/하이라이트", 입력창 모델 선택(일반), Gemini 안내.
- 우리: 탭은 "채팅" 하나, 마스코트는 새 아이콘, 추천 질문 3개는 영상마다 처음 한 번 Claude가 만들어 data/media/<id>/chat.json에 저장. 답은 대본 근거 [n] 보라 버튼(클릭 시 플레이어 이동), 모델 선택은 "일반" 글자만(동작 없음), 하단 안내는 "영상 대본을 근거로 답해요". 하이라이트 탭 없음.

#### [2026-10-07] 장면 캡처 후보 수 상한: 영상 1분당 약 3장
- 릴리스: 캡처 개수 기준 비공개.
- 우리: 화면 전환 후보가 많으면 변화량이 큰 순으로 1분당 3장까지만 남김(16분 영상 → 48장, 저장 약 3~5MB). 문단마다 붙는 그림은 이 후보 안에서 AI가 고름.
- 이유: 내 PC 디스크·AI 장면 고르기 시간(후보 이미지를 모두 열어 봄) 절약. FEATURES D3(개수 제한 없음)와 다르므로 필요하면 상한을 풀 수 있음.

#### [2026-10-07] 영상 처리는 한 번에 1개씩(대기열)
- 릴리스: 클라우드에서 여러 영상을 동시에 처리.
- 우리: 내 PC 백엔드 스레드 1개가 순서대로 처리. 두 번째 링크는 앞 영상이 끝날 때까지 대기.
- 이유: 로컬 실행(GPU 12GB를 음성인식과 공유), 코드 단순화. 동시 처리가 필요해지면 작업 스레드 수만 늘리면 됨.

#### [2026-10-07] 프론트 1차: 채팅 자리·확장 탭·길이 메뉴는 비활성
- 릴리스: 오른쪽 LILY 채팅·하이라이트, 「확장」 템플릿, 짧게/길게/쉽게 길이 메뉴, 라임 업그레이드 버튼, 공유 메뉴가 모두 동작.
- 우리: 3단 배치는 같고, 채팅은 "다음 단계에서 열림" 입력창만, 확장·짧게/길게/쉽게·공유는 비활성 표시, 라임 버튼 없음. 라임은 "이 장면부터 재생"과 진행 단계 점에만.
- 이유: 1차 범위(FEATURES 2번 다음 단계), 업그레이드 없는 로컬 앱.

#### [2026-10-07] 리포트 생성 방식 (AI 담당)
- 릴리스: 한 줄 총평 → 목차 → 번호 소제목마다 번호 매긴 문장 + 출처 [n] + 장면 이미지.
- 우리: 같은 구조(총평·핵심요약 3~5줄·section→child→bullet{text,refs})를 claude -p(sonnet)로 한 번에 생성. 장면은 별도 호출에서 Claude가 후보 jpg를 직접 보고 문단당 1장 선택(중복 배정 없음, 맞는 장면 없으면 없음). 릴리스에 있는 키워드 링크·화자 구분은 아직 없음.
- 이유: 구독 로그인 사용(추가 비용 없음), 한도 초과 시 Ollama 대체(장면은 시간 범위 가운데 후보).

#### [2026-10-07] 처리 진행 표시를 결과 화면 안에서
- 릴리스: "프로젝트 생성"을 누르면 바로 결과 화면(digest)으로 넘어가 리포트가 스트리밍으로 채워진다. 별도 진행 화면 없음.
- 우리: 똑같이 바로 결과 화면으로 넘어가고, 리포트 자리에 4단계(자막 받는 중 → 요약 중 → 캡처 중 → 완료) 표시 후 내용이 채워진다.
- 이유: FEATURES A2(단계 표시)를 릴리스 흐름 안에 맞춤. 로컬 처리는 단계별 시간이 길어(음성인식·캡처) 단계 표시가 필요.

#### [2026-10-07] 자료 가져오기: 유튜브 탭만, 버튼 문구 "소화하기"
- 릴리스: 자료 종류 알약 탭 6개(유튜브·PDF·웹사이트·영상/음성 파일·실시간 녹음·책) + 링크 칩 최대 10개 + "프로젝트 생성" 버튼.
- 우리: 같은 배치(가운데 제목 → 알약 탭 → 넓은 입력창)를 쓰되 탭은 "유튜브" 하나만 보이고, 링크 1개, 버튼 문구는 "소화하기".
- 이유: 첫 버전 범위(유튜브만, FEATURES A1). 동작하지 않는 탭은 두지 않음. 문구 원문은 새로 만든다는 규칙.

#### [2026-10-07] 결과 화면 구성: 고정 탭 대신 요약/확장 + 3단
- 릴리스: 2026년 현재 결과 화면은 3단(왼쪽 영상+스크립트 / 가운데 리포트 「요약·확장」 + 짧게·기본·길게·쉽게 / 오른쪽 LILY 채팅·하이라이트). 블로그글·마인드맵은 「확장」 템플릿으로 생성.
- 우리: 이 3단 배치를 그대로 따르되, FEATURES의 C3 블로그글(그림 요약)을 「요약」 기본 결과로 둔다(릴리스도 기본 리포트 안에 장면 캡처를 문단 사이에 넣음).
- 이유: FEATURES.md가 블로그글을 가장 중요 기능으로 지정. 릴리스 최신 구성과 충돌 없음.

#### [2026-10-07] 다크 모드 추가
- 릴리스: 공식 다크 모드 없음(prefers-color-scheme dark로 캡처해도 화면 동일, 설정 메뉴에도 없음). CSS에 .dark 규칙은 일부 있으나 미완성.
- 우리: 라이트/다크 모두 제공. 다크는 릴리스 라이트 색(배경 #f4f5f4, 글자 #0c0d08, 포인트 라임 #dfff32)을 뒤집어 새로 설계.
- 이유: FEATURES.md 디자인 원칙(라이트/다크 모드).

#### [2026-10-06] 문단마다 장면 고르기를 Claude Code 비전으로
- 릴리스: 블로그글 문단에 장면 캡처를 붙여 줌(고르는 방식 비공개).
- 우리: 대본 시각으로 문단의 시간 창을 정해 후보 장면(1fps 화면 변화+중복 제거)을 좁히고, 후보가 여러 장이면 `claude -p`가 이미지를 보고 하나를 고름. 막히면 로컬 Ollama 비전 모델로 대체.
- 이유: 유료 API 금지(이미 쓰는 Claude Code Max만 사용), 로컬 실행 조건. Max 사용량 한도에 따라 느려질 수 있음.

#### [2026-10-06] 채팅은 RAG 없이 대본 전체를 넣는 방식
- 릴리스: 방식 비공개(긴 자료도 처리).
- 우리: 영상 1개 대본 전체(6k~25k 토큰)를 시간표시 포함해 통째로 넣고, 답변에 [mm:ss] 근거를 달게 한 뒤 실제 대본 구간과 맞는지 코드로 확인.
- 이유: 영상 1개는 Claude·Qwen3.5·Gemma 4 컨텍스트에 충분히 들어가 검색 단계가 불필요하고 근거 누락이 적음. 여러 영상 교차 질문(다음 단계)이 생기면 bge-m3/KURE 임베딩 추가.

#### [2026-10-06] 요약·채팅 AI: 유료 클라우드 LLM 대신 Claude Code Max(headless) + 로컬 Ollama 대체
- 릴리스: 회사 서버에서 유료 클라우드 LLM(종류 비공개)으로 요약·채팅·번역.
- 우리: 1순위 내 PC의 `claude -p`(내 Max 구독 로그인, 수정 안 한 공식 CLI), 한도 소진·오프라인 때 Ollama 로컬 모델(Gemma 4 12B 또는 Qwen3.5-9B)로 자동 전환.
- 이유: 완전 무료 조건(추가 API 비용 금지). Anthropic 문서상 구독 로그인은 "본인의 일반적·개인적 사용"에 한해 허용되므로 남에게 배포·판매하는 순간 API 키 방식으로 바꿔야 함.

#### [2026-10-06] PDF 내보내기는 브라우저 인쇄 엔진으로
- 릴리스: PDF·Notion·DOCX·Markdown 등 내보내기(서버 생성).
- 우리: Markdown·이미지 포함 HTML(캡처를 base64로 넣은 한 파일)은 직접 만들고, PDF는 같은 HTML을 브라우저 "PDF로 저장" 또는 Playwright page.pdf()로 만든다. Notion 내보내기는 없음.
- 이유: WeasyPrint는 Windows에서 MSYS2+Pango 설치가 필요해 번거롭고, 브라우저 엔진은 한글 웹폰트·화면과 같은 모양을 그대로 낸다. Notion은 계정·API 연결이 필요.

#### [2026-10-06] 보관함 검색: 한국어 2글자 검색은 느린 방식으로 처리
- 릴리스: 서버 검색(방식 비공개)으로 노트 제목·내용 검색.
- 우리: SQLite FTS5 trigram 색인(3글자 이상은 빠른 색인 검색) + 2글자 이하는 LIKE 전체 훑기. 형태소 분석(조사 떼기)은 없음.
- 이유: 로컬·무료. 내 PC Python 3.12 내장 SQLite 3.49.1에서 실측: trigram은 "영상을"·"인공지능"은 찾지만 "영상"·"요약"(2글자)은 못 찾음, LIKE는 모두 찾음. 개인 보관함(수백~수천 건)이면 LIKE도 충분히 빠름.

#### [2026-10-06] 앱 형태: 내 PC 로컬 웹앱(브라우저로 열기)
- 릴리스: 웹(lilys.ai) + iOS·Android 앱 + 크롬 확장.
- 우리: FastAPI(파이썬) 서버를 내 PC에서 띄우고 브라우저로 http://127.0.0.1 주소를 연다. 데스크톱 포장(Tauri/Electron)은 첫 버전에 없음.
- 이유: 처리 파이프라인이 전부 파이썬(yt-dlp·faster-whisper·PySceneDetect)이라 붙이기 쉽고, Rust 툴체인·코드 서명 같은 설치 부담이 없음. Windows에서는 Tauri도 WebView2(크로미움)라 메모리 이득이 작음.

#### [2026-10-06] 캡처용 영상은 720p 화면만 받고 처리 후 삭제
- 릴리스: 캡처 이미지를 서버에서 만들어 제공(원본 처리 방식 비공개).
- 우리: yt-dlp로 720p 이하 영상 트랙(소리 없음)과 오디오 트랙을 따로 받아 캡처·받아쓰기 후 영상 파일은 삭제, 캡처 jpg만 보관.
- 이유: 디스크·시간 절약(20분 영상 720p 약 24MB, 8초 실측), 기능 D5.

#### [2026-10-06] 음성인식·장면 분석을 내 PC에서 처리
- 릴리스: 서버(클라우드)에서 대본·요약·캡처를 처리(내부 방식 비공개).
- 우리: 자막 있으면 yt-dlp로 받고, 없으면 내 PC GPU에서 로컬 음성인식(faster-whisper / Qwen3-ASR). 장면 감지·짝짓기도 로컬 + Claude Code.
- 이유: 완전 무료·로컬 실행 조건. 자막 없는 20분 영상은 수 분 더 걸릴 수 있음.

#### [2026-10-06] 마인드맵은 릴리스와 같은 markmap 사용, 내보내기 버튼은 우리가 추가
- 릴리스: JS 번들에서 window.markmap 로더와 "markmap syntax로 시각화하라"는 한국어 프롬프트 확인 → 요약을 markmap용 마크다운으로 만들고 markmap으로 그리는 방식(가로 트리, 둥근 연결선).
- 우리: 같은 markmap(MIT)을 쓴다. PNG 내보내기는 markmap에 내장되어 있지 않아 SVG를 그림으로 바꾸는 단계를 따로 넣는다.
- 이유: 모양을 똑같이 맞추려면 같은 라이브러리가 가장 확실하다.

#### [2026-10-06] 제목용 영문 폰트 Clash Display → OFL 폰트로 대체
- 릴리스: 앱 CSS(index-*.css)에 본문 Pretendard(77곳) 외에 자체 호스팅한 Clash Display(Fontshare, ITF Free Font License, 오픈소스 아님)와 Playfair Display·Crimson Text·League Spartan(Google Fonts)을 쓴다.
- 우리: 본문·제목 모두 Pretendard(OFL-1.1)로 통일. 영문 장식 제목이 꼭 필요하면 OFL인 Playfair Display 또는 Space Grotesk로 대신한다.
- 이유: Clash Display는 상업 사용은 무료지만 폰트 파일 재배포 금지 조건이 있는 비공개 라이선스라, 앱에 번들하기에 OFL보다 조건이 까다롭다. 화면 인상 차이는 작다.

#### [2026-10-06] 로그인·회원 유도·공유 비밀번호 기능 제외
- 릴리스: 공개 리포트 일부만 보이고 "전체 리포트를 보려면 무료로 가입하세요"(구글/Apple/네이버/이메일) 창, 비밀번호 걸고 공유(유료), 친구 초대 프로그램.
- 우리: 없음. 공유는 파일 내보내기로 대신.
- 이유: 개인용 로컬 앱.

#### [2026-10-06] 인포그래픽·카툰·애니메이션·PPT 만들기
- 릴리스: 이미지 생성 엔진으로 인포그래픽(스타일 선택: 컬러풀·과학적·손글씨·미니멀·기업용 등), 카툰, 애니메이션, PPT(9가지 디자인, 2~30장, PPTX 다운로드) 생성. 무료는 인포그래픽 월 2회, 파일 내보내기는 유료.
- 우리: 첫 버전 제외(FEATURES "다음 단계"의 인포그래픽·카툰과 동일). 하게 되면 HTML/SVG 도표나 로컬 이미지 모델로 대체 검토.
- 이유: 고품질 이미지 생성은 유료 API이거나 로컬 GPU(12GB) 부담이 큼.

#### [2026-10-06] NOW 추천 피드·채널 구독 모니터링·자료 찾기(웹/논문 검색)·딥서치 제외(첫 버전)
- 릴리스: 홈의 NOW(관심사 기반 추천), 유튜브·RSS 채널 구독 새 영상 추적, "자료 찾기"(웹·유튜브·논문 검색 후 추가), 딥 서치(베타), 웹 검색 모드 채팅.
- 우리: 첫 버전에서는 만들지 않는다. 필요하면 다음 단계에서 무료 검색 수단으로 검토.
- 이유: 서버 상시 실행·외부 검색 API(대부분 유료 또는 키 필요)가 필요해 로컬·무료 조건과 맞지 않음.

#### [2026-10-06] 채팅 AI 모델
- 릴리스: 채팅창 안내 문구상 "Gemini 최신 모델"로 자료 근거 답변, 유료는 "고급 모델"(최신 유료 LLM) 사용.
- 우리: Claude Code(Max, 이미 사용 중) 또는 로컬 모델.
- 이유: 완전 무료 조건 — 추가 유료 API 금지.

#### [2026-10-06] 장면 캡처 개수 제한 없음
- 릴리스: "영상 속 스크린샷 추출"이 무료 플랜은 최대 2개, 유료는 무제한(요금제 표 기준).
- 우리: 개수 제한 없음(FEATURES D3).
- 이유: 로컬 처리라 사용량 제한이 필요 없음.

#### [2026-10-06] 결과 화면 탭: "요약/확장" 구조는 따르되 블로그글(그림 요약)을 기본 탭으로
- 릴리스: 2026-01 UI 개편·2026-03-31 프로젝트 화면 개편 후 리포트가 "요약"(기본·짧게·길게·쉽게)과 "확장"(마인드맵·인포그래픽·스크립트·블로그·타임스탐프 등 30여 템플릿) 두 묶음으로 바뀜. 예전(2024)의 요약노트·블로그글·스크립트·타임스탬프 고정 탭은 사라지고, 블로그는 확장 템플릿/나만의 템플릿으로 만든다.
- 우리: 화면 배치(왼쪽 원본 뷰어 / 가운데 리포트 / 오른쪽 채팅)와 "요약·확장" 구분은 따르되, 블로그글(문단+장면 캡처)·타임라인·마인드맵·스크립트는 처음부터 자동 생성해 기본 탭으로 둔다.
- 이유: FEATURES.md C3(그림 요약)가 가장 중요한 기능이고, 로컬 처리라 버튼마다 추가 생성 대기를 줄이는 편이 낫다.

#### [2026-10-06] 공개 노트(SEO 페이지)·탐색 기능 제외
- 릴리스: 요약 노트를 lilys.ai/ko/notes/... 공개 페이지로 게시하고 "탐색"에서 주제별로 모아 보여준다(한국어 공개 노트 약 1만 개, sitemap 기준).
- 우리: 공개 게시·탐색 기능은 만들지 않는다. 내보내기(Markdown/PDF/HTML)로 대신한다.
- 이유: 로컬 전용(서버 없음), 개인용.

#### [2026-10-06] 계정·요금제·사용량 제한 없음
- 릴리스: 회원가입·로그인 필요, 무료/유료 요금제와 사용량(크레딧) 제한이 있다. 공개 노트의 "AI 뷰어로 보기"·"스크립트" 버튼은 가입 페이지로 보낸다.
- 우리: 로그인·요금제 화면이 없다. 제한은 내 PC 처리 능력과 Claude Code Max 사용 한도뿐이다. 가입 유도 버튼·배너도 넣지 않는다.
- 이유: 개인용 로컬 앱이라 계정이 필요 없음.

#### [2026-10-06] 처리 위치: 클라우드 → 내 PC
- 릴리스: 링크를 넣으면 릴리스 서버(클라우드)에서 자막·요약·캡처를 처리하고 결과를 웹/앱(iOS·Android·크롬 확장)으로 보여준다.
- 우리: 내 Windows PC 안에서만 처리하고 결과도 로컬 앱으로 본다. 휴대폰 앱·크롬 확장은 첫 버전에 없다.
- 이유: 고정 조건(로컬 실행만, 클라우드는 나중). 처리 속도는 내 PC 사양(RTX 5070 12GB)에 좌우된다.
