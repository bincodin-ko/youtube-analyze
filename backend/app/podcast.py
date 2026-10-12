"""팟캐스트 음성(우리만 추가, 릴리스는 글만): 확장 리포트 「팟캐스트」의 문단을 음성 파일로.
1순위 Edge 온라인 음성(edge-tts, 대본 글자가 MS 서버로 감 — 사용자 선택 2026-10-12), 실패하면 윈도우 내장 한국어 음성(Microsoft Heami, 로컬 wav).
결과 data/media/<id>/podcast/p_<n>.mp3|.wav, 진행은 JOBS."""
import asyncio, json, os, re, subprocess, threading, time
from pathlib import Path

VOICE = "ko-KR-InJoonNeural"  # 남성 해설자(릴리스 「김민준 · AI 기술 해설가」)
JOBS: dict = {}  # nid → {"done","total","busy","err","engine"}
# 윈도우 SAPI: 글은 표준 입력으로(따옴표 문제 없음), 출력 경로는 인자로
PS = ("Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
      "$v=$s.GetInstalledVoices()|?{$_.VoiceInfo.Culture.Name -eq 'ko-KR'}|select -First 1; if($v){$s.SelectVoice($v.VoiceInfo.Name)}; "
      "$s.Rate=1; $s.SetOutputToWaveFile($args[0]); $s.Speak((Get-Content -LiteralPath $args[1] -Raw -Encoding UTF8)); $s.Dispose()")


def _plain(p: dict) -> str:
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", p.get("text") or "")
    return " ".join([t, *[re.sub(r"\*\*(.+?)\*\*", r"\1", x) for x in p.get("list") or []]]).strip()


def _edge(text: str, out: Path):
    import edge_tts, edge_tts.communicate as cm
    # 2026-10 MS가 옛 주소(speech.platform.bing.com)를 403으로 막음 → Edge 155와 같은 새 주소(edge-tts PR #491). 새 버전이 나오면 지워도 됨
    cm.WSS_URL = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=" + edge_tts.constants.TRUSTED_CLIENT_TOKEN
    part = out.with_suffix(".part")
    try:
        for k in range(4):  # 429(잠깐 너무 잦음)는 쉬었다가 다시
            try:
                asyncio.run(edge_tts.Communicate(text, VOICE).save(str(part))); break
            except Exception as e:
                if "429" not in str(e) or k == 3: raise
                time.sleep(3 * (k + 1))
        if part.stat().st_size == 0: raise RuntimeError("빈 음성")
        part.replace(out)
    finally:
        part.unlink(missing_ok=True)


def _sapi(text: str, out: Path):
    src = out.with_suffix(".txt"); src.write_text(text, encoding="utf-8")  # 한글이 깨지지 않게 파일로 넘김
    try:
        q = lambda x: "'" + str(x).replace("'", "''") + "'"
        p = subprocess.run(["powershell", "-NoProfile", "-Command", f"& {{ {PS} }} {q(out)} {q(src)}"], capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=180, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    finally:
        src.unlink(missing_ok=True)
    if p.returncode or not out.exists() or out.stat().st_size == 0:
        out.unlink(missing_ok=True); raise RuntimeError(f"윈도우 음성 실패: {(p.stderr or '')[:150]}")


def start(media: Path, nid: str) -> dict:
    j = JOBS.get(nid)
    if j and j["busy"]: return j
    paras = json.loads((media / nid / "ext_podcast.json").read_text(encoding="utf-8"))["paras"]
    d = media / nid / "podcast"; d.mkdir(parents=True, exist_ok=True)
    j = JOBS[nid] = {"done": 0, "total": len(paras), "busy": True, "err": None, "engine": "edge"}

    def run():
        try:
            for i, p in enumerate(paras):
                if not any((d / f"p_{i}{e}").exists() for e in (".mp3", ".wav")):
                    if j["engine"] == "edge":
                        try: _edge(_plain(p), d / f"p_{i}.mp3")
                        except Exception as e:  # MS가 막으면(403 등) 이 문단부터 윈도우 음성으로
                            print(f"[podcast] Edge 음성 실패 → 윈도우 음성: {e}"); j["engine"] = "windows"
                    if j["engine"] == "windows": _sapi(_plain(p), d / f"p_{i}.wav")
                j["done"] = i + 1
        except Exception as e:
            j["err"] = f"음성 만들기 실패: {e}"[:200]
        finally:
            j["busy"] = False
    threading.Thread(target=run, daemon=True).start()
    return j


def state(media: Path, nid: str) -> dict:
    """ready: [[문단 번호, 파일 이름]] (빈 파일 제외)"""
    d = media / nid / "podcast"
    fs = sorted((int(f.stem[2:]), f.name) for f in d.glob("p_*.*") if f.suffix in (".mp3", ".wav") and f.stat().st_size > 0) if d.exists() else []
    return {"job": JOBS.get(nid), "ready": fs}


if __name__ == "__main__":
    assert _plain({"text": "**하네스**란", "list": ["**A**", "B"]}) == "하네스란 A B"
    if os.name == "nt":  # 윈도우 음성 실제로 한 번
        import tempfile
        f = Path(tempfile.mkdtemp()) / "t.wav"; _sapi("시험입니다", f); print("sapi", f.stat().st_size); f.unlink()
    print("ok")
