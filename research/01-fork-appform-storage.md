# 01. 포크 후보 · 앱 형태 · 보관/내보내기 · 진행 표시 조사

> 조사일 2026-10-06~07 · 조사원: oss-scout(포크/앱형태/H/A) · 코드는 만들지 않음
> 라이선스는 모두 `gh api repos/OWNER/REPO/license`(LICENSE 파일 직접)로 확인. 별·최근 푸시는 GitHub API 값(2026-10-06 기준).

## 0. 조사한 곳

| 곳 | 본 여부 | 비고 |
|---|---|---|
| GitHub 검색(`gh search repos`, 별 순) | 봄 | youtube summarizer / video to blog / bibigpt / BiliNote / notebooklm / 视频笔记 / 视频总结 / AI video note 등 20여 키워드 |
| GitHub topics | 봄 | youtube-summarizer, video-summarizer, video-summary, youtube-summary, video-notes |
| 중국어 키워드(视频笔记·视频总结) | 봄 | **새로 추가한 곳** — 이 분야 상위 프로젝트(BiliNote·BiliSum·AI-Media2Doc·BibiGPT)가 대부분 중국 개발자 것이라 영어 검색만으론 놓침 |
| 웹 검색(WebSearch) | 봄 | 2026 비교글, Gemini 무료 한도, Tauri/Electron 메모리, WeasyPrint |
| Hacker News(research MCP) | 봄 | Show HN에 관련 글 없음(2025-06 이후) |
| Reddit r/selfhosted·r/LocalLLaMA(research MCP) | **못 봄** | arctic-shift 422 Timeout 2회. Chrome은 reddit 차단 → NOT_SOLVED 기록 |
| ai.google.dev(가격·한도) | 일부 | 가격표는 읽힘, 모델별 한도표는 AI Studio 로그인 필요 |
| AlternativeTo·Product Hunt·GeekNews | 안 봄 | GitHub에서 상위 후보가 충분히 나와 토큰 절약 차원에서 생략 |

## 1. 후보별 표

A=입력·진행 B=대본 C=요약(C3 블로그+장면) D=장면 캡처 E=타임스탬프 이동 F=마인드맵 G=채팅 H=보관·관리
(●있음 ◐일부 ○없음)

| 이름 | URL | 라이선스(코드) | 상업 | 최근 푸시 | 별 | A B C C3 D F G H | Windows 로컬 | 유료 API 필수 | 내 PC | 장단점 |
|---|---|---|---|---|---|---|---|---|---|---|
| **BiliSum** | github.com/lycohana/BiliSum | MIT | ✅ | 2026-09-10 | 624 | ● ● ● ● ◐ ● ● ● | ● 설치판(Electron)+웹(127.0.0.1:3838) | 없음(로컬 Whisper·로컬 LLM·OpenAI호환) | 가능 | +VLM이 캡처를 보고 문단 옆에 배치하는 "그림 노트"(C3에 가장 가까움), 마인드맵(확대·드래그), 여러 영상 RAG 질문, 태그·검색, FastAPI+SQLite, SSE 진행 표시, **Python 3.12+uv+Node 구성이 내 PC와 동일**. −생성 6개월, 사실상 1인 개발, 중국어 UI, 파이프라인 한 파일 6,400줄, 장면 후보는 화면 전환 감지가 아니라 대본 기반 LLM 시점 계획 |
| **BiliNote** | github.com/JefferyHcool/BiliNote | MIT | ✅ | 2026-09-01 | 7,454 | ● ● ● ◐ ◐ ● ● ◐ | ● 웹(FastAPI+React19/Vite) + Tauri 설치판 | 없음(ollama 기본 제공자에 있음, faster-whisper) | 가능 | +가장 성숙(포크 957, v2.4.4), LLM이 본문에 `Screenshot-[mm:ss]` 표시를 넣으면 그 시점 캡처를 끼움(문단-장면 짝짓기 근사), markmap 마인드맵, RAG 질문, PDF/MD 내보내기. −열린 이슈 184, celery/redis 등 의존성 많음, 화면 전환 감지 없음, 폴더/태그 약함, 중국어 경로 금지, 상업 클라우드판 홍보 많음 |
| video-helper | github.com/LDJ-creat/video-helper | MIT(파일 본문 확인, GitHub 표시는 NOASSERTION) | ✅ | 2026-07-14 | 50 | ● ● ● ◐ ◐ ● ● ◐ | ● | 없음(클라우드 ASR 권장하나 로컬 faster-whisper 대체) | 가능 | +ReactFlow 마인드맵↔본문↔영상 시점 연결, 연습문제. −작은 프로젝트 |
| video-to-note | github.com/like-attract/video-to-note | MIT | ✅ | 2026-10-04 | 118 | ● ● ● ○ ◐ ○ ○ ◐ | ● 포터블 exe | 없음 | 가능 | +자체완결 HTML·PNG 내보내기, MCP/스킬. −마인드맵·채팅 없음, B站 중심 |
| open-notebook | github.com/lfnovo/open-notebook | MIT | ✅ | 2026-10-05 | 39,866 | ◐ ◐ ● ○ ○ ○ ● ● | ◐ Docker 위주 | 없음(Ollama 지원) | 가능(무거움) | +NotebookLM 클론, 채팅·노트 관리 우수. −장면 캡처·마인드맵 없음, 영상 특화 아님 → G/H 참고용 |
| BibiGPT-v1 | github.com/JimmyLv/BibiGPT-v1 | GPL-3.0 | ⚠️(배포 시 소스 공개) | 2026-05-04 | 6,227 | ● ● ● ○ ○ ○ ◐ ○ | ◐ Next.js | OpenAI 키 전제 | 가능 | 원조 격이나 v1은 사실상 보관용, 상용판은 비공개. 상업 차선: BiliNote(MIT) |
| DevRico003/youtube_summarizer | github.com/DevRico003/youtube_summarizer | MIT | ✅ | 2026-01-29 | 217 | ● ● ◐ ○ ○ ○ ○ ◐ | ● Next.js | 클라우드 LLM 위주 | 가능 | 챕터 타임라인 UI 참고용 |
| YouTubeTLDR | github.com/Milkshiift/YouTubeTLDR | MIT | ✅ | 2026-06-18 | 254 | ● ● ◐ ○ ○ ○ ○ ○ | ● Rust | Gemini 키(무료 등급 가능) | 가능 | 가볍지만 기능 적음 |
| vidistill | github.com/mAE7777/vidistill | MIT | ✅ | 2026-07-08 | 2 | ◐ ● ● ◐ ● ○ ○ ○ | ● CLI(Node22) | **Gemini 키 필수** | 가능 | 아래 별도 판단 |
| keepongo/video-summarizer | github.com/keepongo/video-summarizer | **없음**(404) | ❌ | 2026-02-25 | 75 | ○ ● ● ◐ ◐ ○ ○ ○ | ● (Claude Code 스킬) | 없음 | 가능 | 스킬 1파일. 라이선스 없음 → 코드 복사 불가. 상업 차선: BiliNote |
| yuxino-labs/koma | github.com/yuxino-labs/koma | **없음**(404, package.json에도 license 필드 없음) | ❌ | 2026-09-22 | 255 | ◐ ● ● ○ ● ○ ○ ◐ | ◐ | ASR·비전 제공자 키 필요(없으면 mock 출력) | 가능 | 유튜브 링크 미지원(직접 MP4 URL·업로드만), 웹은 GitHub 로그인 필수. 상업 차선: BiliSum |
| AI-Media2Doc | github.com/hanshuaikang/AI-Media2Doc | MIT | ✅ | 2026-02-05 | 4,035 | ● ◐ ● ● ◐ ● ● ○ | ◐ Docker/WSL 권장 | **화산엔진(豆包) LLM·TOS 저장소 키 필수** | — | "자막 기반 스마트 캡처를 글에 삽입"은 좋은 참고. 유료 클라우드 필수라 제외 |

### vidistill + Gemini 무료 사용량
- 코드(`src/gemini/models.ts`)는 `gemini-3.1-flash-lite-preview`, `gemini-3-flash-preview`를 쓴다.
- 공식 가격표: gemini-3-flash-preview는 무료 등급 입력·출력 무료, 단 **"제품 개선에 사용: 예"**(무료로 넣은 영상·대본을 Google이 학습·개선에 씀). 3.1-flash-lite-preview는 가격표에서 못 찾음.
- 모델별 분당/일일 한도는 공식 문서에 표가 없고 AI Studio 대시보드(로그인)에서만 보임 → **미확인**. 블로그 수치는 2.5 Flash 기준 RPD 250~1,500으로 제각각.
- vidistill은 대본을 3회 반복 합의, 25분 넘는 영상은 20분 단위로 나눠 병렬 처리 → 영상 1개에 수십 번 요청. 무료 한도 안에서 하루 몇 개는 가능하겠지만 한도 초과·정책 변경 위험, 화면(UI)·마인드맵·채팅이 없음 → **포크 대상 아님, 장면 분석 프롬프트 참고용**.

## 2. 포크 추천: **BiliSum (MIT)**
- 이유: A~H 중 C3(문단 옆 캡처)·F1(마인드맵)·G(채팅)·H(태그·검색·SQLite)를 이미 다 갖춘 유일한 후보이고, 개발 환경(Python 3.12 + uv + Node + FastAPI + SQLite + SSE)이 내 PC·우리 계획과 그대로 맞는다.
- 해야 할 일: (1) D1 화면 전환 감지(PySceneDetect)로 후보 장면을 뽑아 VLM/LLM 짝짓기에 넣기, (2) UI를 릴리스 모방 한국어 화면으로 새로, (3) LLM 연결: Ollama(OpenAI 호환)는 바로 됨. Claude Code Max는 API가 아니라 `claude -p` 호출 어댑터를 따로 붙여야 함(Anthropic 제공자 칸은 유료 API 키라 사용 금지), (4) VLM 그림 노트는 Ollama 비전 모델(7B급, VRAM 12GB 안)로.
- 위험: 1인·6개월 프로젝트라 버려질 수 있음 → 포크 후 우리가 직접 유지한다는 전제. 막히면 **차선 BiliNote(MIT, 커뮤니티 큼)**.
- 포크 시 MIT 고지(LICENSE 저작권 줄) 유지 필수.

## 3. 앱 형태 추천: **로컬 웹앱(FastAPI + React/Vite, 브라우저로 127.0.0.1 열기)**
| 형태 | Windows 설치 난이도 | 메모리 | 파이썬 파이프라인 연결 |
|---|---|---|---|
| 로컬 웹앱 | 쉬움(uv + npm, 이미 설치됨) | 서버 수십~수백 MB + 이미 쓰는 브라우저 탭 1개 | 같은 프로세스에서 바로 호출 |
| Tauri 2 | Rust 툴체인+MSVC 빌드도구 필요, 파이썬은 사이드카(PyInstaller)로 따로 묶어야 함, 배포 시 코드 서명 없으면 SmartScreen 경고 | Windows에선 WebView2(크로미움)라 Electron과 비슷(Tauri 공식 벤치 이슈 #5889: Win10에서 Tauri 370~399MB vs Electron 312~318MB) | 간접(HTTP/사이드카) |
| Electron | Node만 있으면 됨, 설치판 100MB+ | 유휴 150~400MB(2026 비교글) | 간접(사이드카) |
| pywebview | pip 한 줄, WebView2 사용 | 가벼움 | 직접 |
- 32GB면 어느 쪽도 부담 없음. 결정 기준은 메모리가 아니라 **설치·빌드 단순함** → 웹앱. 나중에 "창 하나로" 원하면 pywebview로 같은 웹앱을 감싸는 게 가장 싸다(BiliNote의 Tauri, BiliSum의 Electron 껍데기는 쓰지 않아도 됨).

## 4. H. 보관·관리 / 내보내기
- 목록·폴더·태그: SQLite(파이썬 내장). BiliSum의 SQLite 스키마·태그 서비스 재사용.
- 한국어 검색: **SQLite FTS5 `tokenize='trigram'` + 2글자 이하는 LIKE**. 내 PC 실측(Python 3.12 내장 SQLite 3.49.1): trigram은 "영상을""인공지능" 찾음, "영상""요약"(2글자) 못 찾음 / 기본 unicode61은 띄어쓰기 단위 통째 일치만("영상" 못 찾음) / LIKE는 전부 찾음. 형태소 분석기(kiwipiepy 등)는 필요할 때만.
- 내보내기:
  - Markdown: 직접 생성(캡처는 폴더째 zip).
  - 이미지 포함 HTML: 캡처를 base64로 넣은 한 파일(video-to-note·BiliNote가 쓰는 방식).
  - PDF: **같은 HTML을 Playwright `page.pdf()`**(Apache-2.0, ✅, `pip install playwright` + `playwright install chromium`) 또는 사용자가 브라우저 "PDF로 저장". 한글 웹폰트·화면 모양 그대로.
  - 제외: WeasyPrint(BSD ✅이나 Windows는 MSYS2 설치 후 `pacman -S mingw-w64-ucrt-x86_64-pango` 필요 — 번거로움), BiliNote의 markdown_pdf(PyMuPDF 기반, **AGPL-3.0 ⚠️**).

## 5. A. 진행 표시
- **SSE(Server-Sent Events)** 추천: 서버→브라우저 한 방향 알림이면 충분, FastAPI `StreamingResponse`/브라우저 `EventSource`만으로 됨, 끊기면 자동 재연결. BiliSum이 이미 EventSource 사용. WebSocket은 양방향이 필요할 때(채팅 스트리밍도 SSE로 가능)만.

## 6. 제외 후보와 이유
- keepongo/video-summarizer, yuxino-labs/koma: LICENSE 없음(재확인, API 404) → 기본 저작권, 코드 사용 불가. koma는 유튜브 링크도 미지원.
- AI-Media2Doc: 화산엔진 유료 LLM·저장소 필수.
- vidistill: Gemini 키 필수·UI 없음(참고용).
- BibiGPT-v1: GPL-3.0, OpenAI 키 전제, 사실상 보관 상태.
- open-notebook: 영상 장면 기능 없음(G/H 참고용으로만).

## 7. 라이선스 미확인 목록
- 없음(본 후보 전부 LICENSE 파일 직접 확인). 단 video-helper는 GitHub가 NOASSERTION으로 표시하나 파일 본문은 MIT 원문 그대로임을 확인.
- Gemini 3 Flash 계열 무료 한도 수치: 미확인(로그인 필요).

## 출처
- https://github.com/topics/youtube-summary
- https://ai.google.dev/gemini-api/docs/pricing
- https://github.com/tauri-apps/tauri/issues/5889
- https://www.pkgpulse.com/guides/electron-vs-tauri-2026
- https://doc.courtbouillon.org/weasyprint/stable/first_steps.html
