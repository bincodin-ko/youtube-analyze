"""내 파일 입력: PDF(pypdf, BSD) 텍스트 → 문단, 음성·영상(faster-whisper) → 대본. 반환은 transcript.fetch와 같은 모양."""
import re
from pathlib import Path

from app import transcript

EXT = {**dict.fromkeys((".pdf",), "pdf"),
       **dict.fromkeys((".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac"), "audio"),
       **dict.fromkeys((".mp4", ".mkv", ".mov", ".webm", ".avi"), "localvideo")}


def kind_of(name):
    return EXT.get(Path(name).suffix.lower())


def _chunks(text, hi=800):
    """긴 문단은 문장 끝에서 잘라 hi자 안팎으로."""
    out, cur = [], ""
    for s in re.split(r"(?<=[.?!。다요])\s+", text):
        if cur and len(cur) + len(s) > hi:
            out.append(cur); cur = ""
        cur = (cur + " " + s).strip()
    return out + ([cur] if cur else [])


def pdf(path):
    """페이지별 텍스트 → 문단. transcript[i] = {start: 문단 번호, end, text, page: 쪽}. 스캔 PDF(글자 없음)는 오류."""
    from pypdf import PdfReader
    try:
        r = PdfReader(str(path))
        pages = [p.extract_text() or "" for p in r.pages]
    except Exception as e:
        raise ValueError(f"PDF를 열 수 없어요(암호가 걸렸거나 깨진 파일): {e}")
    paras = []
    for no, t in enumerate(pages, 1):
        for blk in re.split(r"\n\s*\n", t):
            blk = re.sub(r"\s+", " ", blk).strip()
            paras += [(no, c) for c in _chunks(blk)] if blk else []
    if sum(len(t) for _, t in paras) < 50:
        raise ValueError("PDF에서 글자를 읽을 수 없어요(스캔·이미지 PDF는 지원하지 않아요)")
    text = "".join(t for _, t in paras)
    title = r.metadata.title if r.metadata and (r.metadata.title or "").lower() not in ("", "untitled") else None  # 없으면 업로드한 파일 이름 유지
    return {"title": title, "channel": f"PDF · {len(pages)}쪽", "lang": "ko" if len(re.findall(r"[가-힣]", text)) > len(text) * 0.2 else "en",
            "transcript": [{"start": float(i), "end": float(i + 1), "text": t, "page": no} for i, (no, t) in enumerate(paras)],
            "source": "PDF 텍스트 추출", "thumbnail": ""}


def media(path):
    """음성·영상 파일 → faster-whisper 대본. (길이는 av로)"""
    import av
    with av.open(str(path)) as c:
        dur = (c.duration or 0) / 1e6
    lang, lines, dev = transcript.asr_file(path)
    if not lines:
        raise ValueError("음성이 들어 있지 않아요")
    return {"channel": "내 파일", "duration": dur, "lang": lang, "transcript": transcript.group(lines),
            "source": dev, "thumbnail": ""}


if __name__ == "__main__":
    assert kind_of("A.PDF") == "pdf" and kind_of("x.m4a") == "audio" and kind_of("x.txt") is None
    assert len(_chunks("가나다요. " * 300)) > 1
    print("ok")
