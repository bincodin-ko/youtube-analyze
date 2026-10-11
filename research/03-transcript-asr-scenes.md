# 03. 자막·음성인식(B) / 장면 캡처(D1) / 문단↔장면 짝짓기(D2) / 원본 삭제(D5) 조사

> 조사일 2026-10-06~07 · 조사원: oss-scout(B·D 영역)
> 표기: **[실측]** 내 PC에서 직접 잰 값 / **[추정]** 문서·벤치마크로 계산한 값 / **[문서]** 공식 문서·모델 카드에 적힌 값
> 상업 사용: ✅ 가능 · ⚠️ 조건부 · ❌ 불가 · 미확인

---

## 0. 한 장 요약 (기능별 추천)

| 기능 | 추천 1순위 | 대안 | 20분 영상 시간 |
|---|---|---|---|
| B1 자막 받기 | **yt-dlp** (`--write-subs --write-auto-subs --sub-format json3`) | youtube-transcript-api 1.2.4 | 수 초~30초 [실측] |
| B2 자막 없을 때 음성인식 | **faster-whisper large-v3-turbo, GPU float16** (기존 스킬 그대로 재사용) | 한국어 정확도 우선이면 **Qwen3-ASR-1.7B**(+ForcedAligner) | GPU 약 1분 [추정] / CPU small 약 4분 [실측] |
| B3 시간별 대본 | 자막 json3 / whisper 세그먼트를 그대로 `[mm:ss]` 줄로 | — | 즉시 |
| D1 후보 장면 | **1fps 저해상도 프레임 차이 + pHash 중복 제거** (직접 30줄) | PySceneDetect `detect-adaptive`/`detect-hash` | 약 20초 [실측] (PySceneDetect는 약 2분 [실측]) |
| D2 문단↔장면 | **(a) 타임스탬프 창으로 후보 좁히기 → (c) Claude Code(`claude -p`)가 이미지 보고 고르기** | (c') Ollama 비전(이미 받은 Qwen3.5-9B, vision 지원 확인) / (d) RapidOCR로 슬라이드 글자 매칭 보조 | 문단 10~20개 기준 1~3분 [추정] |
| D5 원본 삭제 | 720p **영상만**(`bv*[height<=720]`) + 오디오 따로 받고 캡처 후 삭제 | — | 다운로드 15초 [실측] |

---

## 1. 조사한 곳

### 1-1. "요즘 어디서 비교하나" 검색으로 만든 목록
| 출처 | 한 줄 설명 | 본 결과 |
|---|---|---|
| HF Open ASR Leaderboard (hf-audio/open_asr_leaderboard) | 영어·유럽어·롱폼 WER 순위. **한국어 트랙 없음** | Reddit에서 가장 많이 추천되는 기준. 한국어엔 직접 근거 못 됨 |
| HF 모델 API `api/models?search=` | 모델 다운로드 순위·라이선스·언어 메타데이터 | 본 곳(Qwen3-ASR, Cohere, SenseVoice, Parakeet, Canary, Voxtral, Granite, VibeVoice, Fun-ASR, 한국어 whisper 파생 등) |
| HF 모델 카드 원문(raw README) | 라이선스·언어·벤치마크 표 | 본 곳. Cohere 카드는 gated라 본문 못 봄 |
| GitHub (`gh search repos`, `gh api`) | 코드 라이선스·릴리스·이슈 | 본 곳. 검색 API 한도(403)에 한 번 걸려 일부 재시도 |
| r/LocalLLaMA (Google `site:reddit.com` → research MCP로 본문) | 실사용 후기 | 2개 스레드 정독(아래) |
| Hacker News (research MCP) | 실사용 후기 | yt-dlp 자막 관련 검색, 쓸 만한 글 없음 |
| arXiv Qwen3-ASR 기술보고서(2601.21337) | 다국어 Fleurs CER | 검색 요약으로 확인 |
| **openasr.org** (새로 찾음) | 로컬 실행 중심 ASR 모델 카탈로그(크기·메모리·속도) | Cohere Transcribe 항목 확인(한국어 수치 없음) |
| **soniqo.audio/benchmarks** (새로 찾음) | Qwen3-ASR vs Whisper 속도·메모리(Apple M5, 영어만) | 참고만 |
| **whispernotes.app 블로그** (새로 찾음) | Qwen3-ASR vs Whisper Turbo 언어별(Fleurs, Mac) | 한국어 CER 수치 확보 |
| yt-dlp 위키 PO-Token-Guide | 2026 YouTube 막힘 현황 | 본 곳(2026-07-12 갱신) |

### 1-2. 못 본 곳과 이유
- **Cohere Transcribe 모델 카드 본문**: HF 로그인+동의 필요(gated) → 한국어 WER 미확인 (NOT_SOLVED 기록)
- **pyannote community-1 카드 본문**: gated → 라이선스(CC-BY-4.0)·gated 여부만 API로 확인
- **HF Open ASR Leaderboard Space 화면**: 한국어 트랙이 없다는 것이 다수 출처에서 일치해 직접 열지 않음
- **Papers with Code**: 2025년 서비스 종료(HF Papers로 이전)로 대상에서 제외

---

## 2. 실측 결과 (2026-10-06, 내 PC)

테스트 영상: 3Blue1Brown "But what is a neural network?" (`aircAruvnKk`, 18분 40초, 수동 한·영 자막 있음, 애니메이션 위주). 개인 테스트용으로 받았다가 **모두 삭제함**.

| 항목 | 방법 | 결과 |
|---|---|---|
| 자막 목록 | `yt-dlp --list-subs` | **5.9초**, 수동 자막 en/ko 표시. 쿠키·PO token 없이 성공 |
| 자막 받기 | `yt-dlp --write-subs --write-auto-subs --sub-langs ko,en,ko-orig,en-orig --sub-format json3` | **27.2초**, 3개 파일(ko, en, en-orig 자동) 성공 |
| 자막 받기 | youtube-transcript-api 1.2.4 (집 IP) | **3.6초**, 31개 언어 목록 + ko 255줄 성공 |
| 자막 구조 | json3 분석 | 수동 자막=문장 단위(255줄), **자동 자막(en-orig)=단어별 시각(tOffsetMs) 2,867개** 포함 → 짝짓기에 유리 |
| 720p 영상만 | `-f "bv*[height<=720][vcodec^=avc1]"` | **8.5초**, 23.8MB (h264 1280×720, 60fps) |
| 오디오만 | `-f "ba[ext=m4a]"` | **6.3초**, 18.1MB |
| PySceneDetect 0.7.1 Content | `uvx --from scenedetect[opencv] scenedetect detect-content` (CPU) | **118.7초**(uvx 첫 설치 포함), **8장면**만 검출 |
| PySceneDetect Adaptive | `detect-adaptive` | **113.1초**, 37장면 |
| PySceneDetect Hash | `detect-hash` | **104.1초**, 47장면 |
| ffmpeg scene 필터 | `scale=320,select='gt(scene,0.3)'` | **14.7초**, **0장면** (서서히 바뀌는 애니메이션은 못 잡음) |
| 1fps 프레임 차이 + pHash | ffmpeg 1fps 320×180 회색 → 평균 차이>12 → 구간 끝 직전 프레임 → pHash 거리≤6 제거 | **18.3초**(디코딩 6.9 + 분석 11.4), 57전환 → 54대표 → **45장 후보** |
| faster-whisper small, CPU int8 | 스킬 venv(ctranslate2 4.8.2, faster-whisper 1.2.1), 16스레드, VAD | **225.4초**(1120초 오디오 → 약 5배속), 384세그먼트, 영어 자동 감지 |
| faster-whisper small, CUDA float16 | 같은 venv | **실패**: CUDA 장치 1개 인식했지만 `cublas64_12.dll` 없음 → cuBLAS 런타임 설치 필요 |

**실측에서 얻은 교훈**
1. 강의·애니메이션·슬라이드 영상은 "컷" 감지기(Content, ffmpeg scene)가 거의 못 잡는다(8개, 0개). 서서히 바뀌는 화면엔 **Adaptive/Hash 또는 1초 간격 프레임 차이**가 맞다.
2. 1fps 프레임 차이 방식이 PySceneDetect보다 **약 6배 빠르고**(18초 vs 104~119초) 후보 수도 적당(45장/19분).
3. 집 IP에서는 yt-dlp·youtube-transcript-api 둘 다 쿠키 없이 잘 된다. (yt-dlp는 Deno가 설치돼 있어 YouTube JS 풀이 가능 — winget Deno 경로가 PATH에 있음)

---

## 3. B. 자막·대본 후보

### 3-1. 자막 받기 (B1)
| 이름 | URL | 라이선스 | 상업 | 최근 | 비고 |
|---|---|---|---|---|---|
| **yt-dlp** | github.com/yt-dlp/yt-dlp | Unlicense | ✅ | 2026-09-27 push, 설치본 2026.08.19 | 수동/자동 자막, json3/vtt/srv3 선택, 언어 선택(`ko,en,*-orig`). 2026 PO token 가이드: web/web_safari 클라이언트는 자막에도 PO token 필요하지만 **기본 클라이언트 조합으로 내 PC에서 쿠키 없이 성공 [실측]**. 막히면 `bgutil-ytdlp-pot-provider` 플러그인(위키 권장) |
| youtube-transcript-api | github.com/jdepoix/youtube-transcript-api | MIT | ✅ | v1.2.4 (2026-01-29) | 빠름(3.6초). 차단(RequestBlocked/IpBlocked)은 주로 **클라우드 IP** 문제. 쿠키 인증은 계정 정지 위험이 문서에 경고됨. 로컬 개인용이면 대안으로 충분 |

**추천**: yt-dlp 하나로 통일(영상 다운로드도 같은 도구). 자동 자막은 `*-orig`(원어 자동) json3를 받으면 단어 시각이 있어 문단 시간 범위 계산이 정확하다. 번역 자막(B4)은 YouTube 자동 번역(`ko` 자동번역 트랙) 또는 LLM 번역.

### 3-2. 자막 없을 때 로컬 음성인식 (B2)

| 이름 | URL | 라이선스 코드/가중치 | 상업 | 최근 | 한국어 품질 근거 | Blackwell(RTX 5070) | VRAM | 20분 오디오 예상 | 내 PC |
|---|---|---|---|---|---|---|---|---|---|
| **faster-whisper + large-v3-turbo** | github.com/SYSTRAN/faster-whisper · HF deepdml/faster-whisper-large-v3-turbo-ct2 | MIT / MIT | ✅ | v1.2.1(2025-10), CT2 4.8.2(2026-08-31) | Fleurs ko CER 약 4.25% (whispernotes, Mac) | **CT2 4.8 Windows 휠은 CUDA 12.8로 빌드**(빌드 스크립트 확인) → 가능. 단 cuBLAS 12 DLL 별도 설치 필요[실측], **int8_float16에서 RTX 50 오류 보고(#1865)** → float16 사용 | 약 3~5GB [문서: large-v2 fp16 4.5GB] | GPU 약 1분, batch 8이면 30초 내외 [추정: README large-v2 13분 오디오 63초/RTX 3070Ti] | 가능 |
| faster-whisper + small (현재 캐시) | HF Systran/faster-whisper-small | MIT / MIT | ✅ | — | large보다 확실히 낮음(근거 수치 없음) | CPU 사용 | RAM 1.5GB | **CPU 약 4분 [실측 225초/18.7분]** | 가능(비상용) |
| faster-whisper + large-v3 | HF Systran/faster-whisper-large-v3 | MIT / Apache-2.0 | ✅ | — | Fleurs ko CER 4.08% (U00 PR, 60문장) | 위와 같음 | 약 4.5GB | GPU 약 1.5분 [추정] | 가능 |
| **Qwen3-ASR-1.7B** (+ForcedAligner-0.6B) | github.com/QwenLM/Qwen3-ASR · HF Qwen/Qwen3-ASR-1.7B | Apache-2.0 / Apache-2.0 | ✅ | 2026-01 공개, 06 갱신 | **Fleurs ko CER 3.34~3.54%** (whisper large-v3 4.08%, turbo 4.25%보다 좋음, 두 출처). Reddit 한국어 원어민 OP "상용급에 가깝다" | PyTorch 필요 → **cu128 휠(torch 2.7+)이면 가능**. vLLM은 Linux 위주 → Windows는 transformers 백엔드 | 약 4~6GB [추정, bf16 1.7B+aligner 0.9B] | GPU 1~3분 [추정] | 가능(설치 무거움, 수 GB) |
| Qwen3-ASR-0.6B | HF Qwen/Qwen3-ASR-0.6B | Apache-2.0 | ✅ | 2026-01 | 1.7B보다 낮음(수치 미확인) | 위와 같음 | 약 2~3GB [추정] | GPU 1분 내 [추정] | 가능 |
| Cohere Transcribe 03-2026 (2B) | HF CohereLabs/cohere-transcribe-03-2026 | Apache-2.0(카드 메타) | ✅ | 2026-03 | Open ASR(영어) 1위 5.42%. **한국어 수치 미확인**(카드 gated). 일본어 Fleurs CER 2.89%로 1위(HEROZ 블로그) → 한국어도 유망 | transformers/ONNX → 가능할 것 | fp16 3.9GB / q8 2.3GB (openasr.org) | 약 6분? [3.2배속 표기 기준, 하드웨어 미상] | 가능, 단 HF 로그인·동의 필요 |
| Voxtral Mini 4B Realtime 2602 | HF mistralai/Voxtral-Mini-4B-Realtime-2602 | Apache-2.0 | ✅ | 2026-01 | Fleurs **ko WER 15.74%**(480ms 지연), 오프라인 Transcribe 2.0도 12.29% → 한국어 약함 | vLLM 권장 | **16GB 이상 권장** | — | 버거움 |
| SenseVoiceSmall | github.com/FunAudioLLM/SenseVoice · HF FunAudioLLM/SenseVoiceSmall | MIT / **FunASR MODEL_LICENSE(other)** | 미확인(커스텀 모델 라이선스) | 코드 2026-09 | 한국어 지원(zh/en/yue/ja/ko), 한국어 수치 미확인. 매우 빠름(비자기회귀) | ONNX/GGUF CPU 가능 | 1GB 미만 | CPU 1분 내 [추정] | 가능, 타임스탬프 약함 |
| Fun-ASR-Nano-2512 | HF FunAudioLLM/Fun-ASR-Nano-2512 | Apache-2.0(메타) | ✅ | 2026-06 | ko 포함 13개 언어. Reddit: 정확도 좋으나 **타임스탬프 부정확** | PyTorch | 미확인 | 미확인 | 가능 |
| VibeVoice-ASR (MS) | HF microsoft/VibeVoice-ASR | MIT | ✅ | 2026-01 | ko 포함 50+언어, 60분 한 번에 + 화자분리. Reddit "가장 정확하지만 무거움" | PyTorch | **8.7B 파라미터 → bf16 약 17GB** | — | 버거움(양자화 필요) |
| whisper.cpp | github.com/ggml-org/whisper.cpp | MIT / MIT(whisper 가중치) | ✅ | b5130(2026-09-11) | whisper와 동일 | **공식 Windows GPU 바이너리는 CUDA 11.8/12.4 빌드뿐 → Blackwell 미확인**. 직접 빌드(CUDA 12.8+/Vulkan) 필요 | large 약 4GB | GPU 약 1분 [추정] | 가능하나 설치 손 많음 |
| WhisperX (정렬·화자분리) | github.com/m-bain/whisperX | BSD-2 / 정렬 모델 kresnik/wav2vec2-large-xlsr-korean Apache-2.0, 화자분리 pyannote community-1 **CC-BY-4.0 + gated** | ✅(화자분리는 출처표시 조건 ⚠️) | 3.8.6(2026-05) | 단어 단위 시각 정확. 한국어 정렬 모델 있음 | **torch~=2.8 + cu128 인덱스 지정** → 가능 | 4~6GB+ | GPU 1~2분 [추정] | 가능하나 무거움(PyTorch 수 GB). 화자분리는 HF 로그인 필요 |
| 한국어 파인튜닝 whisper | HF ghost613/faster-whisper-large-v3-turbo-korean, o0dimplz0o/Whisper-Large-v3-turbo-STT-Zeroth-KO-v2, tellang/whisper-large-v3-turbo-ko | ghost613·o0dimplz0o: **카드에 라이선스 없음 → 미확인** / tellang: MIT | 미확인 / ✅ | 2024~2026-03 | o0dimplz0o: Zeroth CER 6.6%(같은 도메인 평가). tellang은 Fleurs로 학습 → Fleurs 비교 무의미. 유튜브 일반 영상 근거 없음 | CT2 변환판은 faster-whisper와 동일 | turbo급 | turbo와 동일 | 가능, 근거 약함 → 비추천 |
| NVIDIA Parakeet TDT v3 / Canary-1b-v2 / Canary-Qwen-2.5B | HF nvidia/* | CC-BY-4.0 | ✅(출처표시) | 2025~2026 | **한국어 미지원**(25개 유럽어/영어) | — | — | — | 제외 |
| IBM Granite Speech 4.1 | HF ibm-granite/* | Apache-2.0 | ✅ | 2026 | **한국어 미지원**(7개 언어) | — | — | — | 제외 |
| Meta Omnilingual ASR | HF facebook/omniASR-* | Apache-2.0 | ✅ | 2025-11 | 1600+언어, 한국어 품질 근거 미확인 | PyTorch(fairseq2) | 7B는 무거움 | 미확인 | 보류 |

**Reddit 실사용 요약** (r/LocalLLaMA 2026-03, 2026-07 스레드):
- Qwen3-ASR: "한국어를 놀랄 만큼 잘 처리" (한국어 원어민 글쓴이). 반면 "영어 TV 대사 일부 누락·환각", "타임스탬프 정렬기(ForcedAligner)는 11개 언어만" 지적. → **한국어는 그 11개에 포함**됨(모델 카드 확인).
- "Whisper만큼 타임스탬프가 정확한 모델은 아직 없다", "새 모델로 바꾸기 전 내 오디오로 WER+타임스탬프 오차를 직접 재라"는 조언.
- 우리 앱은 **타임스탬프가 핵심**(E1·D2) → 기본은 whisper 계열, 한국어 정확도 업그레이드 옵션으로 Qwen3-ASR.

**B2 추천**: 1순위 **faster-whisper large-v3-turbo GPU float16** — 이미 있는 스킬 코드·패키지 그대로, 설치 추가는 cuBLAS/cuDNN DLL(`pip install nvidia-cublas-cu12 nvidia-cudnn-cu12`, 약 1GB 미만~수백 MB)뿐, 타임스탬프 안정. 2순위(한국어 정확도 우선) **Qwen3-ASR-1.7B + Qwen3-ForcedAligner** — PyTorch cu128 설치(수 GB) 감수. 둘 다 자체 한국어 샘플로 비교 실측 후 확정 권장.

---

## 4. D1. 장면 캡처 후보

| 이름 | URL | 라이선스 코드/가중치 | 상업 | 최근 | 방식 | GPU | 20분 720p 처리 [실측/추정] | 강의·슬라이드 적합 |
|---|---|---|---|---|---|---|---|---|
| **1fps 프레임 차이 + pHash (직접 구현)** | ffmpeg + numpy + imagehash(BSD-2) | — / — | ✅ | — | 1초 1장 저해상도 → 평균 화소 차이 → 구간 끝 직전 프레임(점진적 등장 슬라이드의 완성 상태) → pHash 중복 제거 | 불필요 | **약 20초 [실측 18.3초/18.7분]** | 좋음 |
| PySceneDetect 0.7.1 | github.com/Breakthrough/PySceneDetect | BSD-3 | ✅ | 2026-07-22 | Content(컷)/Adaptive/Hash/Threshold/Histogram 감지기 | 불필요(CPU) | **104~119초 [실측]**, 60fps 영상. `--frame-skip 1`이나 30fps면 약 절반 [추정] | Adaptive·Hash는 괜찮음, Content는 8개만 |
| ffmpeg scene 필터 | ffmpeg 내장 | LGPL/GPL(ffmpeg 빌드) | ✅(바이너리 호출) | 9.0.2 | `select='gt(scene,X)'` | 불필요 | **14.7초 [실측]** | 0.3에서 0개 → 부적합(임계값 낮추면 잡음 증가) |
| TransNetV2 | github.com/soCzech/TransNetV2 | MIT / MIT(저장소 포함) | ✅ | 2023(코드 정체) | 신경망 컷 감지(영화·뉴스 컷용) | TF 또는 PyTorch 포트, GPU면 빠름 | 미측정 | 슬라이드·애니메이션 전환엔 과함 |
| billyma128/video-course-notes | github.com/billyma128/video-course-notes | MIT | ✅ | 2026-06 | **슬라이드 전용 아이디어**: 전체 장면감지는 점진적 등장을 0.001로 보고 못 잡음 → 회색 프레임 차이로 "페이지 넘김"(≈1.5+) vs "부분 등장"(≤0.9) 구분, **다음 넘김 직전 프레임** 캡처 | 불필요 | 미측정 | 매우 좋음(위 직접 구현과 같은 원리) |
| binh234/video2slides | github.com/binh234/video2slides | MIT | ✅ | 2024-03 | 배경차분/프레임차 + 중복 제거 → PDF | 불필요 | 미측정 | 좋음(오래됨) |
| tsingyuec/video2blog-skill | github.com/tsingyuec/video2blog-skill | MIT | ✅ | 2026-10-04 | 1fps 추출 → 화면 변화로 중복 제거 → 대표 프레임 구간마다 자막 병합 | 불필요 | 미측정 | 좋음(우리 C3와 거의 같은 목표) |

**흐린/전환 중 프레임 거르기**: 구간 "끝 직전" 프레임을 고르면 디졸브·페이드 중간 프레임을 피한다. 추가로 Laplacian/에지 분산(실측 중앙값 2848, 최솟값 458)으로 하위 몇 %를 버리거나, 같은 구간 안에서 ±1초 프레임 중 가장 선명한 것을 고른다. 최종 캡처는 후보 시각에 `ffmpeg -ss <t> -frames:v 1`로 720p 원본에서 다시 뽑는다.

**D1 추천**: **1fps 프레임 차이 + pHash**(직접 30~50줄, imagehash만 추가). 실사 영상(컷 많은 브이로그 등)에서 부족하면 PySceneDetect `detect-adaptive`를 보조로 합집합.

---

## 5. D2. 요약 문단 ↔ 장면 짝짓기

### 5-1. 기존 오픈소스 구현
| 프로젝트 | 라이선스 | 짝짓기 방식 | 시사점 |
|---|---|---|---|
| **JefferyHcool/BiliNote** (★7.4k, 2026-09) | MIT | LLM 프롬프트에 "시각 자료가 도움이 되는 절 끝에 `*Screenshot-[mm:ss]` 표시"를 넣고, 정규식으로 시각을 뽑아 ffmpeg `-ss`로 그 초의 프레임을 캡처 (`screenshot_marker.py`, `prompt.py`) | **(a) 타임스탬프만** 쓰는 가장 단순한 방식. 이미지를 보지 않아 전환 중·흐린 프레임이 걸릴 수 있음 |
| tsingyuec/video2blog-skill | MIT | 대표 프레임 구간마다 자막을 묶어 "그림-자막 원고"를 만들고 그걸로 글을 씀 | 장면 먼저 → 글 나중. 우리 흐름과 반대지만 원고 형식이 참고됨 |
| billyma128/video-course-notes | MIT | 슬라이드마다 스크린샷 1장 + 그 구간 자막 | 강의 영상 전용 |
| aehyok/video2blog (★339) | **라이선스 파일 없음 → 미확인** | 프레임 추출 + 중복 제거 + whisper | 참고만 |
| satojkovic/vid2blog | Apache-2.0 | GPT-4o(유료)로 프레임 선택 | 방식 참고만(유료 API) |

### 5-2. 방법 비교
| 방법 | 정확도 | 속도(문단 15개) | VRAM | 라이선스 | 장점 / 단점 |
|---|---|---|---|---|---|
| (a) 대본 타임스탬프 창 | 중 (말과 화면이 같은 시간대라는 가정) | 즉시 | 0 | — | 빠르고 확실. 말이 화면보다 앞서거나 늦는 영상, 한 문단에 후보 여러 장일 때 고르지 못함 |
| (b) 이미지-텍스트 임베딩 | 중하 (슬라이드 글자·도표는 CLIP류가 약함) | 수 초 | 1~5GB | SigLIP2 Apache-2.0 ✅ / Qwen3-VL-Embedding-2B·8B Apache-2.0 ✅ / Bingsu/clip-vit-large-patch14-ko MIT ✅ / jina-clip-v2 **CC-BY-NC ❌**(차선: Qwen3-VL-Embedding) | 한국어 문단 vs 그림 직접 비교는 SigLIP2 다국어라도 약함. Qwen3-VL-Embedding(2026)이 가장 유망하나 PyTorch 필요 |
| (c) Claude Code `claude -p` 비전 선택 | **상** (문단 의미 + 화면 내용 둘 다 이해) | 문단당 5~15초 → 1~3분 [추정] | 0 (로컬 부담 없음) | Max 구독 사용량 소모 | 후보 3~6장 경로를 주고 Read 도구로 보게 해 번호 선택. 무료 조건 충족(이미 쓰는 Max). 사용량 한도가 변수 |
| (c') Ollama 로컬 비전 LLM | 중상 | 장당 2~5초 → 2~5분 [추정] | 7~9GB | Qwen3.5-9B Apache-2.0(원본) ✅ — **설치된 커뮤니티 GGUF는 `ollama show`에서 vision 지원 확인 [실측]** / Qwen3-VL-8B Apache-2.0 ✅ / Gemma 3 Gemma 약관 ⚠️ | 오프라인·무제한. 9B는 한국어 문단 이해가 Claude보다 약함. 요약 LLM과 VRAM 번갈아 써야 함 |
| (d) OCR 키워드 매칭 | 슬라이드 영상에서 상, 실사 영상에서 하 | 장당 0.2~1초(CPU) | 0 | RapidOCR v3.9.2 Apache-2.0 ✅ (**korean_PP-OCRv5_rec_mobile ONNX 기본 제공 확인**) / PaddleOCR Apache-2.0 ✅ / EasyOCR Apache-2.0 ✅ | 슬라이드 제목이 문단 키워드와 겹치면 강력. 보조 점수로 적합 |

### 5-3. 추천 조합 (D2)
1. **(a)로 후보 좁히기**: 요약 문단마다 근거 대본 줄의 시작~끝 시각(±10초)을 받고, 그 창 안의 D1 후보 장면만 고른다. 후보 0장이면 창 중앙 시각에서 직접 캡처(BiliNote 방식).
2. **후보가 2장 이상이면 (c) Claude Code로 선택**: `claude -p`에 문단 글 + 후보 이미지 경로(작게 줄인 jpg)를 주고 "가장 맞는 번호 하나, 또는 '없음'"만 JSON으로 답하게 한다. 문단 여러 개를 한 번에 묶어 호출 횟수 줄이기.
3. **(d) RapidOCR 점수는 슬라이드형 영상에서 보조 신호**로(글자 많은 후보 우선, 키워드 일치 가산).
4. Claude 사용량이 막히면 (c') 이미 받은 Ollama Qwen3.5-9B 비전으로 같은 프롬프트 실행.
- (b) 임베딩은 첫 버전에서 생략(PyTorch 설치 부담 대비 이득 작음). 필요하면 Qwen3-VL-Embedding-2B.

---

## 6. D5. 캡처에 필요한 만큼만 받고 삭제

```bash
# 화면(소리 없음) 720p 이하, h264 우선 → 캡처용
yt-dlp -f "bv*[height<=720][vcodec^=avc1]/bv*[height<=720]" -o "work/v.%(ext)s" URL
# 소리만 → 받아쓰기용(자막 없을 때만)
yt-dlp -f "ba[ext=m4a]/ba" -o "work/a.%(ext)s" URL
# 자막(있으면 받아쓰기 생략)
yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "ko,en,ko-orig,en-orig" --sub-format json3 -o "work/sub.%(ext)s" URL
```
- 합치기(merge) 안 함 → ffmpeg 재인코딩 없음. 18.7분 영상: 화면 23.8MB/8.5초, 소리 18.1MB/6.3초 [실측].
- 60fps 영상이면 `bv*[height<=720][fps<=30]`로 받으면 장면 분석이 빨라짐(포맷 없으면 자동 대체).
- 캡처 jpg 저장 후 `work/v.*`, `work/a.*` 삭제. 자막·대본 json은 보관.

---

## 7. 재사용 가능한 analyze-video 부분

`C:\Users\gusql\.claude\skills\analyze-video\scripts\video_tools.py`
| 부분 | 재사용 | 고칠 점 |
|---|---|---|
| `cmd_download` | ✅ yt-dlp 파이썬 API로 소리·화면 분리 다운로드, meta.txt | 화면 360p 제한 → **720p**로, 자막(json3) 받기 추가 |
| `cmd_transcribe` | ✅ faster-whisper, VAD, **GPU 실패 시 CPU int8 자동 전환** 이미 구현 | `compute_type="auto"` → Blackwell은 **"float16" 고정**(int8_float16 오류 회피), 기본 모델 small → large-v3-turbo(GPU일 때), 세그먼트 시작·끝 초를 JSON으로도 저장 |
| `cmd_frames` | ⚠️ PyAV 일정 간격 캡처(5초) | FEATURES D2가 "일정 간격 금지" → **1fps 프레임 차이 + pHash**로 교체 |
| `.venv` | ✅ faster-whisper 1.2.1, ctranslate2 4.8.2, av 14.2, yt-dlp 2026.8.19 설치됨 | GPU 쓰려면 `nvidia-cublas-cu12`(+cudnn) 추가 |
| requirements의 `av<15` 핀 | 유지 | faster-whisper 메타데이터 호환 이유 주석 있음 |

---

## 8. Blackwell(RTX 5070, sm_120) 주의점
1. **faster-whisper/CTranslate2**: 4.8.x Windows 휠은 CUDA 12.8 빌드 → 지원. 단 `cublas64_12.dll` 등 CUDA 런타임 DLL은 따로(실측 실패 원인). `compute_type="float16"` 고정 권장(#1865 int8_float16 오류).
2. **PyTorch 계열(Qwen3-ASR, WhisperX, 임베딩)**: `--index-url https://download.pytorch.org/whl/cu128` 휠(torch 2.7 이상)만 GPU 사용. WhisperX pyproject는 이미 torch~=2.8 + cu128 인덱스 지정.
3. **whisper.cpp 공식 바이너리**: CUDA 11.8/12.4 빌드뿐 → Blackwell 동작 미확인.
4. **vLLM**(Qwen3-ASR·Voxtral 권장 백엔드): Windows 공식 지원 약함 → transformers 백엔드 사용.
5. **Ollama 0.35.1**: 이미 GPU로 동작 중(별도 조치 불필요).

---

## 9. 20분 영상 전체 처리 예상 (B·D 부분만)
| 경우 | 단계 | 시간 |
|---|---|---|
| 자막 있음 | 자막 5~30초 + 720p 화면 10초 + 장면 후보 20초 + 짝짓기(Claude) 1~3분 | **약 2~4분** |
| 자막 없음, GPU 설정 완료 | + 오디오 7초 + large-v3-turbo GPU 약 1분 | **약 3~5분** |
| 자막 없음, CPU만 | + small CPU int8 약 4분 | **약 6~8분** |
(요약 생성 시간 제외. 실측: 다운로드·장면·CPU 받아쓰기 / 추정: GPU 받아쓰기·Claude 짝짓기)

---

## 10. 라이선스 미확인 목록
- SenseVoiceSmall 가중치: FunASR `MODEL_LICENSE`(커스텀) — 상업 조건 원문 미확인
- ghost613/whisper-large-v3-turbo-korean, ghost613/faster-whisper-large-v3-turbo-korean, o0dimplz0o/Whisper-Large-v3-turbo-STT-Zeroth-KO-v2: 모델 카드에 라이선스 표기 없음
- aehyok/video2blog, johan456789/slide-extractor, Yannael/video2blogpost: 저장소에 LICENSE 없음
- Cohere Transcribe: 메타데이터는 Apache-2.0이지만 gated 카드 본문(추가 조건 여부) 미확인
- Fun-ASR-Nano-2512: 메타데이터 Apache-2.0, LICENSE 파일 본문은 미확인

## 11. 출처
- yt-dlp PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- youtube-transcript-api 차단 정리: https://github.com/hxckya/youtube-transcript-ip-blocked-guide , https://github.com/jdepoix/youtube-transcript-api/issues/511
- Qwen3-ASR 기술보고서: https://arxiv.org/html/2601.21337v1 · 한국어 Fleurs 비교: https://github.com/zkaelxz/U00/pull/740 , https://whispernotes.app/blog/qwen3-asr-vs-whisper
- 일본어 ASR 11종 비교(Cohere 1위): https://techblog.heroz.jp/entry/2026/08/18/120000
- openasr.org Cohere 항목: https://openasr.org/models/cohere-transcribe-03-2026/
- Reddit: https://www.reddit.com/r/LocalLLaMA/comments/1rq118c/ , https://www.reddit.com/r/LocalLLaMA/comments/1ups1c8/
- CTranslate2 RTX 50 이슈: https://github.com/OpenNMT/CTranslate2/issues/1865
- faster-whisper 벤치마크: https://github.com/SYSTRAN/faster-whisper#benchmark
- BiliNote: https://github.com/JefferyHcool/BiliNote · video-course-notes: https://github.com/billyma128/video-course-notes · video2blog-skill: https://github.com/tsingyuec/video2blog-skill
