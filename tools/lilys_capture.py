"""릴리스AI 화면 캡처 → design-ref/

  uv run --with playwright python tools/lilys_capture.py public   # 1단계: 로그인 없이
  uv run --with playwright python tools/lilys_capture.py login    # 2단계 준비: 창을 띄우고 사용자가 직접 로그인할 때까지 대기
  uv run --with playwright python tools/lilys_capture.py app URL 이름 [탭글자 ...]  # 2단계: 로그인 화면 캡처

설치된 Chrome(channel="chrome")을 써서 브라우저를 따로 받지 않는다.
로그인 상태는 프로젝트 전용 프로필 .lilys-profile/ 에 저장된다(비밀번호는 절대 입력하지 않음).
"""
import json, random, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "design-ref"
PROFILE = ROOT / ".lilys-profile"
SIZES = {"PC": dict(viewport={"width": 1440, "height": 900}),
         "Mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")}
THEMES = ("light", "dark")
PUBLIC = [  # (화면이름, URL)
    ("home", "https://lilys.ai/ko/"),
    ("pricing", "https://lilys.ai/ko/pricing/"),
    ("feature-youtube-summarizer", "https://lilys.ai/ko/features/youtube-summarizer/"),
    ("feature-youtube-transcript", "https://lilys.ai/ko/features/youtube-to-transcript/"),
    ("notes-explore", "https://lilys.ai/notes/ko"),
    ("public-note", "https://lilys.ai/ko/notes/fomc-meeting-20261004/fomc-press-conference-september-2026"),
    ("signup", "https://lilys.ai/ko/signup"),
]
TOKENS_JS = """() => {
  const cs = e => e && getComputedStyle(e);
  const pick = sel => { const e = document.querySelector(sel); if (!e) return null; const s = cs(e);
    return {font: s.fontFamily.split(',')[0], size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, color: s.color}; };
  const colors = {};
  for (const e of [...document.querySelectorAll('body *')].slice(0, 3000)) {
    const s = cs(e); for (const c of [s.backgroundColor, s.color]) if (c && c !== 'rgba(0, 0, 0, 0)') colors[c] = (colors[c] || 0) + 1; }
  return {bodyBg: cs(document.body).backgroundColor, body: pick('body'), h1: pick('h1'), h2: pick('h2'), h3: pick('h3'), p: pick('p'),
          button: pick('button'), topColors: Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 12),
          pageHeight: document.documentElement.scrollHeight};
}"""


def settle(page):
    page.wait_for_load_state("networkidle", timeout=60000)
    for _ in range(20):  # 지연 로딩 이미지가 뜨도록 천천히 끝까지 스크롤
        page.mouse.wheel(0, 900); time.sleep(0.4)
    page.evaluate("window.scrollTo(0, 0)"); time.sleep(1.5)


def pause():
    time.sleep(random.uniform(3, 6))  # 사이트에 부담 주지 않게 페이지 사이 간격


def shoot(page, name, size, theme, manifest):
    path = OUT / f"{name}_{size}_{theme}.png"
    page.screenshot(path=path, full_page=True)
    manifest[path.name] = {"url": page.url, **page.evaluate(TOKENS_JS)}
    print("saved", path.name, flush=True)


def save_manifest(manifest):
    f = OUT / "_manifest.json"
    old = json.loads(f.read_text("utf-8")) if f.exists() else {}
    f.write_text(json.dumps({**old, **manifest}, ensure_ascii=False, indent=1), "utf-8")


def public(p):
    manifest = {}
    b = p.chromium.launch(channel="chrome", headless=True)
    for size, opts in SIZES.items():
        for theme in THEMES:
            ctx = b.new_context(locale="ko-KR", color_scheme=theme, **opts)
            page = ctx.new_page()
            for name, url in PUBLIC:
                try:
                    page.goto(url, timeout=60000); settle(page); shoot(page, name, size, theme, manifest)
                except Exception as e:
                    print("FAIL", name, size, theme, e, flush=True)
                pause()
            ctx.close()
    b.close(); save_manifest(manifest)


def login(p):
    ctx = p.chromium.launch_persistent_context(PROFILE, channel="chrome", headless=False, locale="ko-KR", no_viewport=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://lilys.ai/ko/signup")
    print("로그인해 주세요 (창에서 직접). 최대 20분 기다립니다.", flush=True)
    start = len(ctx.cookies("https://lilys.ai"))
    for _ in range(240):
        time.sleep(5)
        names = [c["name"] for c in ctx.cookies("https://lilys.ai")]
        url = page.url if not page.is_closed() else ""
        if any(k in n.lower() for n in names for k in ("token", "session", "auth", "access")) and "signup" not in url and "login" not in url:
            print("LOGGED_IN", url, flush=True); time.sleep(5); break
    else:
        print("TIMEOUT cookies-before", start, flush=True)
    ctx.close()


def app(p, url, name, tabs):
    """로그인된 프로필로 화면 하나를 PC/Mobile x light/dark 로 캡처. tabs: 클릭해서 따로 찍을 탭 글자들."""
    manifest = {}
    ctx = p.chromium.launch_persistent_context(PROFILE, channel="chrome", headless=True, locale="ko-KR")
    page = ctx.new_page()
    for size, opts in SIZES.items():
        page.set_viewport_size(opts["viewport"])
        for theme in THEMES:
            page.emulate_media(color_scheme=theme)
            page.goto(url, timeout=60000); settle(page)
            shoot(page, name, size, theme, manifest)
            for t in tabs:
                try:
                    page.get_by_text(t, exact=True).first.click(); time.sleep(3); settle(page)
                    shoot(page, f"{name}-{t}", size, theme, manifest)
                except Exception as e:
                    print("FAIL tab", t, size, theme, e, flush=True)
            pause()
    ctx.close(); save_manifest(manifest)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    mode = sys.argv[1]
    with sync_playwright() as p:
        if mode == "public": public(p)
        elif mode == "login": login(p)
        elif mode == "app": app(p, sys.argv[2], sys.argv[3], sys.argv[4:])
