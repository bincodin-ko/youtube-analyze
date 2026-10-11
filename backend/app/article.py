"""웹 글·기사 → 본문 추출(trafilatura, Apache-2.0) → 문단 배열 + 본문 이미지(최대 15장). 유튜브 transcript.fetch와 같은 모양으로 반환."""
import hashlib, io, re, urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

import trafilatura
from lxml import etree, html as lh
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
NOPE = "본문을 가져올 수 없어요(로그인·유료 기사이거나 글이 없는 페이지)"


def _get(url, referer=None, timeout=20):
    req = urllib.request.Request(url, headers={**UA, **({"Referer": referer} if referer else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _img(url, page, dest):
    """이미지 한 장 받아 jpg로 저장. 작은 것(아이콘·광고)·svg·실패는 False."""
    try:
        im = Image.open(io.BytesIO(_get(url, page)))
        if im.width < 240 or im.height < 140:
            return False
        im.convert("RGB").save(dest, "JPEG", quality=85)
        return True
    except Exception:
        return False


# 군더더기 문단: 메뉴·공유·저작권·기자 정보. 짧은 문단(<=60자)에만 메뉴성 패턴을 적용해 본문은 안 지움
JUNK_SHORT = re.compile(r"^(글꼴\s*크기|글자\s*크기|기사\s*공유|공유(하기)?|구독|스크랩|인쇄|댓글|좋아요|페이스북|트위터|카카오톡|URL\s*복사|링크\s*복사|기사\s*번역|가가|본문\s*글씨|추천|목록)\s*$")
JUNK_ANY = re.compile(r"(무단\s*전재|재배포\s*(및|,)?\s*(AI|금지)|저작권자|ⓒ|©|Copyright|[\w.+-]+@[\w-]+(\.[\w-]+)+\s*$|기자\s*[\w.+-]*@|구독\s*신청|뉴스레터)", re.I)


def clean(paras):
    """→ (남긴 문단, 지운 문단). 메뉴성 짧은 문단·저작권/기자 이메일 줄(160자 이하)만 지운다."""
    keep, cut = [], []
    for t in paras:
        junk = (len(t) <= 60 and JUNK_SHORT.search(t)) or (len(t) <= 160 and JUNK_ANY.search(t))
        (cut if junk else keep).append(t)
    return keep, cut


def fetch(url, media_dir):
    """→ {title, channel(사이트명), upload_date, thumbnail, lang, transcript:[{start:문단번호,end,text}], images:[{time,file}], source}"""
    media_dir = Path(media_dir); media_dir.mkdir(parents=True, exist_ok=True)
    try:
        raw = trafilatura.fetch_url(url) or _get(url)
    except Exception:
        raw = None
    if not raw:
        raise ValueError(NOPE)
    xml = trafilatura.extract(raw, output_format="xml", include_images=True, include_comments=False, url=url, with_metadata=True, favor_precision=True)
    if not xml:
        raise ValueError(NOPE)
    root = etree.fromstring(xml.encode())
    paras, graphics = [], []  # graphics: (src, 그 앞 문단 수)
    for e in root.iter("p", "head", "item", "graphic"):
        if e.tag == "graphic":
            if e.get("src"): graphics.append((e.get("src"), len(paras)))
        else:
            t = re.sub(r"\s+", " ", "".join(e.itertext())).strip()
            if t: paras.append(t)
    paras = clean(paras)[0]
    if sum(map(len, paras)) < 200:  # 로그인 벽·유료 기사·빈 페이지
        raise ValueError(NOPE)
    # 본문 이미지: trafilatura가 못 찾으면(지연 로딩 등) article 안 img(src·data-src)를 직접 훑음
    doc = lh.fromstring(raw if isinstance(raw, bytes) else raw.encode())
    if len(graphics) < 3:
        for im in doc.xpath("//article//img | //*[@id='dic_area']//img | //*[@id='articleBodyContents']//img"):
            s = im.get("data-src") or im.get("src")
            if s: graphics.append((s, None))
    og = (doc.xpath("//meta[@property='og:image']/@content") or [None])[0]
    if og: graphics.insert(0, (og, 0))
    images, seen, thumb = [], set(), None
    for s, pos in graphics:
        u = urljoin(url, s)
        if u in seen or urlparse(u).scheme not in ("http", "https") or len(images) >= 15: continue
        seen.add(u)
        name = f"a_{len(images):02d}.jpg"
        if _img(u, url, media_dir / name):
            thumb = thumb or name
            # 위치를 모르면 문단에 고르게 흩뿌림
            images.append({"time": float(pos if pos is not None else len(images) * len(paras) // 8), "file": name})
    if thumb:
        (media_dir / "thumb.jpg").write_bytes((media_dir / thumb).read_bytes())
    else:  # 이미지 없는 글: 카드가 깨져 보이지 않게 연한 회색 대체 썸네일
        Image.new("RGB", (640, 360), "#e4e5e1").save(media_dir / "thumb.jpg", "JPEG")
    a = root.attrib
    text = "".join(paras)
    ko = len(re.findall(r"[가-힣]", text)) > len(text) * 0.2
    return {"title": a.get("title") or paras[0][:80], "channel": a.get("sitename") or urlparse(url).hostname,
            "upload_date": a.get("date") or "", "lang": "ko" if ko else "en",
            "transcript": [{"start": float(i), "end": float(i + 1), "text": t} for i, t in enumerate(paras)],
            "images": images, "source": "본문 추출",
            "thumbnail": f"/media/{media_dir.name}/thumb.jpg"}


def new_id(url):
    import time
    return "a" + hashlib.md5(url.encode()).hexdigest()[:10] + f"-{int(time.time())}"


if __name__ == "__main__":
    k, c = clean(["본문입니다 " * 10, "글꼴 크기", "기사 공유", "홍길동 기자 hong@yna.co.kr", "저작권자 © 연합뉴스, 무단 전재 및 재배포 금지"])
    assert len(k) == 1 and len(c) == 4, (k, c)
    # 자체 확인: 본문 없는 주소는 안내 문구
    try: fetch("https://example.com/", "../data/media/_t")
    except ValueError as e: assert str(e) == NOPE
    else: raise SystemExit("본문 없음 감지 실패")
    print("ok")
