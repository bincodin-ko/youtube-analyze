"""카툰 요약: claude -p 가 4~8칸 콘티(JSON)를 만들고, ComfyUI(FLUX.2 klein 4B, tools/comfyui)로 칸마다 그림을 그린다.
ComfyUI/모델이 없거나 실패하면 그림 없이 아이콘 칸 + 말풍선(simple 모드)으로 만든다. 결과 data/media/<id>/ext_cartoon.json + cartoon/p_<i>.png."""
import json, os, random, shutil, subprocess, threading, time, urllib.request
from pathlib import Path
from app import ai, templates

ROOT = Path(__file__).resolve().parents[2]
COMFY = ROOT / "tools" / "comfyui" / "ComfyUI_windows_portable"
PORT = int(os.environ.get("VN_COMFY_PORT", 8188))  # 127.0.0.1 전용
URL = f"http://127.0.0.1:{PORT}"
MODELS = {"unet": "flux-2-klein-4b-fp8.safetensors", "clip": "qwen_3_4b_fp4_flux2.safetensors", "vae": "flux2-vae.safetensors"}
SIZE = 768
STYLE = "flat color webtoon comic panel illustration, thick clean black outlines, simple soft background, expressive friendly characters, no text, no letters, no speech bubbles, full-bleed artwork without frame or border"
# 릴리스 「만화 스타일 선택」 6종 → 그림 지시문. 공통 꼬리(글자·말풍선·테두리 없음)는 NOTEXT
NOTEXT = "no text, no letters, no speech bubbles, full-bleed artwork without frame or border"
STYLES = {
    "webtoon": STYLE,
    "realistic": "realistic graphic novel comic panel, detailed semi-realistic people, cinematic lighting, ink and color, " + NOTEXT,
    "anime": "Japanese anime style illustration, cel shading, big expressive eyes, vibrant clean colors, " + NOTEXT,
    "chibi": "cute chibi super-deformed characters with big heads and tiny bodies, pastel colors, kawaii style, " + NOTEXT,
    "disney": "3D animated feature film style like a family animation movie, soft rounded characters, warm lighting, " + NOTEXT,
    "comicbook": "American comic book style, bold black ink lines, halftone dots, strong saturated colors, dynamic poses, " + NOTEXT,
}
ILLUST = "clean editorial flat illustration, soft muted colors, simple shapes, white background, no text, no letters, no logos"
JOBS: dict = {}  # nid → {"done","total","busy","err","mode","msg"}
_proc = None  # 우리가 띄운 ComfyUI (이미 떠 있으면 None)

PROMPT = """아래 리포트를 4~8칸짜리 카툰(콘티)으로 만들어라. 그림은 글자가 없는 장면이고, 대사·설명은 한국어 말풍선·캡션으로 따로 쓴다.
JSON 객체 하나만 출력(설명·코드펜스 금지):
{"title":"카툰 제목 25자 이내","character":"주인공 외형을 영어로 한 문장(머리·옷·색·소품 등 칸마다 똑같이 쓸 고정 설명, 예: a young woman with short black hair, yellow hoodie, round glasses)","panels":[{"scene":"영어 장면 묘사 한 문장(인물 행동·배경·소품, 글자·문자 없음)","bubble":"한국어 말풍선 대사 30자 이내","caption":"한국어 캡션 1문장 50자 이내(핵심 내용)","icon":"아이콘","ref":대본 줄 인덱스}]}
panels는 4~8칸, 영상 흐름 순서, 이야기가 되도록 기승전결. 주인공은 사람·동물·사물 캐릭터 하나로 고정. 대본에 없는 수치를 지어내지 않는다. icon은 다음 중에서만: """ + templates.ICONS + """. ref는 실제 존재하는 대본 줄 인덱스 정수 하나.

대본:
"""


def installed() -> bool:
    if os.environ.get("VN_CARTOON_SIMPLE") == "1": return False  # 간단 버전 강제(테스트·그림 모델 끄기)
    d = COMFY / "ComfyUI" / "models"
    return (COMFY / "python_embeded" / "python.exe").exists() and all((d / sub / MODELS[k]).exists() for k, sub in (("unet", "diffusion_models"), ("clip", "text_encoders"), ("vae", "vae")))


def _api(path, body=None, timeout=30):
    req = urllib.request.Request(URL + path, json.dumps(body).encode() if body is not None else None, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)


def _up() -> bool:
    try: _api("/system_stats", timeout=3); return True
    except OSError: return False


def ensure_server():
    """ComfyUI가 안 떠 있으면 백그라운드로 띄운다(끝나도 그대로 둠)."""
    global _proc
    if _up(): return
    _proc = subprocess.Popen([str(COMFY / "python_embeded" / "python.exe"), "-s", str(COMFY / "ComfyUI" / "main.py"), "--windows-standalone-build",
                              "--listen", "127.0.0.1", "--port", str(PORT), "--disable-auto-launch"], cwd=COMFY,
                             stdout=open(COMFY / "comfy.log", "w"), stderr=subprocess.STDOUT)
    for _ in range(180):  # 처음 켤 땐 3~4분 걸릴 수 있음
        time.sleep(2)
        if _up(): return
        if _proc.poll() is not None: break
    raise RuntimeError("ComfyUI가 시작되지 않았어요(tools/comfyui/ComfyUI_windows_portable/comfy.log 확인)")


def _workflow(prompt: str, seed: int, ref: str | None) -> dict:
    """klein 4B 텍스트→이미지(4스텝, cfg 1). ref(input 폴더 파일명)가 있으면 ReferenceLatent로 첫 칸을 참고 이미지로 넣는다."""
    w = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": MODELS["unet"], "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": MODELS["clip"], "type": "flux2", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": MODELS["vae"]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": SIZE, "height": SIZE, "batch_size": 1}},
        "7": {"class_type": "Flux2Scheduler", "inputs": {"steps": 4, "width": SIZE, "height": SIZE}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "9": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "11": {"class_type": "VAEDecode", "inputs": {"samples": ["12", 0], "vae": ["3", 0]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["11", 0], "filename_prefix": "cartoon"}},
    }
    pos, neg = ["4", 0], ["5", 0]
    if ref:
        w["20"] = {"class_type": "LoadImage", "inputs": {"image": ref}}
        w["21"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["20", 0], "vae": ["3", 0]}}
        w["22"] = {"class_type": "ReferenceLatent", "inputs": {"conditioning": pos, "latent": ["21", 0]}}
        w["23"] = {"class_type": "ReferenceLatent", "inputs": {"conditioning": neg, "latent": ["21", 0]}}
        pos, neg = ["22", 0], ["23", 0]
    w["10"] = {"class_type": "CFGGuider", "inputs": {"model": ["1", 0], "positive": pos, "negative": neg, "cfg": 1.0}}
    w["12"] = {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["9", 0], "guider": ["10", 0], "sampler": ["8", 0], "sigmas": ["7", 0], "latent_image": ["6", 0]}}
    return w


def draw(prompt: str, seed: int, out: Path, ref: Path | None = None) -> None:
    """그림 한 장을 ComfyUI로 그려 out(png)에 저장."""
    name = None
    if ref:  # ComfyUI input 폴더로 복사해 LoadImage가 읽게 한다
        name = "cartoon_ref.png"
        shutil.copyfile(ref, COMFY / "ComfyUI" / "input" / name)
    pid = _api("/prompt", {"prompt": _workflow(prompt, seed, name)})["prompt_id"]
    for _ in range(300):  # 최대 10분
        time.sleep(2)
        h = _api(f"/history/{pid}").get(pid)
        if not h: continue
        if h["status"].get("status_str") == "error": raise RuntimeError("ComfyUI 실행 오류")
        im = next(i for o in h["outputs"].values() for i in o.get("images", []))
        with urllib.request.urlopen(f"{URL}/view?filename={im['filename']}&subfolder={im['subfolder']}&type={im['type']}", timeout=60) as r:
            out.write_bytes(r.read())
        return
    raise RuntimeError("그림 생성 시간 초과")


def storyboard(note: dict, extra: str | None = None) -> dict:
    """claude -p 로 콘티 JSON. ref는 대본 범위 안 정수만 남긴다. extra=「고급 설정 > 추가 프롬프트」."""
    tr = note["transcript"]; n = len(tr)
    rep = note["report"]
    body = f"리포트 제목: {rep.get('title')}\n핵심: " + " / ".join(rep.get("key_points", [])) + "\n\n"
    if (extra or "").strip(): body = "사용자 추가 요청(위 형식 규칙 안에서 반영): " + extra.strip()[:500] + "\n\n" + body
    head = ai._kind(note, "너는 영상 대본을 바탕으로 카툰을 구성하는 콘티 작가다. 대본은 한 줄이 `[인덱스 mm:ss] 텍스트` 형식이다(해외 영상이면 번역해서 쓴다).\n" + PROMPT)
    prompt = head + body + "\n".join(f"[{i} {ai._mmss(s['start'])}] {s['text']}" for i, s in enumerate(tr))

    def parse(r):
        ps = [{"scene": str(p["scene"]), "bubble": str(p["bubble"]), "caption": str(p.get("caption") or ""), "icon": str(p.get("icon", "")),
               "ref": p["ref"] if isinstance(p.get("ref"), int) and 0 <= p["ref"] < n else None} for p in r["panels"] if p.get("scene") and p.get("bubble")]
        if len(ps) < 3: raise ValueError("칸 부족")
        return {"title": str(r.get("title") or "카툰 요약"), "character": str(r["character"]), "panels": ps[:8]}
    return ai._ask(prompt, 180, parse)


def _prompt(sb: dict, i: int) -> str:
    return f"{STYLES.get(sb.get('style'), STYLE)}. Main character (always identical): {sb['character']}. Scene: {sb['panels'][i]['scene']}"


def _save(media: Path, nid: str, sb: dict) -> None:
    templates.path(media, nid, "cartoon").write_text(json.dumps(sb, ensure_ascii=False), encoding="utf-8")


def start(media: Path, note: dict, only: int | None = None, style: str | None = None, extra: str | None = None) -> dict:
    """백그라운드 생성 시작. only=칸 번호면 그 칸만 다시 그린다(저장된 스타일 그대로). 이미 돌고 있으면 그대로."""
    nid = note["id"]
    j = JOBS.get(nid)
    if j and j["busy"]: return j
    j = JOBS[nid] = {"done": 0, "total": 1, "busy": True, "err": None, "mode": "", "msg": "콘티 만드는 중"}
    d = media / nid / "cartoon"

    def run():
        try:
            f = templates.path(media, nid, "cartoon")
            if only is not None:
                sb = json.loads(f.read_text(encoding="utf-8")); idx = [only]
                if sb["mode"] != "ai": return
            else:
                sb = {"kind": "cartoon", **storyboard(note, extra), "style": style if style in STYLES else "webtoon", "extra": (extra or "")[:500]}; idx = list(range(len(sb["panels"])))
                shutil.rmtree(d, ignore_errors=True)
                sb["mode"] = "ai" if installed() else "simple"
                _save(media, nid, sb)
            j.update(total=len(idx), mode=sb["mode"])
            if sb["mode"] == "ai":
                d.mkdir(parents=True, exist_ok=True)
                try:
                    j["msg"] = "그림 모델 켜는 중"; ensure_server()
                    seed = sb.setdefault("seed", random.randrange(2**31))
                    for i in idx:
                        j["msg"] = f"{j['done'] + 1}/{len(idx)}칸 그리는 중"
                        ref = d / "p_0.png" if i and (d / "p_0.png").exists() else None  # 첫 칸을 캐릭터 참고 이미지로
                        s = seed if only is None else random.randrange(2**31)
                        draw(_prompt(sb, i), s + i if only is None else s, d / f"p_{i}.png", ref)
                        sb["panels"][i]["img"] = f"cartoon/p_{i}.png?v={int(time.time())}"
                        j["done"] += 1; _save(media, nid, sb)
                except Exception as e:  # 그림 실패 → 아이콘 칸 대체 버전
                    print(f"[cartoon] 그림 실패, 간단 버전으로: {e}")
                    sb["mode"] = "simple"; sb["fallback_reason"] = str(e)[:200]
                    for p in sb["panels"]: p.pop("img", None)
                    shutil.rmtree(d, ignore_errors=True); _save(media, nid, sb)
        except Exception as e:
            j["err"] = str(e)
        finally:
            j["busy"] = False
    threading.Thread(target=run, daemon=True).start()
    return j


def illustrate(media: Path, nid: str, key: str) -> None:
    """웹 조사형 리포트(배경지식 등)의 소제목마다 삽화 1장(릴리스처럼). 글은 먼저 보이고 그림은 한 장씩 채워진다.
    그림 모델이 없거나 실패하면 그림 없이 끝(글만)."""
    jid = f"{nid}:{key}"
    if not installed() or (JOBS.get(jid) or {}).get("busy"): return
    f = templates.path(media, nid, key)
    j = JOBS[jid] = {"done": 0, "total": 0, "busy": True, "err": None}

    def run():
        try:
            r = json.loads(f.read_text(encoding="utf-8"))
            idx = [i for i, b in enumerate(r["blocks"]) if b.get("illust") and not b.get("img")]
            j["total"] = len(idx)
            if not idx: return
            ensure_server()
            d = media / nid / f"ext_{key}"; d.mkdir(parents=True, exist_ok=True)
            for i in idx:
                draw(f"{ILLUST}. {r['blocks'][i]['illust']}", random.randrange(2**31), d / f"b_{i}.png")
                cur = json.loads(f.read_text(encoding="utf-8"))  # 그리는 동안 다시 만들었으면 그만
                if cur["blocks"][i].get("illust") != r["blocks"][i]["illust"]: return
                cur["blocks"][i]["img"] = f"ext_{key}/b_{i}.png?v={int(time.time())}"
                f.write_text(json.dumps(cur, ensure_ascii=False), encoding="utf-8")
                j["done"] += 1
        except Exception as e:
            print(f"[illust] {jid} 실패: {e}"); j["err"] = str(e)[:200]
        finally:
            j["busy"] = False
    threading.Thread(target=run, daemon=True).start()
