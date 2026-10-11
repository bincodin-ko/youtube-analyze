"""노트 내보내기: Markdown / 장면 이미지를 base64로 넣은 HTML 한 파일 / 그 HTML을 Playwright로 PDF."""
import base64, html, re
from pathlib import Path


def _t(s): return f"{int(s) // 60:02d}:{int(s) % 60:02d}"


def _refs(note, refs):
    # 출처 번호 → 유튜브 그 시점 링크 [mm:ss]
    tr = note.get("transcript") or []
    return [(_t(tr[n]["start"]), f"https://youtu.be/{note['video_id']}?t={int(tr[n]['start'])}")
            for n in refs if 0 <= n < len(tr)]


def to_md(note):
    r = note.get("report") or {}
    out = [f"# {r.get('title') or note.get('title') or ''}", "",
           f"> 원본: [{note.get('title') or note['url']}]({note['url']}) · {note.get('channel') or ''}", ""]
    if r.get("overview"):
        out += [r["overview"], ""]
    out += [f"- {k}" for k in r.get("key_points") or []] + [""]
    for s in r.get("sections") or []:
        out += [f"## {s['id']}. {s['title']}", ""]
        for c in s.get("children") or []:
            out += [f"### {c['id']}. {c['title']}", ""]
            if c.get("scene"):
                out += [f"*(장면 {_t(c['scene']['time'])})*", ""]
            for i, b in enumerate(c.get("bullets") or [], 1):
                out.append(f"{i}. {b['text']}" + "".join(f" [{t}]({u})" for t, u in _refs(note, b.get("refs") or [])))
            out.append("")
    return "\n".join(out)


def _inline(text):
    # **굵게** → <b>, 나머지는 이스케이프
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(text))


def to_html(note, media_dir: Path):
    r = note.get("report") or {}
    e = html.escape
    body = [f"<h1>{e(r.get('title') or note.get('title') or '')}</h1>",
            f"<p class=meta>원본: <a href='{e(note['url'])}'>{e(note.get('title') or note['url'])}</a> · {e(note.get('channel') or '')}</p>"]
    if r.get("overview"):
        body.append(f"<p>{_inline(r['overview'])}</p>")
    if r.get("key_points"):
        body.append("<ul>" + "".join(f"<li>{_inline(k)}</li>" for k in r["key_points"]) + "</ul>")
    for s in r.get("sections") or []:
        body.append(f"<h2>{e(s['id'])}. {e(s['title'])}</h2>")
        for c in s.get("children") or []:
            body.append(f"<h3>{e(c['id'])}. {e(c['title'])}</h3>")
            f = c.get("scene") and media_dir / c["scene"]["file"]
            if f and f.is_file():
                b64 = base64.b64encode(f.read_bytes()).decode()
                body.append(f"<img src='data:image/jpeg;base64,{b64}' alt='장면 {_t(c['scene']['time'])}'>")
            body.append("<ol>" + "".join(
                f"<li>{_inline(b['text'])}" + "".join(f" <a class=ref href='{u}'>[{t}]</a>" for t, u in _refs(note, b.get('refs') or [])) + "</li>"
                for b in c.get("bullets") or []) + "</ol>")
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>{e(r.get('title') or note.get('title') or '')}</title>
<style>body{{max-width:720px;margin:40px auto;padding:0 20px;font:16px/1.75 Pretendard,"Malgun Gothic",sans-serif;color:#0c0d08}}
h1{{font-size:30px;line-height:1.35}}h2{{font-size:22px;margin-top:2.2em}}h3{{font-size:18px}}b{{color:#6663fd}}
.meta{{color:#9fa28e;font-size:14px}}a{{color:#6663fd}}.ref{{font-size:12px;text-decoration:none}}
img{{width:100%;border-radius:12px;margin:8px 0;break-inside:avoid}}li{{margin:4px 0}}</style></head>
<body>{''.join(body)}</body></html>"""


def to_pdf(html_text):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")  # 설치된 Chrome 사용(브라우저 따로 안 받음)
        try:
            pg = b.new_page()
            pg.set_content(html_text, wait_until="load")
            return pg.pdf(format="A4", print_background=True, margin={"top": "16mm", "bottom": "16mm", "left": "12mm", "right": "12mm"})
        finally:
            b.close()
