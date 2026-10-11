"""아이콘 생성: app.pyw make_icon과 같은 그림을 256px로 그려 16/32/48/128로 축소. 실행: python make_icons.py (Pillow 필요)"""
from pathlib import Path
from PIL import Image, ImageDraw

s = 256
im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
k = s / 32
d.rounded_rectangle([0, 0, s - 1, s - 1], radius=9 * k, fill="#0c0d08")
d.polygon([(9 * k, 8.5 * k), (9 * k, 16.5 * k), (15.5 * k, 12.5 * k)], fill="#ffffff")
for x, y, w in [(9, 19, 14), (9, 23, 9), (18, 10.5, 5)]:
    d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + 2) * k], radius=k, fill="#ffffff")
d.ellipse([22 * k, 4 * k, 27 * k, 9 * k], fill="#dfff32")
out = Path(__file__).parent / "icons"
out.mkdir(exist_ok=True)
for n in (16, 32, 48, 128):
    im.resize((n, n), Image.LANCZOS).save(out / f"{n}.png")
