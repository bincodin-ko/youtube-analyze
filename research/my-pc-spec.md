# 내 PC 사양 (2026-10-06 PowerShell로 직접 확인)

| 항목 | 값 | 비고 |
|---|---|---|
| OS | Windows 11 Pro 25H2 (10.0.26200), 64비트 | |
| CPU | Intel Core i5-14400F, 10코어(P6+E4) / 16스레드 | 내장 그래픽 없음(F) |
| RAM | 32 GB DDR5-5600 (16GB×2) | 확인 시점 여유 19.6 GB |
| GPU | NVIDIA GeForce RTX 5070 (Blackwell) | VRAM **12 GB** (12227 MiB), 드라이버 616.92, CUDA 13.4 |
| 디스크 | C: NVMe SSD 952 GB 중 **743 GB 여유** | KIOXIA KXG70 |
| Python | 3.12.10 (+ py 런처, uv 설치됨) | 전역 pip 패키지는 거의 없음 |
| Node.js | v24.21.0 (npm 포함) | |
| ffmpeg | 9.0.2 full build (winget) | |
| yt-dlp | 2026.08.19 (winget) | |
| git | 설치됨 | |
| Ollama | 0.35.1 | 받아둔 모델: Qwen3.5-9B 파생 GGUF Q6_K (9.5 GB, 검열해제 커뮤니티판) |
| Claude Code | 2.1.291 (`claude` 명령 사용 가능) | Max 구독 |
| Playwright | 미설치 | 캡처 작업 때 설치 필요 |
| 캐시된 모델 | faster-whisper-small (HF 캐시) | |

## 이 사양으로 내린 판단 기준 (이후 모든 후보 판정에 사용)

- **GPU 사용: 가능.** VRAM 12GB면 음성인식 large급 + 장면 분석을 GPU로 돌릴 수 있다.
  - 주의: RTX 50 시리즈(Blackwell, sm_120)는 **CUDA 12.8 이상으로 빌드된 라이브러리만** GPU를 쓴다. 오래된 PyTorch·CTranslate2 휠은 GPU를 못 잡고 CPU로 떨어질 수 있다. 설치 때 버전 확인 필수.
- **로컬 AI(LLM) 크기 한도**
  - 편함: 7~9B 모델 Q4~Q6 (5~9 GB) — VRAM 안에 다 들어감, 빠름
  - 가능: 12~14B 모델 Q4 (8~10 GB) — 긴 대본(컨텍스트 큼)이면 VRAM 빠듯
  - **내 PC에서 어려움**: 27B~32B 이상 — VRAM 초과, RAM으로 넘쳐 매우 느림 (분당 몇 단어 수준)
- **음성인식 크기 한도**: whisper large-v3 / large-v3-turbo GPU 실행 가능 (VRAM 3~5 GB 사용)
- **RAM 32GB**: 로컬 웹앱 + 브라우저 + Ollama 9B 동시 실행 여유 있음. 데스크톱 앱(Electron)도 부담 없음.
- **디스크 743GB**: 모델·영상 임시 파일 걱정 없음.

## 예상 처리 시간 (20분 유튜브 영상 1개 기준, 추정치 — 실측 후 갱신)

| 단계 | 방법 | 예상 시간 |
|---|---|---|
| 자막 받기 | youtube-transcript-api / yt-dlp (자막 있을 때) | 수 초 |
| 음성인식 (자막 없을 때) | faster-whisper large-v3-turbo, GPU float16 | 약 1~2분 |
| 〃 (GPU 안 잡힐 때) | faster-whisper small, CPU int8 | 약 4~8분 |
| 영상 내려받기 | yt-dlp 720p | 약 0.5~2분 (회선 따라) |
| 장면 전환 감지 | PySceneDetect (720p, 다운스케일) | 약 1~3분 |
| 요약·블로그글 | Claude Code (`claude -p`) | 약 1~3분 |
| 〃 | Ollama 9B 로컬 | 약 2~5분 |
| 장면-문단 짝짓기 | 대본 시간 기준 + 후보 장면 비교 | 약 0.5~2분 |
| **합계** | 자막 있음 + Claude | **약 4~10분** |
| | 자막 없음 + Ollama 로컬 | **약 6~14분** |
