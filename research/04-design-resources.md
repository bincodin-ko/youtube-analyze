# 04. 디자인 자원 조사 (B·C·D 영역)

- 조사일: 2026-10-06 · 조사 방식: `gh api`로 LICENSE·별·최근 push 직접 확인, npm 주간 다운로드는 api.npmjs.org(2026-09-29~10-05 주), 릴리스는 curl로 HTML·CSS·JS를 받아 grep
- 표기: 상업 사용 ✅ 가능 / ⚠️ 조건부 / ❌ 불가 / 미확인

---

## 1. 조사한 곳 목록

| 곳 | 한 줄 설명 | 이번에 실제로 본 것 |
|---|---|---|
| GitHub API (`gh api repos/...`) | 라이선스 원문·별·최근 push 일자를 직접 확인하는 기준 출처 | 후보 전부 |
| npm 다운로드 API | 주간 다운로드로 실사용 규모 비교 | 18개 패키지 |
| awesome-shadcn-ui (birobirobiro, 별 2.06만) | shadcn 관련 컴포넌트·블록·템플릿 모음 | 존재·활성 확인 |
| registry.directory / shoogle.dev/directory / shadcn.io/awesome/registries (새로 찾음) | shadcn CLI로 설치되는 "레지스트리"를 모아 검색·미리보기하는 곳. 2026년엔 컴포넌트를 레지스트리 단위로 찾는 게 주류 | 검색 결과로 확인 |
| ui.shadcn.com 변경 이력 | 2026-05 "Registry include/validate" 등 레지스트리 기능 확장 | 검색 결과로 확인 |
| LibHunt (libhunt.com/topic/mindmap, compare 페이지) | 오픈소스 라이브러리 활동도·성장률 비교 | 마인드맵 비교 확인 |
| GitHub Topics (mindmap, video-summarization, youtube-summary) | 주제별 저장소 모음 | 검색 결과로 확인 |
| Google 개발자 문서 (YouTube 약관·정책·IFrame API) | 플레이어 약관 원문 | 직접 읽음 |
| lilys.ai 랜딩(Astro) + 앱(lilys.ai/app, Vite 번들) | 실제 폰트·색·라이브러리 흔적 | 직접 받아 grep |
| 국내 커뮤니티(GeekNews, OKKY, 커리어리), Product Hunt, Reddit/HN | 실사용 후기 | **이번엔 못 봄**(9장) |

---

## 2. 릴리스 실제 폰트·색·프레임워크 확인 결과 (curl로 직접 확인)

**확인 근거:** `lilys.ai/app` → `/assets/index-BzPycSUT.css`(약 510KB), `/assets/index-BnnlC_fn.js`(약 11MB). 랜딩 `lilys.ai` → Astro v7.3.2, `/_astro/BaseLayout.ng0VEqjT.css`.

| 항목 | 확인 결과 |
|---|---|
| 본문 폰트 | **Pretendard** (`font-family:Pretendard` 77곳, jsDelivr `orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css`로 불러옴). 일부 `Pretendard Variable` |
| 기타 폰트 | **Clash Display**(자체 호스팅 woff2, Fontshare ITF Free Font License — 오픈소스 아님), Playfair Display, Noto Serif KR, Crimson Text, League Spartan, M PLUS 1p(일본어), 랜딩은 Inter |
| CSS 프레임워크 | **Tailwind** (`--tw-` 변수 3,184곳, `bg-[#f7f7f5]` 같은 임의값 클래스) |
| 컴포넌트 | **shadcn/ui 기본 토큰과 같은 값**: `--background: 0 0% 100%`, `--primary: 0 0% 9%`, `--border: 0 0% 89.8%`, `--radius: .5rem` → shadcn "neutral" 테마 그대로. Radix 흔적 있음 |
| 아이콘 | 번들에 lucide(87회)·tabler(71회) 문자열 → 둘 다 쓰는 것으로 추정 |
| 마인드맵 | **markmap** — `getMarkmap:()=>window.markmap` 로더 + "markmap syntax로 시각화" 한국어 프롬프트(`MermaidGraphPromptSetKorean`) 확인 |
| 도표 | **mermaid** 문자열 126회 → 도표에 mermaid 사용으로 추정 |
| 유튜브 플레이어·라이트박스 | 첫 번들에서 `YT.Player`·`iframe_api`·lightbox 흔적 없음 → **미확인**(로그인 뒤 청크로 보임, NOT_SOLVED 기록) |

**앱 CSS에서 많이 쓰인 색(등장 횟수순, 역할은 추정):**

| hex | 횟수 | 추정 역할 |
|---|---|---|
| `#9fa28e` | 154 | 흐린 보조 글자·아이콘(올리브 회색) |
| `#f4f5f4` | 98 | 배경(아주 옅은 회색) |
| `#0c0d08` | 97 | 본문 글자(거의 검정) |
| `#e7e8e3` | 74 | 테두리·구분선 |
| `#565b4a` | 45 | 진한 보조 글자 |
| `#f9faf9` | 40 | 카드·패널 배경 |
| `#6663fd` | 36 | 포인트 색(보라 계열 링크·버튼) |
| `#dfff32` | 27 | 브랜드 형광 라임(강조 배경·버튼) |
| `#6e8b00` | 27 | 라임 위 진한 글자 |
| `#f2ffc7` | 17 | 연한 라임 하이라이트 배경 |
| `#dd1155`, `#ef4444` | 7, 6 | 경고·삭제 |

정리: 흰/옅은 회색 바탕 + 올리브 톤 회색 글자 + **형광 라임(#dfff32)** 포인트 + 보라(#6663fd) 보조 포인트, 모서리 8px. 색 값 자체는 저작권 대상이 아니라 그대로 써도 되지만, 로고·마스코트·문구는 새로 만든다.

---

## 3. 후보 표 — B) 디자인 자원

(별=GitHub stars, 다운로드=npm 주간)

| 이름 | URL | 라이선스 | 상업 | 최근 push | 인기 | 용도 | 장단점 |
|---|---|---|---|---|---|---|---|
| shadcn/ui | github.com/shadcn-ui/ui | MIT | ✅ | 2026-10-06 | 별 12.5만 | 탭·카드·사이드바·다이얼로그 | 장: 릴리스와 같은 토큰, 코드 복사 방식이라 수정 자유 / 단: React+Tailwind 전제 |
| Radix Primitives | github.com/radix-ui/primitives | MIT | ✅ | 2026-10-06 | 별 1.9만, react-tabs 7,570만/주 | shadcn의 바닥(접근성 처리) | 장: 키보드·스크린리더 처리 내장 / 단: 스타일 없음 |
| Tailwind CSS | github.com/tailwindlabs/tailwindcss | MIT | ✅ | 2026-09-25 | 별 9.8만, 1.63억/주 | 스타일 | 장: 릴리스와 같음 / 단: 클래스가 길어짐 |
| Pretendard | github.com/orioncactus/pretendard | OFL-1.1 (원문 확인, Reserved Font Name 'Pretendard') | ✅ | 2026-07-23 | 별 3,597, npm 33만/주 | 한글 본문·제목 | 장: **릴리스와 같은 폰트**, 가변 폰트 / 단: 수정해서 배포하면 이름 바꿔야 함 |
| SUIT | github.com/sun-typeface/SUIT | OFL-1.1 (원문 확인) | ✅ | 2024-07-13 | 별 310 | 한글 대안 | 장: 깔끔 / 단: 업데이트 뜸 |
| Noto Sans KR | github.com/notofonts/noto-cjk | OFL-1.1 (Sans/LICENSE 원문 확인) | ✅ | 2025-12-16 | 별 4,086 | 대체 폰트 | 장: 글자 수 최다 / 단: 파일 큼 |
| lucide | github.com/lucide-icons/lucide | ISC (원문 확인; gh는 NOASSERTION 표시) | ✅ | 2026-10-06 | 별 2.5만, lucide-react 1.35억/주 | 아이콘 | 장: shadcn 기본, 릴리스도 사용 추정 / 단: 아이콘 수 Tabler보다 적음 |
| Tabler Icons | github.com/tabler/tabler-icons | MIT | ✅ | 2026-10-05 | 별 2.2만, react 417만/주 | 아이콘 보충 | 장: 5천 개 이상 / 단: 두 세트 섞으면 선 굵기 맞춰야 |
| Phosphor (react) | github.com/phosphor-icons/react | MIT | ✅ | 2026-01-06 | 별 1,767, 620만/주 | 아이콘 대안 | 장: 굵기 6종 / 단: 릴리스 느낌과 거리 있음 |
| yet-another-react-lightbox | github.com/igordanchenko/yet-another-react-lightbox | MIT | ✅ | 2026-10-05 | 별 1,321, 75만/주 | 장면 캡처 크게 보기 | 장: React용, 확대·썸네일 플러그인 / 단: React 전용 |
| PhotoSwipe | github.com/dimsemenov/PhotoSwipe | MIT | ✅ | 2025-12-04 | 별 2.5만, 66만/주 | 라이트박스 대안 | 장: 프레임워크 무관, 모바일 제스처 / 단: React 연결 코드 필요 |
| react-markdown | github.com/remarkjs/react-markdown | MIT | ✅ | 2026-10-03 | 별 1.6만, 4,400만/주 | 요약 글 렌더 | 장: 기본으로 HTML 차단(안전), remark-gfm으로 표 / 단: 아주 긴 문서는 느릴 수 있음 |
| Material Design Icons | github.com/google/material-design-icons | Apache-2.0 | ✅ | 2026-10-02 | 별 5.4만 | (참고용) | 릴리스 느낌과 달라 비추천 |

### 유튜브 임베드 플레이어 — 약관 주의점 (원문 인용)

출처: [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality), [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

| 주제 | 원문 | 우리 앱에 주는 뜻 |
|---|---|---|
| 최소 크기 | "Embedded players must have a viewport that is at least 200px by 200px." (16:9는 480×270 이상 권장) | 오른쪽 패널을 좁혀도 플레이어는 200×200 밑으로 줄이지 않는다. 예: 패널 폭이 180px이 되면 플레이어를 숨기고 "영상 보기" 버튼으로 바꾼다 |
| 오버레이 금지 | "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls." | 플레이어 위에 자막·타임스탬프 칩·로고를 띄우면 안 된다. 예: 상단 드롭다운 메뉴가 펼쳐질 때 플레이어를 덮지 않게 위치 조정 |
| 자동재생 | "An API Client must not initiate an automatic playback until the player is visible and more than half of the player is visible on the page or screen." | 영상 패널이 닫혀 있거나 스크롤로 가려졌을 때 자동재생 금지. 타임스탬프 클릭으로 재생하는 건 사용자 동작이라 괜찮음 |
| 플레이어 수정 금지 | "You must not make changes to the YouTube player that are not explicitly described by the API documentation." / 정책 III.I.6 "modify, build upon, or block any portion or functionality of a YouTube player" | `seekTo`, `playVideo` 같은 공식 API만 사용 |
| 식별 | 임베드 플레이어는 "HTTP Referer" 헤더로 식별 정보를 보내야 함 | 앱을 `file://`로 열면 Referer가 없어 재생 오류가 날 수 있음 → `http://localhost`로 띄운다 |
| 음성·영상 분리 | 정책 III.I.7 "separate, isolate, or modify the audio or video components" 금지 | 플레이어에서 소리만 뽑아내는 기능 금지 |
| 다운로드·캐시 | 정책 III.E.1.a "download, import, backup, cache, or store copies of YouTube audiovisual content without YouTube's prior written approval" 금지 | **주의:** API 약관 기준으로는 yt-dlp로 영상을 받아 장면을 캡처하는 방식과 충돌한다. 개인 로컬 사용이라도 위험 판단은 사용자 몫(다른 조사 문서와 함께 결정) |
| 브라우저 자동재생 차단 | 소리 있는 자동재생이 막히면 `onAutoplayBlocked` 이벤트 발생 | 자동재생에 기대지 말 것 |

---

## 4. C) 마인드맵 비교 표와 추천

| 이름 | URL | 라이선스 | 상업 | 최근 push | 인기 | 마크다운→자동 변환 | PNG/SVG 내보내기 | 접기/펼치기 | 모양 | 한글 |
|---|---|---|---|---|---|---|---|---|---|---|
| **markmap** | github.com/markmap/markmap | MIT | ✅ | 2026-09-12 | 별 1.3만, markmap-view 15만/주 | ✅ 핵심 기능(markmap-lib) | SVG는 화면의 SVG를 그대로 저장 가능 / PNG 내장 기능은 README·toolbar 문서에서 못 찾음 | ✅ 노드 클릭 | 가로 트리, 곡선 연결선, 글자+밑줄형 노드 | ✅ 폰트 지정 가능 |
| Mind Elixir | github.com/SSShooter/mind-elixir-core | MIT | ✅ | 2026-10-03 | 별 3,173, 3만/주 | ✅ README "Markdown Support" | ✅ README "SVG / PNG / HTML export" | ✅ | 좌우 양쪽 펼침, 둥근 박스 노드 | ✅ |
| simple-mind-map | github.com/wanglin2/mind-map | MIT | ✅ | 2026-08-02 | 별 1.28만, 6,912/주 | ✅ Markdown 가져오기 | ✅ PNG·SVG·PDF·XMind 등 | ✅ | 구조 여러 종, 둥근 박스 | ✅ (문서는 중국어 위주) |
| jsMind | github.com/hizzgdev/jsmind | BSD-3-Clause (원문 확인; gh는 NOASSERTION) | ✅ | 2026-05-18 | 별 3,793, 2,980/주 | ❌ 자체 JSON 형식 | 플러그인으로 이미지 | ✅ | 박스 노드 | ✅ |
| React Flow (xyflow) | github.com/xyflow/xyflow | MIT | ✅ | 2026-09-29 | 별 3.86만, 1,537만/주 | ❌ 자동 배치 직접 구현(dagre 등 필요) | 직접 구현 | 직접 구현 | 자유 | ✅ |

**추천: markmap** — 릴리스 번들에서 markmap을 쓰는 것을 직접 확인했다. 모양(가로 트리·곡선 연결선)이 가장 똑같이 나오고, LLM에게 마크다운 목록만 만들게 하면 바로 그려진다. PNG 내보내기만 SVG→캔버스 변환을 따로 붙인다(LILYS_CHANGES 기록).
- 차선책: 둥근 박스 노드와 PNG 내보내기가 기본으로 필요하면 Mind Elixir.
- 이전 추정("둥근 노드")과 달리 markmap 기본 노드는 박스가 아니라 **글자+밑줄** 형태다. 릴리스 화면 캡처와 대조해 확인 필요.

## 5. F2 도표·비교표 추천

| 이름 | URL | 라이선스 | 상업 | 최근 push | 인기 | 용도 | 장단점 |
|---|---|---|---|---|---|---|---|
| **mermaid** | github.com/mermaid-js/mermaid | MIT | ✅ | 2026-10-06 | 별 9.06만, 2,031만/주 | 흐름도·순서도·타임라인·간트·파이·XY 차트 | 장: 글로 생성 → LLM 출력과 잘 맞음, **릴리스도 사용 추정** / 단: 세밀한 스타일 조정 한계 |
| Chart.js | github.com/chartjs/Chart.js | MIT | ✅ | 2026-10-04 | 별 6.77만, 1,571만/주 | 막대·선·원형 | 장: 가볍고 PNG 저장 쉬움 / 단: JSON 설정 필요 |
| Recharts | github.com/recharts/recharts | MIT | ✅ | 2026-10-06 | 별 2.76만, 7,129만/주 | React 차트 | 장: shadcn Chart 컴포넌트의 바닥 / 단: React 전용 |
| 마크다운 표 | react-markdown + remark-gfm | MIT | ✅ | — | — | 비교표 | 라이브러리 추가 없음 |

**추천: mermaid**(도표) + **마크다운 표**(비교표). 숫자 차트가 꼭 필요할 때만 shadcn Chart(Recharts)를 더한다.

---

## 6. D) 비슷한 화면 구성의 오픈소스 UI

| 이름 | URL | 라이선스 | 상업 | 최근 push | 인기 | 화면 구성·스택 | 참고 포인트 |
|---|---|---|---|---|---|---|---|
| **open-notebook** | github.com/lfnovo/open-notebook | MIT | ✅ | 2026-10-05 | 별 3.99만 | NotebookLM 클론. frontend: Next.js + Tailwind + Radix tabs + lucide + react-markdown | 사이드바+노트+채팅 3단 배치, 우리 스택과 거의 같음 → **배치 참고 1순위** |
| SurfSense | github.com/MODSetter/SurfSense | Apache-2.0, 단 `surfsense_backend/app/proprietary/`만 BSL 1.1 | ⚠️ (그 폴더 빼면 ✅) | 2026-10-06 | 별 1.63만 | Next.js + Tailwind + Radix + lucide + **markmap-lib/markmap-view** | 마인드맵 연동 코드 참고. 차선책: surfsense_web만 보고 BSL 폴더는 보지 않음 |
| Kotaemon | github.com/Cinnamon/kotaemon | Apache-2.0 | ✅ | 2026-07-14 | 별 2.58만 | Gradio UI(문서 RAG) | 화면 느낌이 릴리스와 멀어 참고 가치 낮음 |
| DevRico003/youtube_summarizer | github.com/DevRico003/youtube_summarizer | MIT | ✅ | 2026-01-29 | 별 217 | Next.js, 클릭 타임스탬프·챕터 타임라인 | 타임스탬프 목록 UI 참고 |
| youtube-digest-mindmap | github.com/Hellenli624/youtube-digest-mindmap | 미확인(gh NOASSERTION, 원문 미열람) | 미확인 | 2026-09-14 | 별 1 | 크롬 사이드패널: 마인드맵+이중언어 대본+타임스탬프 노트 | 기능 구성이 가장 비슷하나 신생·라이선스 불명 → 코드는 쓰지 말고 아이디어만 |
| vedkadam1604-web/youtube-video-summarizer | github.com/vedkadam1604-web/youtube-video-summarizer | 없음 | ❌ (라이선스 없음 = 모든 권리 보유) | 2026-09-24 | 별 0 | 임베드 플레이어+타임스탬프 이동, 다크 모드 | 아이디어만. 차선책: DevRico003(MIT) |

---

## 7. 추천 디자인 자원 조합 (모두 상업 ✅)

| 영역 | 선택 | 라이선스 |
|---|---|---|
| 화면 틀 | React + **Tailwind** + **shadcn/ui**(Radix), neutral 테마, radius 0.5rem | MIT |
| 3단 배치 | shadcn Sidebar + Resizable + Tabs | MIT |
| 폰트 | **Pretendard** 하나로 통일(릴리스와 같음) | OFL-1.1 |
| 아이콘 | **lucide**(주) + Tabler(빠진 것 보충) | ISC / MIT |
| 색 | 2장 실측 hex: 배경 #f4f5f4·#f9faf9, 글자 #0c0d08·#565b4a·#9fa28e, 테두리 #e7e8e3, 포인트 #dfff32·#6e8b00·#6663fd | 해당 없음 |
| 요약 글 | **react-markdown** + remark-gfm | MIT |
| 장면 캡처 보기 | **yet-another-react-lightbox** | MIT |
| 마인드맵 | **markmap** (+ PNG 변환 직접) | MIT |
| 도표 | **mermaid** | MIT |
| 영상 | YouTube IFrame Player API (공식 임베드, 3장 약관 지킴) | Google 약관 |
| 배치 참고 | open-notebook frontend | MIT |

---

## 8. 라이선스 미확인·주의 목록

| 대상 | 상태 | 이유 |
|---|---|---|
| youtube-digest-mindmap | 미확인 | gh가 NOASSERTION, LICENSE 원문 미열람 |
| vedkadam1604-web/youtube-video-summarizer | ❌ | LICENSE 파일 없음 |
| SurfSense `proprietary/` 폴더 | ⚠️ | BSL 1.1 |
| Clash Display(릴리스 사용) | ⚠️ | ITF Free Font License: 상업 사용은 무료지만 오픈소스 아님, 폰트 재배포·파생 폰트 배포 금지(검색 결과 기준, 원문 미열람) → Pretendard로 대체 |
| 릴리스의 플레이어·라이트박스 구현 | 미확인 | 로그인 뒤 청크라 확인 못 함 |
| markmap PNG 내보내기 내장 여부 | 미확인 | README·toolbar 문서에서 못 찾음 |

## 9. 못 본 곳
- 국내 커뮤니티(GeekNews·OKKY·커리어리), Product Hunt, Reddit/HN 실사용 후기: 이번 조사에서 열지 않음
- 릴리스 로그인 뒤 결과 화면 코드
- `gh search repos`가 빈 결과를 줘서 GitHub 검색은 WebSearch로 대신함
