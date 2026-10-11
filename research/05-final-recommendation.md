# 영상노트 — 조사 종합 · 릴리스 대응표 · 추천 최종 구성 (2026-10-07)

상세 근거: `00-lilys-features.md`(릴리스 기능) · `01-fork-appform-storage.md`(포크·앱 형태·보관) · `02-ai-engine.md`(AI 엔진) · `03-transcript-asr-scenes.md`(자막·음성인식·장면) · `04-design-resources.md`(디자인) · `my-pc-spec.md`(사양) · `../design-ref/README.md`(릴리스 캡처 44장)

## 가장 큰 발견
1. **통째로 포크할 후보가 있다: BiliSum** (github.com/lycohana/BiliSum, MIT ✅ — 메인이 `gh api`로 재확인, ★624, 2026-09-10 푸시). 그림 노트(VLM이 캡처를 문단 옆에 배치)·마인드맵·RAG 질문·태그 검색을 이미 갖췄고 Python 3.12+uv+FastAPI+SQLite+SSE라 내 PC 환경과 같다. 약점: 1인 개발, 중국어 UI, 핵심 파일 6,400줄. 차선 BiliNote(MIT ✅ 재확인, ★7,454).
2. **릴리스는 2026년에 고정 탭(요약노트·블로그글·스크립트·타임스탬프)을 없앴다.** 지금은 3단(왼쪽 영상+스크립트 / 가운데 「요약·확장」 리포트 / 오른쪽 LILY 채팅·하이라이트)이고, 마인드맵 등은 「확장」 템플릿. 우리도 이 구성을 따른다(LILYS_CHANGES 기록).

## 결정 필요한 위험 1건
- **YouTube 개발자 정책은 영상 다운로드·저장을 금지**(III.E.1.a). 우리 장면 캡처는 yt-dlp로 720p를 받아 캡처 후 즉시 삭제한다. 개인용 로컬이라 실제 위험은 낮지만, 상업 배포 시엔 문제가 된다. 예: 앱을 팔면 "다운로드 기능 포함"이 약관 위반 근거가 될 수 있음. 상업화 때 대안: 사용자가 가진 영상 파일 입력, 또는 썸네일·스토리보드 이미지만 사용.

## 릴리스 기능 ↔ 우리 구현 대응표
| 릴리스 기능 (캡처 근거) | FEATURES | 우리 구현 방법 |
|---|---|---|
| 자료 가져오기: 유튜브 링크 입력, 링크 칩, 여러 개 한 번에 (`new-source`) | A1 | 같은 화면 구성. 첫 버전은 유튜브만, 칩 UI·10개 한 번에는 다음 단계 |
| 처리 진행 표시 | A2 | FastAPI SSE로 단계 전송(자막→요약→캡처→완료) |
| 스크립트(시간+문단, 현재 구간 강조, 화자 구분, 복사) (`script-scene`) | B1·B3 | yt-dlp json3 수동/자동 자막 → `[mm:ss]` 줄. 검색은 브라우저 내 필터 |
| 자막 없는 영상 음성인식(무료 월 1시간 제한) | B2 | faster-whisper large-v3-turbo GPU float16(제한 없음). 대안 Qwen3-ASR-1.7B |
| 번역 | B4 | Claude로 대본 번역, 원문/번역 토글 |
| 리포트: 총평 → 목차 → 번호 소제목 → 문장별 출처 [n] (`result-top`) | C1·C2 | Claude `claude -p` JSON 한 번 호출로 총평·목차·소제목·출처 시간 생성 |
| 문단 사이 장면 캡처 (무료 2장 제한) | C3·D2·D3 | **기본 결과 = 그림 요약.** 문단 시간 범위 후보 중 Claude 비전이 1장 선택, 개수 제한 없음 |
| 화면 전환 후보 장면 | D1 | 1초 1장 저해상도 → 화면 차이 + pHash 중복 제거(실측 18.7분 영상 18초). 대안 PySceneDetect |
| 캡처 클릭 크게 보기 | D4 | yet-another-react-lightbox(MIT) + 시간 이동 버튼 |
| 원본 삭제 | D5 | 720p 화면·m4a 소리 따로 받고 처리 후 삭제 |
| 출처 [n] 클릭 → 원본 구간 (`tour` 3/4) | E1 | 모든 문단·캡처·대본 줄에 시간, 클릭 시 왼쪽 플레이어 seek |
| 왼쪽 영상 플레이어, 패널 접기 | E2 | YouTube IFrame 공식 임베드(200×200 이상, 위에 덮지 않기, localhost로 띄우기) |
| 확장 → 마인드맵 (markmap, `mindmap`) | F1 | markmap(MIT) — 릴리스와 같은 라이브러리. PNG/SVG 다운로드 직접 추가 |
| 인포그래픽·표 | F2 | mermaid(MIT) + 마크다운 표 |
| LILY 채팅 + 제안 질문 칩 2개 | G1·G2 | 대본 전체를 컨텍스트에 넣고 Claude 세션 이어가기, 답의 [mm:ss] 근거를 대본과 대조. 추천 질문 3개 |
| 홈·라이브러리(컬렉션)·검색·휴지통 (`app-home`) | H1·H2 | SQLite 1개, 컬렉션=폴더 + 태그. 검색 FTS5 trigram + 2글자 이하 LIKE |
| 공유·내보내기·복사 (`share-menu`) | H3 | Markdown, 이미지 base64 포함 HTML 1파일, Playwright `page.pdf()` |
| 짧게·기본·길게·쉽게 (`length-menu`) | (빠짐) | 첫 버전 추가 제안 — 같은 대본으로 재요약 |
| 확장 템플릿 30여 종·나만의 템플릿 (`expand-templates`) | 다음 단계 | 템플릿 = 프롬프트 파일. 첫 버전엔 마인드맵만 |
| 하이라이트·메모, 찾기 및 바꾸기, 수정 모드 | (빠짐) | 다음 단계 |
| 구독·NOW·공개 노트·요금제·로그인 | — | 만들지 않음(LILYS_CHANGES 기록) |
| 다크 모드 | 디자인 원칙 | 릴리스에 없음 → 우리가 새로 설계 |

## FEATURES.md에 빠진 릴리스 기능 (첫 버전 추천 ★)
★ 문장별 출처 번호 + 클릭 이동 · ★ 목차와 맨 위 총평 · ★ 짧게/기본/길게/쉽게 · ★ 「요약/확장」 구조 · ★ 왼쪽·오른쪽 패널 접기 · 해설(문장 클릭 → 쉬운 설명) · 드래그한 부분을 채팅에 질문 · 하이라이트·메모 · 찾기/바꾸기 · 나만의 템플릿 · 링크 여러 개 한 번에 · (다음 단계) 반대 시각·액션아이템·댓글 분석·PPT·재생목록·DOCX/Notion 내보내기

## 추천 최종 구성
| 영역 | 추천 | 라이선스 | 상업 | 내 PC | 20분 영상 시간 |
|---|---|---|---|---|---|
| 포크 대상 | **BiliSum** 백엔드 구조 참고·포크 (UI는 새로) / 차선 BiliNote | MIT | ✅ | 가능 | — |
| 앱 형태 | 로컬 웹앱: FastAPI + React(Vite), 브라우저로 127.0.0.1 | MIT | ✅ | 가능(메모리 부담 작음) | — |
| 요약·블로그글·마인드맵 구조·번역 | **Claude Code `claude -p`** (Max 구독, 개인용 허용) | 약관 | ⚠️ 개인용만 | 가능 | 1.5~6분 |
| 로컬 대체 AI | **Gemma 4 12B** Q4 (Ollama) / 대안 Qwen3.5-9B 공식판 | Apache-2.0 | ✅ | 가능(12GB 안) | 1.5~5분 |
| 채팅 | Claude 세션 이어가기, 대본 전체 컨텍스트 / 로컬 대체 Qwen3.5-9B | — | ⚠️/✅ | 가능 | 답변당 수 초 |
| Gemini 무료 | 기본 끔(무료 입력이 학습·사람 검토에 쓰임) | 약관 | — | — | — |
| 자막 | yt-dlp json3 (수동+자동) / 대안 youtube-transcript-api | Unlicense / MIT | ✅ | 가능 | 수 초~30초 |
| 음성인식 | faster-whisper large-v3-turbo, GPU float16 / 대안 Qwen3-ASR-1.7B | MIT / Apache-2.0 | ✅ | 가능(cuBLAS cu12 설치 필요) | GPU 1~2분, CPU 4~8분 |
| 후보 장면 | 1초 1장 화면 차이 + pHash(직접 30~50줄) / 대안 PySceneDetect | — / BSD-3 | ✅ | 가능 | 약 20초 (PySceneDetect 약 2분) |
| 장면-문단 짝짓기 | 시간 범위 필터 → Claude 비전 선택, 보조 RapidOCR / 로컬 대체 Qwen3.5-9B 비전 | Apache-2.0 | ✅ | 가능 | 0.5~2분 |
| 저장·검색 | SQLite + FTS5 trigram + LIKE | Public Domain | ✅ | 가능 | — |
| 내보내기 | Markdown / 이미지 포함 HTML / Playwright PDF | Apache-2.0 | ✅ | 가능 | 수 초 |
| UI 컴포넌트 | Tailwind + shadcn/ui + Radix (릴리스와 같은 계열) | MIT | ✅ | 가능 | — |
| 폰트 | Pretendard(릴리스와 같음) / 영문 제목 Clash Display 대신 OFL 폰트 | OFL-1.1 | ✅ | — | — |
| 아이콘 | lucide (+ Tabler) | ISC / MIT | ✅ | — | — |
| 마인드맵 | markmap (+ PNG 내보내기 직접) / 대안 Mind Elixir | MIT | ✅ | 가능 | — |
| 도표 | mermaid | MIT | ✅ | 가능 | — |
| 크게 보기 | yet-another-react-lightbox | MIT | ✅ | — | — |
| 배치 참고 UI | open-notebook (3단 구성) | MIT | ✅ | — | — |
| 색 | 배경 #f4f5f4·#fff, 글자 #0c0d08, 라임 #dfff32, 보라 #6663fd (색 모방은 허용, 로고·마스코트·문구만 새로) | — | — | — | — |

**20분 영상 1개 합계(예상):** 자막 있음 + Claude 약 **4~10분** · 자막 없음 + GPU 음성인식 + Claude 약 **5~12분** · 전부 로컬(Gemma) 약 **6~14분**.

## 제외한 후보 (이유)
- keepongo/video-summarizer, yuxino-labs/koma: LICENSE 파일 없음 ❌ (koma는 유튜브 링크 미지원, GitHub 로그인 필수)
- mAE7777/vidistill: MIT지만 Gemini 키 필수·CLI뿐, 무료 데이터가 학습에 쓰임 → 참고만
- BibiGPT-v1: GPL-3.0 ⚠️, OpenAI 키 전제, 사실상 보관 상태
- AI-Media2Doc: 유료 클라우드 필수
- EXAONE(LG) ❌ 비상업 / Kanana 2·HyperCLOVA X SEED ⚠️ 조건부 / NLLB ❌ / Hunyuan-MT ❌(한국 제외) / jina-clip-v2 ❌
- PyMuPDF(AGPL ⚠️), WeasyPrint(Windows 설치 어려움)
- 27B 이상 로컬 모델: 내 PC에서 어려움(VRAM 초과)

## 조사 범위 보고
- **본 곳:** GitHub(gh 검색·LICENSE 직접), Hugging Face API·모델 카드, 공식 문서(code.claude.com·ai.google.dev·YouTube 정책), 릴리스 공식 사이트·가격표·도움말·sitemap·CSS/JS·앱 화면(로그인), 릴리스 사용법 영상 2개(자막 전체), HN(research MCP, 관련 글 없음), CTranslate2 이슈, Open ASR 리더보드
- **못 본 곳:** Reddit(research MCP 422 Timeout·속도 제한, Chrome은 reddit 차단), 호랑이 리더보드 점수표(패널 미로딩), AI Studio 한도 화면·Cohere/pyannote 카드(로그인 필요), Product Hunt·AlternativeTo·GeekNews·네이버 블로그(토큰 절약으로 생략), X(키 없음)
- **라이선스 미확인:** SenseVoice 가중치, 한국어 파인튜닝 whisper 2종(ghost613, o0dimplz0o), aehyok/video2blog, youtube-digest-mindmap, Clash Display 원문, 받아둔 Qwen3.5-9B 검열해제 파생판
- **메인 재확인:** BiliSum MIT·BiliNote MIT·keepongo LICENSE 없음(404)·Gemma 4 12B 존재(HF google/gemma-4-12B-it)
