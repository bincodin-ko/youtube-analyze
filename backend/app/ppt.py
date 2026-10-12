"""PPT(릴리스 「PPT 만들기」): claude가 슬라이드 JSON을 만들고, 화면은 HTML(web/src/components/Ppt.tsx)로 그리며, 다운로드는 python-pptx로 글자 편집 가능한 PPTX.
결과 data/media/<id>/ext_ppt.json (kind=ppt), 레퍼런스 이미지 data/media/<id>/ppt_ref/<n>.<ext>."""
import io, json, re
from pathlib import Path
from app import ai

# 스타일 9종(릴리스와 같은 이름). 색은 Ppt.tsx THEMES와 같게 유지
THEMES = {
    "minimal": dict(name="미니멀", bg="ffffff", fg="111111", accent="e63946", sub="666666", font="맑은 고딕"),
    "magazine": dict(name="매거진", bg="f3efe7", fg="1d1d1d", accent="c0392b", sub="6b6359", font="바탕"),
    "paper": dict(name="논문", bg="ffffff", fg="1a2b4a", accent="1f4e8c", sub="5c6b82", font="바탕"),
    "diagram": dict(name="도식", bg="f7fbff", fg="14324d", accent="2f8fd8", sub="5d7a93", font="맑은 고딕"),
    "architecture": dict(name="건축", bg="eceae4", fg="2a2a2a", accent="7a7a7a", sub="6f6f6f", font="맑은 고딕"),
    "cobalt": dict(name="코발트", bg="ffffff", fg="0b1f66", accent="1d3fd6", sub="4a5a8c", font="맑은 고딕"),
    "bold": dict(name="볼드", bg="fff6d5", fg="111111", accent="ff2e2e", sub="333333", font="맑은 고딕"),
    "retro": dict(name="레트로", bg="f4ead5", fg="4a2c1a", accent="d9822b", sub="7a5a43", font="바탕"),
    "luxury": dict(name="럭셔리", bg="0e0e0e", fg="f2e6c9", accent="c9a24a", sub="a89d86", font="바탕"),
}
LAYOUTS = ("cover", "bullets", "two", "steps", "stat", "quote", "closing")

SLIDE = """슬라이드 JSON 형식: {"layout":"cover|bullets|two|steps|stat|quote|closing","title":"제목 30자 이내","subtitle":"부제(선택)","points":["항목 40자 이내"],"left":{"head":"왼쪽 제목","points":["..."]},"right":{"head":"오른쪽 제목","points":["..."]},"stat":"큰 숫자·키워드(stat 레이아웃)","quote":"인용문(quote 레이아웃)","ref":대본 줄 인덱스 또는 null}
- cover: 첫 장(title·subtitle) / closing: 마지막 장(title=핵심 한 줄, points=행동 2~3개)
- bullets: points 3~5 / two: left·right 비교 / steps: points가 순서(3~5) / stat: stat+points 2~3 / quote: 화자의 인상적인 말
한국어. 대본에 없는 숫자를 지어내지 않는다."""


def path(media: Path, nid: str) -> Path: return media / nid / "ext_ppt.json"
def ref_dir(media: Path, nid: str) -> Path: return media / nid / "ppt_ref"


def _slide(s: dict, n: int) -> dict:
    lay = s.get("layout") if s.get("layout") in LAYOUTS else "bullets"
    side = lambda x: {"head": str((x or {}).get("head") or ""), "points": [str(p) for p in (x or {}).get("points") or []][:6]}
    out = {"layout": lay, "title": str(s.get("title") or "")[:60], "subtitle": str(s.get("subtitle") or "")[:80],
           "points": [str(p) for p in s.get("points") or []][:6], "stat": str(s.get("stat") or "")[:20], "quote": str(s.get("quote") or "")[:160],
           "ref": s["ref"] if isinstance(s.get("ref"), int) and 0 <= s["ref"] < n else None}
    if lay == "two": out.update(left=side(s.get("left")), right=side(s.get("right")))
    if not out["title"]: raise ValueError("제목 없는 슬라이드")
    return out


def _body(note: dict) -> str:
    tr = note["transcript"]
    return "\n".join(f"[{i} {ai._mmss(s['start'])}] {s['text']}" for i, s in enumerate(tr))


def _refs_hint(media: Path, nid: str) -> tuple[str, tuple]:
    d = ref_dir(media, nid)
    fs = sorted(d.glob("*")) if d.exists() else []
    if not fs: return "", ()
    hint = "\n레퍼런스 이미지(로고·브랜드·스타일): " + ", ".join(f.name for f in fs) + " — Read로 열어 보고 색감·분위기를 문체에 반영하고, 어울리는 강조색을 accent(#RRGGBB)로 정한다."
    return hint, ("--tools", "Read", "--allowedTools", "Read", "--add-dir", str(d))


def generate(media: Path, note: dict, style: str, count: int, extra: str = "") -> dict:
    style = style if style in THEMES else "minimal"
    count = max(2, min(30, int(count)))
    n = len(note["transcript"])
    hint, tools = _refs_hint(media, note["id"])
    prompt = ai._kind(note, f"너는 영상 내용을 발표용 슬라이드 덱으로 만드는 디자이너다. 정확히 {count}장. 첫 장 cover, {'마지막 장 closing, ' if count >= 3 else ''}가운데는 내용에 맞는 레이아웃을 섞는다.\n" + SLIDE +
                      (f"\n사용자 지시(스타일 위에 추가 반영): {extra.strip()[:500]}" if (extra or "").strip() else "") + hint +
                      '\nJSON 객체 하나만 출력(설명·코드펜스 금지): {"title":"덱 제목","accent":"#RRGGBB 또는 빈 문자열","slides":[슬라이드...]}\n\n대본:\n') + _body(note)

    def parse(r):
        ss = [_slide(s, n) for s in r["slides"]]
        if len(ss) < min(2, count): raise ValueError("슬라이드 부족")
        acc = r.get("accent") if re.fullmatch(r"#[0-9a-fA-F]{6}", str(r.get("accent") or "")) else ""
        return {"kind": "ppt", "title": str(r.get("title") or ss[0]["title"]), "style": style, "accent": acc, "slides": ss[:count]}
    return ai._ask(prompt, 300, parse, tools, cwd=str(ref_dir(media, note["id"])) if tools else None, fallback=not tools)


def revise(media: Path, note: dict, deck: dict, changes: dict[int, str]) -> dict:
    """「수정본 생성」: 지시를 적은 장만 다시 만든다(빈 칸은 그대로)."""
    n = len(note["transcript"])
    todo = {int(i): str(t).strip() for i, t in changes.items() if str(t).strip() and 0 <= int(i) < len(deck["slides"])}
    if not todo: raise ValueError("바꿀 슬라이드 지시가 없어요")
    hint, tools = _refs_hint(media, note["id"])
    asks = "\n".join(f"- {i}번 슬라이드(0부터): {t}\n  현재: {json.dumps(deck['slides'][i], ensure_ascii=False)}" for i, t in todo.items())
    prompt = ai._kind(note, "너는 발표 슬라이드를 고치는 디자이너다. 아래 슬라이드만 지시대로 다시 만들어라. 덱 흐름에 맞게.\n" + SLIDE + hint +
                      '\nJSON 객체 하나만 출력: {"slides":{"번호":슬라이드}}\n\n' + asks + "\n\n대본:\n") + _body(note)

    def parse(r):
        new = {int(k): _slide(v, n) for k, v in r["slides"].items() if int(k) in todo}
        if set(new) != set(todo): raise ValueError("빠진 슬라이드")
        return new
    new = ai._ask(prompt, 240, parse, tools, cwd=str(ref_dir(media, note["id"])) if tools else None, fallback=not tools)
    return {**deck, "slides": [new.get(i, s) for i, s in enumerate(deck["slides"])]}


def _png(f: Path):
    """python-pptx가 못 읽는 WEBP 등은 PNG로 바꿔 넘긴다."""
    if f.suffix.lower() in (".png", ".jpg", ".jpeg"): return str(f)
    from PIL import Image
    b = io.BytesIO(); Image.open(f).save(b, "PNG"); b.seek(0); return b


def to_pptx(deck: dict, logo: Path | None = None) -> bytes:
    """글자 편집 가능한 PPTX(16:9). 화면과 같은 색·레이아웃을 단순화해 상자로 배치."""
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Emu, Pt
    t = THEMES.get(deck.get("style"), THEMES["minimal"])
    acc = (deck.get("accent") or "#" + t["accent"])[1:]
    rgb = lambda h: RGBColor.from_string(h.upper())
    prs = Presentation(); prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)
    W, H = prs.slide_width, prs.slide_height
    blank = prs.slide_layouts[6]

    def box(sl, x, y, w, h, text, size, color, bold=False):
        tb = sl.shapes.add_textbox(int(W * x), int(H * y), int(W * w), int(H * h)); tf = tb.text_frame; tf.word_wrap = True
        lines = text if isinstance(text, list) else [text]
        for k, line in enumerate(lines):
            p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
            r = p.add_run(); r.text = line; r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = rgb(color); r.font.name = t["font"]
        return tb

    for s in deck["slides"]:
        sl = prs.slides.add_slide(blank)
        sl.background.fill.solid(); sl.background.fill.fore_color.rgb = rgb(t["bg"])
        bar = sl.shapes.add_shape(1, 0, 0, W, int(H * 0.012)); bar.fill.solid(); bar.fill.fore_color.rgb = rgb(acc); bar.line.fill.background()
        lay = s["layout"]
        if lay in ("cover", "closing"):
            box(sl, .08, .32, .84, .2, s["title"], 40, t["fg"], True)
            box(sl, .08, .55, .84, .3, [s["subtitle"]] if lay == "cover" else [f"• {p}" for p in s["points"]], 20, t["sub"])
        else:
            box(sl, .06, .07, .88, .14, s["title"], 30, t["fg"], True)
            if lay == "two":
                for x, side in ((.06, s.get("left") or {}), (.52, s.get("right") or {})):
                    box(sl, x, .26, .42, .08, side.get("head", ""), 20, acc, True)
                    box(sl, x, .36, .42, .55, [f"• {p}" for p in side.get("points", [])], 16, t["fg"])
            elif lay == "stat":
                box(sl, .06, .28, .88, .22, s["stat"], 66, acc, True)
                box(sl, .06, .55, .88, .38, [f"• {p}" for p in s["points"]], 18, t["fg"])
            elif lay == "quote":
                box(sl, .1, .3, .8, .4, f"“{s['quote'] or (s['points'] or [''])[0]}”", 28, t["fg"], True)
            else:
                pre = (lambda k: f"{k + 1}. ") if lay == "steps" else (lambda k: "• ")
                box(sl, .06, .26, .88, .66, [pre(k) + p for k, p in enumerate(s["points"])], 20, t["fg"])
        if logo and logo.exists():
            sl.shapes.add_picture(_png(logo), int(W * .88), int(H * .88), height=int(H * .08))
    buf = io.BytesIO(); prs.save(buf); return buf.getvalue()


if __name__ == "__main__":  # 자체 점검: 2장 덱 → PPTX 바이트 → 다시 열어 장 수·글자 확인
    from pptx import Presentation
    d = {"style": "cobalt", "accent": "", "slides": [_slide({"layout": "cover", "title": "표지", "subtitle": "부제"}, 1), _slide({"layout": "two", "title": "비교", "left": {"head": "A", "points": ["a1"]}, "right": {"head": "B", "points": ["b1"]}}, 1)]}
    p = Presentation(io.BytesIO(to_pptx(d)))
    texts = [sh.text_frame.text for s in p.slides for sh in s.shapes if sh.has_text_frame]
    assert len(p.slides) == 2 and "표지" in texts and "A" in texts, texts
    import tempfile
    from PIL import Image
    w = Path(tempfile.mkdtemp()) / "logo.webp"; Image.new("RGB", (40, 20), "red").save(w, "WEBP")
    assert len(Presentation(io.BytesIO(to_pptx(d, w))).slides) == 2  # WEBP 로고도 PPTX에 들어감
    print("ok", len(p.slides), texts[:4])
