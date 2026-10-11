# 02. 요약·채팅 AI 엔진 조사 (2026-10-06~07)

대상 기능: C1 핵심요약, C2 타임라인, C3 블로그글, C4 용어풀이, G1 채팅, G2 추천질문, B4 번역, F1 마인드맵 구조, F2 도표.
조건: Windows 로컬, 추가 비용 0원(Claude Code Max는 사용 가능), RTX 5070 12GB / RAM 32GB.

## 0. 결론 한눈에

| 구분 | 결론 |
|---|---|
| (가) Claude Code를 내 앱에서 호출 | **허용(개인용에 한해)**. 내 PC에서 공식 `claude` CLI를 내 Max 로그인으로 `claude -p` 실행 = "본인의 일반 사용". 남에게 배포·판매하거나 남의 로그인을 받으면 **금지**. Agent SDK를 구독 로그인으로 쓰는 것은 **회색**(문서가 API 키 사용을 안내) → CLI 서브프로세스 방식 권장 |
| (나) Gemini API 무료 | 한국 사용 가능, 유튜브 URL 직접 입력 가능(무료 등급 하루 8시간 분량), **하지만 무료 등급 입력·출력은 구글 제품 개선에 쓰이고 사람이 읽을 수 있음**. 모델별 RPM/RPD 공식 수치는 AI Studio 로그인 필요 → 미확인. 보조(선택)용 |
| (다) 로컬 모델 | **추천 1개: Gemma 4 12B (Q4, Apache-2.0)**. 대안: Qwen3.5-9B (Apache-2.0, 이미 받은 모델로 실측 60~65 토큰/초). 한국 특화 7~12B는 2025년 모델이 대부분이라 차선 |
| (라) 채팅 | 영상 1개는 **대본 전체를 컨텍스트에 넣기**(RAG 불필요). 근거는 `[mm:ss]` 줄머리 대본 + JSON 인용 + 코드 검증 |
| (마) 번역 | 같은 LLM 재사용(Claude → 로컬 Gemma/Qwen). 전용 번역 모델은 라이선스 문제(NLLB 비상업, Hunyuan-MT 한국 제외) |
| 전체 구성 | **"Claude 1순위 + 로컬 대체"가 맞다.** Gemini는 기본 끔(데이터 학습 문제), 자막 없는 영상 보조로만 선택 |

## 1. 조사한 곳

### 1-1. 2026년에 로컬·한국어 LLM을 비교하는 곳 (먼저 찾아 정한 목록)
| 곳 | 한 줄 설명 | 본 결과 |
|---|---|---|
| Hugging Face 모델 카드·LICENSE·공개 API (`/api/models`) | 가중치 라이선스·크기·벤치마크 원문 | 봄 (모든 후보) |
| Horangi(호랑이) 한국어 리더보드 4 (W&B, horangi.ai) | 한국어 GLP(언어)·ALT(정렬) 종합, 30B 이하 별도 표 | **표 못 읽음**(차트 패널 비로딩, 마지막 갱신 2026-04-29) → NOT_SOLVED |
| KMMLU / CLIcK / KoBALT / Ko-MT-Bench | 한국어 지식·문화 벤치마크(모델 카드에 수록) | 모델 카드 수치로 봄 |
| Qwen 공식 다국어 표 (MMMLU, MMLU-ProX, WMT24++) | 다국어·번역 능력 | 봄 |
| Reddit r/LocalLLaMA | 실사용 후기(속도·품질) | research MCP로 봄(일부 검색 한도 초과) |
| 국내 블로그(bibitlabs 등), GeekNews(news.hada.io) | 한국어 사용 후기 | bibitlabs 봄, GeekNews는 검색 결과만 |
| Artificial Analysis (artificialanalysis.ai) | 모델 지능·속도 비교 (r/LocalLLaMA에서 자주 인용) | 직접 안 봄(한국어 항목 없음) |
| llmbenchmarks.io | 개인 운영 벤치 집계(r/LocalLLaMA 댓글에서 새로 발견) | 안 봄 |
| Open Ko-LLM Leaderboard 후속 | 2024년 이후 갱신 신호 못 찾음 | 안 봄 |

### 1-2. 못 본 곳과 이유
- Horangi 점수표: 위 참고(Chrome에서도 표 미표시).
- Gemini AI Studio 한도 화면: 로그인 필요.
- Claude Max 한도 지원 문서(support.claude.com/…/11014257): 404.
- r/LocalLLaMA "Korean" 키워드 전체 검색: research MCP 속도 제한(422 Timeout).

## 2. (가) Claude Code를 앱에서 호출해도 되나

### 근거 원문 (Anthropic 공식)
1. Legal and compliance — https://code.claude.com/docs/en/legal-and-compliance
   - "Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."
   - "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."
   - "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users."
   - "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription"
   - "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."
2. Agent SDK overview — https://code.claude.com/docs/en/agent-sdk/overview
   - "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."
3. Headless — https://code.claude.com/docs/en/headless : `claude -p`, `--output-format json|stream-json`, `--json-schema`(구조화 출력) 공식 지원. 단 `--bare`는 "bare mode doesn't use your subscription login" → 구독으로 쓰려면 `--bare` 금지.
4. Authentication — https://code.claude.com/docs/en/authentication : `claude setup-token`은 "For CI pipelines, scripts, or other environments where interactive browser login isn't available" 용도로 구독 1년 토큰을 공식 제공.
5. Consumer Terms(2025-10-08 시행) — https://www.anthropic.com/legal/consumer-terms (페이지가 한국어로 표시됨) 3조: API 키를 통하거나 "당사가 이를 명시적으로 허용하는 경우를 제외하고" 봇·스크립트 등 자동화 방식 접속 금지. 12조: 위반 판단 시 통지 없이 중단·해지 가능.
6. Usage Policy(2025-09-15) — https://www.anthropic.com/legal/aup : 영상 대본 요약 금지 조항 없음. "Intentionally bypass capabilities, restrictions, or guardrails" 금지.
7. 한도 — costs 문서: 한도 초과 시 "You've hit your session limit" / "You've hit your weekly limit" 메시지, 5시간 창·주간 창. Claude 앱과 같은 한도를 공유(support 문서: "all activity in both tools counts against the same usage limits"). 정확한 수치는 비공개.

### 판정
| 사용 방식 | 판정 | 이유 |
|---|---|---|
| 내 앱(내 PC)이 공식 `claude` CLI를 서브프로세스로 `claude -p` 실행, 내 Max 로그인 | **허용** | 수정 안 한 공식 바이너리 + 본인 구독 + 본인만 사용 = "ordinary, individual usage". 스크립트 사용은 headless·setup-token 문서가 명시적으로 안내(약관 3조의 "명시적으로 허용" 해당) |
| Agent SDK(Python/TS)를 구독 로그인으로 내 앱에 내장 | **회색** | SDK도 같은 CLI를 실행하지만 문서가 "API 키를 쓰라"고 안내. 개인용이면 제재 사례 근거는 못 찾았으나 굳이 쓸 이유 없음 |
| 친구·사용자에게 앱 배포, 각자 로그인하게 함 | 회색→**계약 필요** | 배포·제품화는 Commercial Terms 대상이며 "claude.ai login 제공 금지" 조항에 걸림 |
| 내 Max로 남의 요청을 대신 처리(웹 서비스) | **금지** | "on behalf of their users" 정면 위반 |
| 한도 우회(계정 여러 개 돌려쓰기 등) | **금지** | AUP 우회 금지 |

### 위험(쉬운 말)
- 예: 하루에 영상 50개를 자동으로 돌리면 "개인의 일반 사용"을 넘는 자동화로 보일 수 있고, Anthropic은 통지 없이 계정을 막을 수 있다. 하루 몇~십여 개 수동 요청은 평소 Claude Code 쓰는 것과 같은 수준.
- 예: 영상 요약에 한도를 많이 쓰면 그날 코딩용 Claude Code 한도가 같이 줄어든다(같은 통).
- 예: 나중에 상업화하면 이 구조 그대로는 안 됨 → 사용자 각자 API 키 또는 로컬 모델로 바꿔야 함.

### 구현 시 권장 플래그 (조사 결과, 코드 아님)
- `claude -p --output-format json --json-schema <스키마> --model sonnet --tools "" --max-turns 1 --no-session-persistence --setting-sources "" --strict-mcp-config --disable-slash-commands` 형태.
  - 이유: 내 `~/.claude`의 훅(예: 한국어 검사 Stop 훅)·플러그인·MCP가 앱 호출마다 실행되면 느려지고 한도를 낭비. `--bare`는 구독 로그인을 못 써서 대신 위 조합. `--setting-sources ""` 동작은 구현 때 실측 필요.

## 3. (나) Gemini API 무료 사용량

| 항목 | 내용 | 출처 |
|---|---|---|
| 무료 모델 | Gemini 3.8/3.7/3.6/3.5 Flash, 3.5·3.1 Flash-Lite, 2.5 Pro/Flash/Flash-Lite 등 "Free of charge" (3.1 Pro Preview 등은 무료 없음) | https://ai.google.dev/gemini-api/docs/pricing (2026-10-01 갱신) |
| 모델별 RPM/TPM/RPD | **공식 표 없음**: "Rate limits … can be viewed in Google AI Studio" (2026-09-02 갱신). 2차 블로그 수치는 서로 달라(예: 3.5 Flash 하루 20회 vs 1,500회) **미확인** | https://ai.google.dev/gemini-api/docs/rate-limits |
| 유튜브 URL 직접 입력 | 가능. "The YouTube URL feature is in preview and is available at no charge." / "For the free tier, you can't upload more than 8 hours of YouTube video per day." / 공개 영상만. 2.5 이후 모델은 요청당 최대 10개. 약 100토큰/초(기본 해상도) → 20분 영상 ≈ 12만 토큰 | https://ai.google.dev/gemini-api/docs/video-understanding |
| 학습·사람 검토 | **사용됨.** "When you use Unpaid Services, including … the unpaid quota on Gemini API, Google uses the content you submit … to provide, improve, and develop Google products" / "human reviewers may read, annotate, and process your API input and output." / "Do not submit sensitive, confidential, or personal information to the Unpaid Services." | https://ai.google.dev/gemini-api/terms (2026-03-23 시행) |
| 지역 | 한국 사용 가능("South Korea" 목록에 있음). 18세 이상. EEA·스위스·영국 사용자에게 앱 제공 시 유료만 | https://ai.google.dev/gemini-api/docs/available-regions |

판단: 공개 유튜브 영상 요약 자체는 민감하지 않지만, 내 채팅 질문·메모까지 구글이 학습·열람할 수 있음. **기본 엔진으로는 쓰지 않고**, "자막도 없고 음성인식도 불안한 영상"이나 "화면 내용(슬라이드 글자 등) 이해"가 필요할 때 사용자가 켜는 선택 기능으로 둔다. 상업 사용: 무료 등급도 약관상 앱 제공 가능(EEA 등 제외) → ⚠️(데이터 사용 고지 필요).

## 4. (다) Ollama 로컬 모델

### 4-1. 내 PC 실측 (이미 받은 Qwen3.5-9B 파생 Q6_K, 검열해제 커뮤니티판, Ollama 0.35.1, think 끔)
| 조건 | 프롬프트 | 입력 처리 속도 | 생성 속도 | VRAM(전체) | 비고 |
|---|---|---|---|---|---|
| num_ctx 4096, 첫 실행 | 123 토큰 | — | 31 토큰/초 | 10.1 GB | 모델 로딩 70초(첫 1회) |
| num_ctx 4096, 재실행 | 짧음 | — | **65 토큰/초** | — | 한국어 3줄 요약 자연스러움("2027 년"처럼 띄어쓰기 어색 1곳) |
| num_ctx 32768 | **16,347 토큰** | **3,390 토큰/초** | **61 토큰/초** | **11.1 GB, 100% GPU** | 대본 25k 토큰급도 들어감(Qwen3.5는 선형 어텐션 혼합 구조라 KV 캐시가 작음) |

→ 60분 영상(25k 토큰) 입력 처리 약 8초. 생성이 시간 대부분을 차지.

### 4-2. 후보 표
| 모델 | 크기·양자화 | VRAM 사용(추정/실측) | 한국어 품질 근거 | 가중치 라이선스 | 상업 | 내 PC | 예상 속도(생성) |
|---|---|---|---|---|---|---|---|
| **Gemma 4 12B-it** (2026-05) | 12B, Q4 (구글 공식 QAT q4_0 GGUF 있음) | 약 7GB + KV, 32k 컨텍스트 ≈ 9~10GB(추정) | 140+언어 학습, MMMLU 83.4(카드). r/LocalLLaMA "Siri 같은 범용 비서로 이 크기 최고", "요약기로 잘 씀" / 4k 넘으면 지시 이해 떨어진다는 후기도 1건 | Apache-2.0 (gemma_4_license 페이지 확인) | ✅ | 가능 | 약 45~55 토큰/초(추정) |
| **Qwen3.5-9B** (2026-02) | 9.7B, Q4~Q6 | Q6 실측 9.2GB(32k 컨텍스트 포함 11.1GB) | MMMLU 81.2, MMLU-ProX 76.3, WMT24++ 72.6(카드). 국내 후기: **한국어 중간에 한자 섞임**("處理") 보고 | Apache-2.0 | ✅ (단, 받아둔 파일은 커뮤니티 검열해제판 → 공식판 권장) | 편함 | **61~65 토큰/초(실측)** |
| Gemma 4 E4B | 4.5B 유효, Q4 | 약 5GB | 국내 후기 "Qwen3.5-9B보다 한국어가 깔끔·빠름". 영어권 후기 "4B는 많이 약함, 12B가 최소" | Apache-2.0 | ✅ | 편함 | 80+ 토큰/초(추정) |
| A.X 4.0 Light (SKT, 2025-07) | 7.3B | 약 5~6GB(Q4) | KMMLU 64.15, CLIcK 68.05(카드). **컨텍스트 16,384** → 40분 이상 영상은 한 번에 못 넣음 | Apache-2.0 | ✅ | 편함 | 70 토큰/초(추정) |
| Mi:dm 2.0 Base (KT, 2025-07) | 11.5B | 약 7~8GB(Q4) | 카드에 KMMLU·LogicKor 수록(수치 미추출) | MIT | ✅ | 가능 | 50 토큰/초(추정) |
| Kanana 1.5 8B (카카오, 2025-05) | 8B | 약 5~6GB(Q4) | 카드에 KMMLU·KoMT-Bench 수록 | Apache-2.0 | ✅ | 편함 | 65 토큰/초(추정) |
| Kanana 2 3B (2026-07) | 3.5B | 약 3GB | 미확인 | Kanana Open License: API·SI·온디바이스로 **제3자에게 제공·판매** 시 별도 상업 라이선스, 자체 서비스 운영은 허용 | ⚠️ | 편함 | 빠름 |
| HyperCLOVA X SEED Think 14B (네이버, 2025-07) | 14.7B | Q4 ≈ 9GB + KV, 컨텍스트 32k → 빠듯 | 카드에 KMMLU·HAERAE·LogicKor 수록 | 자체 라이선스: 월 사용자 1천만 초과 또는 **네이버와 경쟁하는 제품**이면 별도 허가 | ⚠️ | 버거움(빠듯) | 35~45 토큰/초(추정) |
| EXAONE 4.0 1.2B / 4.5 33B (LG) | 1.2B / 33B | — | 한국어 특화 | **EXAONE License 1.2 - NC: 상업 금지**(3.1조) | ❌ | 1.2B는 품질 부족, 33B는 어려움 | — |
| Qwen3.5-35B-A3B / Gemma 4 26B-A4B (MoE) | 35B/26B, 활성 3~4B | Q4 18~21GB → VRAM 초과, RAM 분할 | 상위 품질 | Apache-2.0 | ✅ | 버거움(RAM 분할 시 15~30 토큰/초 추정) | — |
| Qwen3.8-27B / Gemma 4 31B | 27~31B | 16GB+ | 상위 품질 | Apache-2.0 | ✅ | **내 PC에서 어려움** → 대안 Gemma 4 12B | — |
| Kanana 2 30B-A3B | 30B MoE | RAM 분할 필요 | 미확인 | Kanana License(위와 같은 4.1조 + 월 1천만 초과 조항) | ⚠️ | 버거움 | — |

추천: **Gemma 4 12B**(라이선스 깨끗, 한국어 자연스러움 평이 좋음, 컨텍스트 256K). **대안: Qwen3.5-9B 공식판**(실측 빠름·긴 대본에 강함, 단 한자 섞임 → 후처리로 한자 감지 시 재생성). 최종 결정 전 같은 대본 3개로 두 모델 비교 권장(새 모델 다운로드는 이번 조사에서 안 함).

### 4-3. 컨텍스트·VRAM
- 20분 대본 ≈ 영어 4~5k / 한국어 7~9k 토큰, 60분 ≈ 20~25k 토큰. 프롬프트·출력 포함 num_ctx 32768이면 충분.
- Ollama 기본 컨텍스트가 작으면 대본이 잘림 → 요청마다 `num_ctx` 지정 필수.
- 12B Q4 + 32k KV는 12GB에 들어가는 것으로 추정(Gemma 4는 슬라이딩 윈도 혼합 구조). 음성인식(whisper large-v3-turbo 3~5GB)과 **동시에 올리면 초과** → 단계별로 순서 실행(음성인식 끝나면 해제 후 LLM).

## 5. (라) 채팅(G1): 전체 컨텍스트 vs RAG
- 결론: **전체 대본 넣기.** 영상 1개 6k~25k 토큰은 Claude(20만+), Qwen3.5(262K), Gemma 4 12B(256K) 모두 여유. RAG는 검색 실패 시 답을 놓치고 부품(임베딩·벡터DB)이 늘어남.
- 근거 타임스탬프: 대본을 `[12:34] 문장` 줄 형식으로 넣고, 답을 JSON(`answer`, `citations:[{"t":"12:34","quote":"..."}]`)으로 받음 → 코드가 인용 문장을 실제 대본 구간에서 찾아 가장 가까운 시작 시간으로 보정(없으면 근거 표시 제거). Claude는 `--json-schema`로 형식 강제, Ollama는 `format` JSON 스키마 사용.
- 캐시: Claude는 같은 세션 `--resume`로 대본 재전송 비용 감소(구독 캐시 1시간). Ollama는 같은 모델·프롬프트 앞부분이면 KV 재사용.
- RAG가 필요해지는 때: 보관함 전체 검색·여러 영상 교차 질문(다음 단계). 그때 임베딩 후보:

| 모델 | 라이선스 | 상업 | 비고 |
|---|---|---|---|
| BAAI/bge-m3 | MIT | ✅ | 다국어, Ollama 라이브러리 있음 |
| nlpai-lab/KURE-v1 | MIT | ✅ | bge-m3 한국어 미세조정 |
| nlpai-lab/KURE-v2 (2026-08) | Apache-2.0 | ✅ | 1.5억 파라미터로 가벼움(성능 미확인) |
| intfloat/multilingual-e5-large | MIT | ✅ | 무난 |

## 6. (마) 번역(B4)
| 후보 | 라이선스 | 상업 | 판단 |
|---|---|---|---|
| **같은 LLM 재사용**(Claude → Gemma 4 12B/Qwen3.5-9B) | 위와 같음 | ✅ | **추천.** 문맥·용어 일관성 좋고 부품 추가 없음. Qwen3.5-9B WMT24++ 72.6 |
| NLLB-200 (Meta) | CC-BY-NC-4.0 | ❌ | 개인용만 가능, 문장 단위라 구어체 자막에 약함 |
| M2M100 1.2B | MIT | ✅ | 2020년 모델, 품질 낮음 |
| MADLAD-400 3B/10B (구글) | Apache-2.0 | ✅ | 상업 가능한 전용 번역 차선책 |
| TranslateGemma 4B/12B (구글, 2026-01) | Gemma 이용약관, HF 승인 필요(gated) | ⚠️ | 품질 기대되나 약관·승인 절차 |
| Seed-X-PPO-7B (ByteDance) | OpenMDW-1.0 | ✅ | 전용 번역 7B, 차선책 |
| Hunyuan-MT-7B (텐센트) | 텐센트 라이선스: **"Territory … excluding … South Korea"** | ❌ | 한국에서 사용 불가 |

- 속도 예: 20분 영어 대본 → 한국어 약 7~9k 토큰 출력. Claude 약 2~3분, 로컬 9B(61 토큰/초) 약 2.5분. 구간별로 나눠 진행률 표시.

## 7. 기능별 추천 엔진

| 기능 | 1순위 | 대체(한도 소진·오프라인) | 이유 |
|---|---|---|---|
| C1 핵심요약 | Claude(sonnet) | Gemma 4 12B | 짧은 출력, 품질 차이 작음 |
| C2 타임라인 | Claude | Gemma 4 12B | JSON(제목·설명·시작시간) 형식 강제 필요 → `--json-schema`/Ollama format |
| C3 블로그글 | **Claude** | Gemma 4 12B | 가장 중요·가장 긴 글. 품질 차이가 가장 큼 |
| C4 용어풀이 | Claude | Gemma 4 12B | 일반 지식 필요 → 큰 모델 유리 |
| G1 채팅 | Claude(세션 이어가기) | Qwen3.5-9B(긴 컨텍스트·빠름) | 전체 대본 + 근거 인용 |
| G2 추천질문 | 로컬(Gemma 4 12B) | Claude | 한도 아끼기, 품질 영향 작음 |
| B4 번역 | Claude | Gemma 4 12B / Qwen3.5-9B | 출력이 길어 한도 많이 씀 → 한도 부족하면 로컬 우선으로 전환 가능 |
| F1 마인드맵 구조 | Claude(C2와 한 번에 JSON) | Gemma 4 12B | 계층 JSON → 프론트에서 그림 |
| F2 도표 | Claude | Gemma 4 12B | 필요할 때만 표 JSON 생성 |

- **"Claude 1순위 + 로컬 대체" 구성이 맞다.** 근거: 비용 0원, 품질 최고, 약관상 개인용 허용. 로컬은 한도 메시지("session limit"/"weekly limit") 감지 시 자동 전환 + 설정에서 "항상 로컬" 선택.
- 호출 수 줄이기: C1+C2+C4+F1+G2는 한 번의 JSON 호출로 묶고, C3·B4만 별도 호출(영상 1개당 Claude 2~3회).

## 8. 20분 영상 1개 요약 예상 시간 (자막 있음, 대본 받은 뒤 AI 단계만)
| 엔진 | C1~C4+F1+G2 | B4 번역(해외 영상) | 합계 | 근거 |
|---|---|---|---|---|
| Claude Code Max (`claude -p`, sonnet) | 약 1.5~3분 | +2~3분 | 1.5~6분 | CLI 시작 수 초 + 출력 약 4k 토큰. 추정(실측 안 함) |
| Qwen3.5-9B 로컬 | 약 1~1.5분 | +2.5분 | 1~4분 | 실측 61~65 토큰/초, 첫 로딩 +10~70초 |
| Gemma 4 12B 로컬 | 약 1.5~2분 | +3분 | 1.5~5분 | 추정 45~55 토큰/초 |
| Gemini Flash 무료(URL 직접) | 약 0.5~1분 | 포함 가능 | 1분 내외 | 추정, 무료 한도·데이터 사용 조건 |

## 9. 라이선스·수치 미확인 목록
- Gemini 무료 등급 모델별 RPM/TPM/RPD (AI Studio 로그인 필요).
- Claude Max 5시간·주간 한도의 실제 크기(비공개) → 구현 후 실측.
- Horangi 4 리더보드의 30B 이하 점수.
- Gemma 4 12B의 내 PC 실제 속도·VRAM(미다운로드, 추정치).
- Kanana 2 3B, Mi:dm 2.0, Kanana 1.5 8B의 요약 품질(카드 수치 외 후기 없음).
- TranslateGemma의 Gemma 이용약관 세부(gated라 원문 미열람).
- 받아둔 Qwen3.5-9B 검열해제판(DavidAU)의 파생 라이선스: 원본 Apache-2.0이지만 파생판 카드 미확인 → 공식 Qwen/Qwen3.5-9B GGUF로 교체 권장.
