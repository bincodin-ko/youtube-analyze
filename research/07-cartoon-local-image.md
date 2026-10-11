# 07. 카툰 요약용 로컬 그림 생성 조사 (2026-10-09)

전제: 글자는 앱이 HTML로 덧씌움(그림은 글자 없는 장면). 내 PC: RTX 5070 12GB, RAM 32GB, Windows 11.
표기: 라이선스는 HF 모델 카드/LICENSE에서 직접 확인(WebFetch 요약). **시간은 전부 추정**(RTX 5070/4070급 실측 못 찾음 — 확인 필요).

## 1. 후보 표

| 모델 | 라이선스 | 상업 | VRAM·양자화 | 1장 시간(추정) | 다운로드 | 만화 품질 | 내 PC |
|---|---|---|---|---|---|---|---|
| **FLUX.2 [klein] 4B** (BFL) | Apache-2.0 ✅ (카드 확인) | ✅ | 카드: 약 13GB 언급. fp8 4.07GB / GGUF Q4_K_M 2.6, Q8 4.3GB. 텍스트인코더 Qwen3-4B 별도 | 4스텝, 1024² 약 3~8초 (BFL "1초 미만"은 서버 GPU 기준) | fp8 모델 4.1 + 인코더 ~4~8 + VAE 0.3 = 약 9~13GB | 사진풍 강함, 만화는 프롬프트/LoRA 의존(미확인). **다중 레퍼런스 편집 내장 = 캐릭터 일관성** | 가능(양자화 시 여유) |
| FLUX.2 [klein] 9B | `other`(비상업 추정, 카드 미확인) ⚠️ | 미확인 | Qwen3-8B 인코더 필요 | 더 느림 | 큼 | - | 버거움+라이선스 |
| FLUX.2 [dev] | `other`(비상업) ❌ | ❌ | Mistral 24B 인코더 | 느림 | 매우 큼 | - | 버거움 |
| **Z-Image-Turbo** (Alibaba, 6B) | Apache-2.0 ✅ | ✅ | GGUF Q4_K_M 5.02, Q8 7.22GB (unsloth) | 8스텝 약 5~10초 | 6~9GB(+인코더) | 사진풍·글자 강점, Turbo 카드에 애니/만화 언급 없음. 만화 LoRA 존재(apache) | 가능 |
| ERNIE-Image-Turbo (Baidu, 8B) | Apache-2.0 ✅ | ✅ | GGUF Q4_K_M 5.02~Q8 8.69GB. 카드 "24GB 소비자 GPU" | 8스텝 약 6~12초 | 6~10GB | 카드가 "만화·스토리보드·멀티패널" 용도 명시(근거는 카드 문구뿐, 품질 미확인). 레퍼런스/편집 미언급 | 가능, 일관성 약함 |
| FLUX.1 [schnell] (12B) | Apache-2.0 ✅ (카드 확인) | ✅ | GGUF Q4 ~10GB대 | 4스텝 약 5~10초 | 모델 6~7+T5 5+CLIP | 범용, 일관성 도구 없음 | 가능 |
| FLUX.1 [dev] (12B) | FLUX.1-dev Non-Commercial ❌ (출력물은 상업 사용 가능이라고 카드에 적혀 있으나 LICENSE 조건 미확인) | 앱 배포 시 위험 | Q4 GGUF 11~12GB, 빠듯 | 28스텝 약 25~40초 | 큼 | 좋음 | 가능하나 느림 |
| FLUX.1 Kontext [dev] | 위와 같은 비상업 ❌ | ⚠️ | 12B, 빠듯 | 느림 | 큼 | "캐릭터 레퍼런스 파인튜닝 없이" 주장(카드, 벤치 없음) | 버거움 |
| Qwen-Image 원본 (20B) | Apache-2.0 ✅ | ✅ | 20B → GGUF Q4 12GB+, RAM 오프로딩 | 30~60초+ | 큼 | 글자·일러스트 좋음 | 버거움 |
| **Qwen-Image 2.1** (7B) | **qwen-research = 연구·평가 전용, 상업 금지 ❌** (LICENSE 직접 확인, 별도 상업 라이선스 필요) | ❌ | 7B | - | - | - | 앱에 쓰면 안 됨 |
| SDXL base 1.0 | OpenRAIL++-M ✅ | ✅(유해 용도 금지 조항) | fp16 6.5GB, 12GB 여유 | 25스텝 약 4~7초 | 6.9GB | 범용 | 쉬움 |
| SDXL Turbo | `other`(Stability 비상업/멤버십 ⚠️, 미확인) | ⚠️ | 작음 | 1~4스텝 1~2초 | 6.9GB | 낮음 | 가능, 라이선스 위험 |
| SD 3.5 Medium(2B) | Stability Community: 연 매출 100만 달러 미만 상업 무료 ⚠️ (카드 확인) | 조건부 | 작음 | 약 5~10초 | ~10GB | 보통 | 가능 |
| Animagine XL 4.0 (SDXL 파생) | OpenRAIL++-M ✅ (SDXL 라이선스 그대로) | ✅ | SDXL급 | 28스텝 약 5~8초 | 6.9GB | 애니풍 강함(평판), 단 애니 얼굴 위주 | 가능 |
| Pony Diffusion V6 XL | cdla-permissive-2.0 (HF 태그) ⚠️ 원 카드의 별도 조건 미확인 | 미확인 | SDXL급 | 비슷 | 6.9GB | 카툰/퍼리/애니, 성인 콘텐츠 편향 | 가능, 부적합 우려 |
| HiDream-I1 (17B) | MIT ✅ | ✅ | 17B + 큰 인코더. GGUF 있음 | 30초+ | 매우 큼 | 좋음 | 버거움 |
| Sana 1.6B | Apache-2.0 ✅(HF 태그) | ✅ | 작음 | 빠름 | 작음 | 품질 낮음 | 가능, 품질 미달 |
| Lumina | 미조사 | 미확인 | - | - | - | - | 미확인 |

HF 다운로드 순위(2026-10): SDXL base 430만, Qwen-Image-2.1(Comfy) 747만, Z-Image-Turbo 62만, FLUX.1-dev 69만, schnell 65만, FLUX.2 klein 4B 40만, Animagine 4.0 38만.

## 2. 실행 도구

| 도구 | 라이선스 | Windows/Blackwell | 판단 |
|---|---|---|---|
| **ComfyUI** | GPL-3.0 | 공식 포터블(Python 3.13, PyTorch CUDA 13.0, 20시리즈 이상). 문서는 cu130 이상 권장 → 5070(sm_120) 지원 | 별도 프로세스로 띄우고 우리 앱이 HTTP API(`/prompt`, `/history`)만 호출하면 통상 "mere aggregation"으로 봐서 우리 앱 코드에 GPL이 번지지 않는다고 보는 게 일반적 해석(법률 자문 아님). **ComfyUI를 우리 설치본에 동봉 재배포하면 GPL 의무(소스 제공)가 생김 → 사용자가 직접 설치하게 하거나 다운로드 안내.** |
| diffusers | Apache-2.0 | pip, PyTorch cu128 이상 필요(수동) | 앱에 직접 임베드 쉬움(Python). Flux2 klein 파이프라인 카드에 예시 있음. 설치 난이도 중, 직접 코드 작성 필요 |
| **stable-diffusion.cpp** | MIT | Windows 빌드 제공, CUDA·Vulkan 지원. Flux2 klein·Z-Image·ERNIE·Qwen-Image 지원, `-r` 참조 이미지 편집 지원. 릴리스 master-948(10/08). **릴리스 자산명·sm_120 CUDA 빌드 포함 여부 미확인**(Vulkan으로 폴백 가능) | 상업 앱에 가장 깔끔(MIT, 단일 exe, CLI). klein 4B 예시 명령 존재. 서버 모드 있는 듯하나 확정 못 함 |
| Ollama 이미지 생성 | MIT | 2026-01 실험 기능, **macOS 전용**. 모델 페이지(x/z-image-turbo)가 현재도 "macOS only"로 표기. Windows ❌ | 불가 |
| SD.Next 등 | 미조사 | - | 이미 충분, 생략 |

## 3. 캐릭터 일관성 방법 (LoRA 없이)

1. **FLUX.2 klein 다중 레퍼런스 편집** — 1컷에 캐릭터 시트 1장을 만들고 이후 칸은 그 그림을 참조 이미지로 넣어 "같은 인물이 ~하는 장면" 생성. BFL 공식 가이드가 FLUX.2의 일관성 방식으로 이 방법을 소개(docs.bfl.ai usecases_editing_character_consistency). 4B에서의 실제 품질은 미검증. 참조 늘수록 VRAM 증가.
2. 고정 캐릭터 프롬프트 + 같은 시드: 가장 단순, 하지만 장면이 바뀌면 옷·얼굴 흔들림. 보조 수단.
3. IP-Adapter: SDXL/SD1.5용만 확인(sd.cpp 문서). FLUX.2/Z-Image 계열은 해당 없음. SDXL 경로(Animagine)로 갈 때만 의미 있음.
4. Kontext류: 라이선스(비상업) 때문에 앱에는 부적합.
5. 현실적 설계: 캐릭터를 "동물/로봇 마스코트"처럼 단순한 디자인으로 고정하면 어느 방법이든 일관성 체감이 크게 좋아짐.

## 4. 추천

**추천 1개: FLUX.2 [klein] 4B (fp8 또는 GGUF Q8) + ComfyUI(사용자 PC에 별도 설치, API 호출)**
- 이유: Apache-2.0 상업 가능, 12GB에 들어가는 4B, 4스텝, 다중 레퍼런스 편집으로 칸 간 캐릭터 일관성을 LoRA 없이 시도 가능, ComfyUI 포터블이 Blackwell 지원 공식 명시.
- 예상 총 다운로드: ComfyUI 포터블 약 2.5GB(추정) + klein fp8 4.1GB + Qwen3-4B 인코더 약 4~8GB + VAE 0.3GB = **약 11~15GB**.
- 8칸 1편 예상 시간: 첫 실행 모델 로딩 20~40초 + 칸당 4~10초(레퍼런스 포함 시 10~15초) = **약 1~3분 (추정, 실측 필요)**.
- 약점: 스타일이 사진풍으로 기울 수 있음 → 프롬프트에 "flat color webtoon illustration, thick outline" 등 고정 필요. 4B 만화 품질은 미검증.

**차선: SDXL 파생 Animagine XL 4.0 + stable-diffusion.cpp (또는 ComfyUI)** — 라이선스 OpenRAIL++ 상업 가능, 7GB, 칸당 5~8초(추정), 만화·애니풍 안정. 일관성은 고정 프롬프트+시드+IP-Adapter 정도라 약함. 보조 차선: Z-Image-Turbo GGUF(Apache, 5~7GB).

**쓰면 안 되는 것:** Qwen-Image 2.1(연구용 전용), FLUX.1 dev/Kontext·FLUX.2 dev(비상업 라이선스), Ollama(Windows 불가).

## 5. 그림 모델 없는 대안

- **Claude SVG 직접 그리기:** 도형·단순 캐릭터(막대인간, 마스코트, 아이콘 장면)는 가능, 일관성은 같은 SVG 심볼을 재사용하면 오히려 완벽. 장면 묘사력은 낮고 8칸마다 수천 토큰 소모. 예상 품질: "인포그래픽·스틱맨 만화" 수준. 모델 다운로드 0GB, 설치 0.
- **아이콘·이모지 조합 칸:** 가장 안정적·빠름(즉시), 품질은 "도해 슬라이드" 수준이라 만화 느낌은 약함. Unsplash 일러스트·lucide 조합과 말풍선 HTML이 가능.
- 평가: 그림 모델 설치를 원치 않는 사용자용 **기본 폴백**으로 SVG+아이콘, 고급 옵션으로 klein을 두는 2단 구성이 합리적.

## 6. chrome_worklist (메인이 Chrome으로 확인)

1. https://huggingface.co/black-forest-labs/FLUX.2-klein-4B 의 LICENSE 원문 + 카드의 정확한 VRAM 표기(12GB에서 fp8로 도는지) 
2. r/StableDiffusion·r/comfyui에서 `site:reddit.com flux2 klein 4b 4070 OR 5070 seconds` 로 실측 시간·VRAM 근거(Reddit은 research MCP로)
3. r/StableDiffusion에서 "flux 2 klein comic OR manga consistent character multi reference" 사례 이미지·평판(스타일 품질 확인)
4. https://huggingface.co/stabilityai/sdxl-turbo LICENSE (비상업 여부)
5. https://huggingface.co/LyliaEngine/Pony_Diffusion_V6_XL 및 원본 AstraliteHeart 카드의 라이선스 조건
6. https://github.com/leejet/stable-diffusion.cpp/releases/tag/master-948-228c707 Windows 자산명(cuda12/vulkan)과 sm_120(Blackwell) 지원 여부, sd-server 존재
7. https://ollama.com/blog 에서 Windows 이미지 생성 지원 여부 최신(10월) 재확인
8. https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md 출력물 상업 사용 조건 원문(참고용)
9. https://huggingface.co/baidu/ERNIE-Image-Turbo 샘플 이미지로 만화 칸 품질 육안 확인, Lumina 2 라이선스
10. https://docs.bfl.ai/guides/usecases_editing_character_consistency 일관성 방법 원문

## 출처
HF 모델 카드(FLUX.1-schnell/dev/Kontext, FLUX.2-klein-4B/fp8, unsloth GGUF들, Z-Image-Turbo, ERNIE-Image-Turbo, Qwen-Image-2.1 + LICENSE, SD3.5-medium, animagine-xl-4.0), HF API 다운로드 순위, github.com/Comfy-Org/ComfyUI, github.com/leejet/stable-diffusion.cpp(+docs/flux2.md), ollama.com/x/z-image-turbo, gigazine 2026-01-23 Ollama 기사.
