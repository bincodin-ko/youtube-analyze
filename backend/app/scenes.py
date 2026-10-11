"""720p 화면만 받기 → 1fps 저해상도 프레임 차이 + pHash로 화면 바뀐 시점 → 720p jpg 저장 → 원본 삭제(D5)."""
import subprocess, sys, time
from pathlib import Path

import imagehash
import numpy as np
from PIL import Image

from app.transcript import download

W, H = 160, 90


def _lowres_frames(video):
    # 임시 파일 없이 파이프로 1fps 회색 160x90 프레임을 받음
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"fps=1,scale={W}:{H},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W)


def candidates(frames, duration, thresh=6.0, min_len=2):
    """화면이 바뀐 구간마다 '다음 바뀜 직전' 프레임 시각(초). 점진적 등장 슬라이드의 완성 상태를 잡는다."""
    if len(frames) < 2:
        return []
    f = frames.astype(np.int16)
    diff = np.abs(f[1:] - f[:-1]).mean(axis=(1, 2))  # diff[i] = i → i+1 변화량
    cuts = [0] + [i + 1 for i, d in enumerate(diff) if d > thresh] + [len(frames)]
    segs = [(a, b, diff[a - 1] if a else 99) for a, b in zip(cuts, cuts[1:]) if b - a >= min_len]
    kept, hashes = [], []
    for a, b, score in segs:
        t = b - 1
        h = imagehash.phash(Image.fromarray(frames[t]))
        if all(h - k > 6 for k in hashes):  # 앞서 고른 장면과 거의 같은 화면이면 버림
            kept.append((t, score)); hashes.append(h)
    limit = max(3, int(duration / 60 * 3))  # ponytail: 1분당 약 3장 상한, 변화량 큰 순으로 자름
    kept = sorted(kept, key=lambda x: -x[1])[:limit]
    return sorted(t for t, _ in kept)


def extract(url, media_dir, work, duration):
    """→ [{"time": 초, "file": "s_0015.jpg"}]. 받은 영상은 끝나면 항상 삭제."""
    media_dir, work = Path(media_dir), Path(work)
    media_dir.mkdir(parents=True, exist_ok=True); work.mkdir(parents=True, exist_ok=True)
    local = Path(url).is_file()  # 내 영상 파일: 받지 않고, 끝나도 지우지 않는다(사용자 파일)
    video = Path(url) if local else download(url, "bv*[height<=720][vcodec^=avc1]/bv*[height<=720]", work / "v")
    try:
        out = []
        for t in candidates(_lowres_frames(video), duration or 0):
            name = f"s_{t:04d}.jpg"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1",
                            "-q:v", "3", str(media_dir / name)], check=True)
            out.append({"time": float(t), "file": name})
        return out
    finally:
        if not local:
            video.unlink(missing_ok=True)


if __name__ == "__main__":
    # 자체 확인: 서로 다른 무늬 화면 A 5초 → B 5초 → A 5초면 장면 2개(마지막 A는 중복 제거)
    a, b = (np.random.default_rng(s).integers(0, 256, (H, W), dtype=np.uint8) for s in (1, 2))
    fr = np.stack([a] * 5 + [b] * 5 + [a] * 5)
    assert candidates(fr, 600) == [4, 9], candidates(fr, 600)
    if len(sys.argv) > 1:  # uv run python -m app.scenes URL
        t = time.time()
        s = extract(sys.argv[1], "../data/media/_test", "../data/work/_test", 978)
        print(f"{time.time() - t:.1f}s, {len(s)} scenes", s[:5])
