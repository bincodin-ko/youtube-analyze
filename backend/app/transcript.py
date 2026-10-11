"""메타·자막(yt-dlp json3) → 5~20초 문단. 자막 없으면 faster-whisper(GPU float16 → CPU small int8)."""
import json, os, re, time
from pathlib import Path

import yt_dlp


def _add_cuda_dlls():
    # pip로 받은 cuBLAS·cuDNN DLL을 CTranslate2가 찾도록 경로 추가(Windows)
    try:
        import nvidia
    except ImportError:
        return
    for root in nvidia.__path__:
        for b in Path(root).glob("*/bin"):
            os.add_dll_directory(str(b))
            os.environ["PATH"] = str(b) + os.pathsep + os.environ["PATH"]


_add_cuda_dlls()
YDL = {"quiet": True, "no_warnings": True, "noprogress": True, "noplaylist": True}


def download(url, fmt, out):
    """yt-dlp로 한 포맷만 받기. 유튜브가 가끔 403을 주므로 3번까지 재시도. → 파일 경로"""
    for i in range(3):
        try:
            with yt_dlp.YoutubeDL({**YDL, "format": fmt, "outtmpl": str(out) + ".%(ext)s"}) as y:
                return Path(y.prepare_filename(y.extract_info(url, download=True)))
        except yt_dlp.utils.DownloadError:
            if i == 2: raise
            time.sleep(2)


def group(lines, lo=5.0, hi=20.0):
    """[(start, end, text)] → 5~20초 문단. 문장 끝(.?!다요)에서 끊고, 20초 넘으면 강제로 끊는다."""
    out, cur = [], None
    for s, e, t in lines:
        if cur and e - cur[0] > hi and cur[1] - cur[0] >= lo:
            out.append(cur); cur = None
        if cur is None:
            cur = [s, e, t]
        else:
            cur[1], cur[2] = max(cur[1], e), cur[2] + " " + t
        span = cur[1] - cur[0]
        if span >= hi or (span >= lo and re.search(r"[.?!。？！다요]['\"”)]?$", cur[2])):
            out.append(cur); cur = None
    if cur:
        out.append(cur)
    return [{"start": round(s, 2), "end": round(e, 2), "text": re.sub(r"\s+", " ", t).strip()} for s, e, t in out]


def _json3_lines(data):
    lines = []
    for ev in data.get("events", []):
        t = "".join(s.get("utf8", "") for s in ev.get("segs", [])).replace("\n", " ").strip()
        if t:
            s = ev["tStartMs"] / 1000
            lines.append((s, s + ev.get("dDurationMs", 0) / 1000, t))
    # 자동 자막은 줄이 겹침 → 끝 시각을 다음 줄 시작으로 자름
    return [(s, min(e, lines[i + 1][0]) if i + 1 < len(lines) else e, t) for i, (s, e, t) in enumerate(lines)]


def _pick_track(info):
    """수동 자막 우선(원어 → ko → en → 기타), 없으면 자동 *-orig. (lang, url) 또는 None."""
    orig = (info.get("language") or "").split("-")[0]
    subs = {k: v for k, v in (info.get("subtitles") or {}).items() if k != "live_chat"}
    order = [l for l in (orig, "ko", "en") if l]
    rank = lambda k: next((i for i, l in enumerate(order) if k.split("-")[0] == l), 99)
    auto = info.get("automatic_captions") or {}
    keys = sorted(subs, key=rank) + sorted((k for k in auto if k.endswith("-orig")), key=rank)
    for k in keys:
        f = next((f for f in (subs.get(k) or auto.get(k) or []) if f.get("ext") == "json3"), None)
        if f:
            return k.split("-")[0], f["url"]
    return None


def asr_file(audio):
    """오디오·영상 파일 → (언어, [(start,end,text)], 장치). 파일은 지우지 않는다."""
    from faster_whisper import WhisperModel
    try:
        m = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")  # int8_float16은 RTX 50 오류
        segs, info = m.transcribe(str(audio), vad_filter=True)
        segs, dev = list(segs), "cuda large-v3-turbo float16"  # CUDA 오류는 순회 중에 터짐
    except Exception as e:
        print(f"[asr] GPU 실패 → CPU small int8: {e}")
        m = WhisperModel("small", device="cpu", compute_type="int8")
        segs, info = m.transcribe(str(audio), vad_filter=True)
        segs, dev = list(segs), "cpu small int8"
    print(f"[asr] {dev}")
    return info.language, [(s.start, s.end, s.text.strip()) for s in segs if s.text.strip()], dev


def _asr(url, work):
    work.mkdir(parents=True, exist_ok=True)
    audio = download(url, "ba[ext=m4a]/ba", work / "a")
    try:
        return asr_file(audio)
    finally:
        audio.unlink(missing_ok=True)


def fetch(url, work, force_asr=False):
    """→ {video_id,title,channel,thumbnail,duration,upload_date,lang,transcript,source}"""
    with yt_dlp.YoutubeDL({**YDL, "skip_download": True}) as y:
        info = y.extract_info(url, download=False)
        track = None if force_asr else _pick_track(info)
        if track:
            lang, src = track[0], "subtitle"
            for i in range(3):  # 자막 받기가 가끔 read timeout → 재시도
                try:
                    lines = _json3_lines(json.loads(y.urlopen(track[1]).read())); break
                except yt_dlp.networking.exceptions.TransportError:
                    if i == 2: raise
        else:
            lang, lines, src = _asr(url, Path(work))
    tr = group(lines)
    if not tr:  # 말소리 없는 영상(요리 쇼츠 등) → 영상 설명글로 대신(링크·해시태그 줄은 뺌)
        desc = [l.strip() for l in (info.get("description") or "").splitlines() if l.strip() and not re.match(r"(https?://|#)", l.strip())]
        if not desc:
            raise RuntimeError("말소리·자막·설명글이 모두 없는 영상이라 요약할 수 없어요")
        tr = [{"start": 0, "end": info.get("duration") or 0, "text": l} for l in desc[:200]]
        src, lang = "description", "ko" if re.search(r"[가-힣]", " ".join(desc)) else lang
    d = info.get("upload_date") or ""
    return {"video_id": info["id"], "title": info.get("title"), "channel": info.get("channel") or info.get("uploader"),
            "thumbnail": info.get("thumbnail"), "duration": info.get("duration"),
            "upload_date": f"{d[:4]}-{d[4:6]}-{d[6:]}" if len(d) == 8 else None,
            "lang": lang, "transcript": tr, "source": src}


def playlist(url, limit=10):
    """재생목록·채널 링크 → {title, total, entries:[{id,title,duration,thumbnail}]} (앞에서부터 limit개, 영상은 안 받음)"""
    if re.search(r"youtube\.com/(@[^/?#]+|channel/[^/?#]+|c/[^/?#]+)/?$", url.split("?")[0]):
        url = url.split("?")[0].rstrip("/") + "/videos"  # 채널 첫 화면은 탭 묶음 → 동영상 탭
    elif "list=" in url:
        url = "https://www.youtube.com/playlist?list=" + re.search(r"list=([\w-]+)", url).group(1)
    opts = {**YDL, "noplaylist": False, "extract_flat": "in_playlist", "playlistend": limit, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as y:
        info = y.extract_info(url, download=False)
    es = [e for e in info.get("entries") or [] if e.get("id") and len(e["id"]) == 11][:limit]
    if not es:
        raise ValueError("영상이 없는 재생목록이에요")
    return {"title": re.sub(r" - (Videos|동영상)$", "", info.get("title") or "재생목록"),
            "total": info.get("playlist_count") or len(es),
            "entries": [{"id": e["id"], "title": e.get("title"), "duration": e.get("duration"),
                         "thumbnail": f"https://i.ytimg.com/vi/{e['id']}/mqdefault.jpg"} for e in es]}


if __name__ == "__main__":
    # 묶기 자체 확인 + 실제 영상: uv run python -m app.transcript URL [asr]
    import sys
    g = group([(0, 3, "a"), (3, 6, "b."), (6, 30, "c")])
    assert [(p["start"], p["end"]) for p in g] == [(0, 6), (6, 30)], g
    if len(sys.argv) > 1:
        t = time.time()
        r = fetch(sys.argv[1], Path("../data/work/_test"), force_asr="asr" in sys.argv)
        print(f"{time.time() - t:.1f}s", r["source"], r["lang"], r["title"], len(r["transcript"]), r["transcript"][:2])
