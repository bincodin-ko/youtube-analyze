"""영상노트 verify: 빌드·린트 → 백엔드 자체 점검 → 시험 데이터 복사 → 빈 포트 서버 → Playwright headless 화면 시나리오.
결과 .verify/summary.md + .verify/shots/*.png, 하나라도 실패하면 exit 1. 실제 data/는 읽기만 한다.
실행: verify.bat (= uv run --project backend python verify/run.py)"""
import os, shutil, socket, sqlite3, subprocess, sys, time, urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
V = ROOT / ".verify"
DATA, SHOTS = V / "data", V / "shots"
VIDEO, ARTICLE = "78f1gpZXz4k-1791302454", "a24a0876c78-1791464214"
SEED_IDS = os.environ.get("VN_SEED_IDS", f"{VIDEO},{ARTICLE},FlKHoxHe2O0-1791460989").split(",")
WIN = os.name == "nt"
NOWIN = subprocess.CREATE_NO_WINDOW if WIN else 0
results: list[tuple[str, bool, str]] = []  # (이름, 통과, 이유)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def seed_dir() -> Path:
    # 원본: VN_SEED_DIR, 없으면 메인 저장소(worktree의 공통 .git 옆)의 data/
    if os.environ.get("VN_SEED_DIR"):
        return Path(os.environ["VN_SEED_DIR"])
    try:
        g = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=ROOT,
                           capture_output=True, text=True, check=True).stdout.strip()
        return Path(g).parent / "data"
    except Exception:
        return ROOT / "data"


def step(name, fn):
    t = time.time()
    try:
        fn(); results.append((name, True, f"{time.time() - t:.1f}s"))
    except Exception as e:
        results.append((name, False, f"{type(e).__name__}: {str(e).strip()[-400:]}"))
    print(("PASS " if results[-1][1] else "FAIL ") + name + " — " + results[-1][2], flush=True)


def sh(cmd, cwd=ROOT, env=None):
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       shell=WIN and cmd[0] == "npm", creationflags=NOWIN)
    if r.returncode:
        raise RuntimeError((r.stdout + r.stderr)[-1500:])


# ---- 1. 웹 빌드·린트 (worktree에 node_modules가 없으면 그 안에서 npm ci) ----
def web_deps():
    if not (ROOT / "web" / "node_modules").exists():
        sh(["npm", "ci", "--no-audit", "--no-fund"], ROOT / "web")


# ---- 2. 백엔드: 네트워크 없이 되는 자체 점검 + 임포트(시험 데이터 폴더 기준) ----
def env_data():
    return {**os.environ, "VN_DATA_DIR": str(DATA), "PYTHONIOENCODING": "utf-8"}


def self_check(mod):
    return lambda: sh([sys.executable, "-m", f"app.{mod}"], ROOT / "backend", env_data())


# ---- 3. 시험 데이터: 원본 DB를 읽기 전용으로 복사 → 고른 노트만 남김 + 미디어 복사 ----
def seed():
    src = seed_dir()
    if not (src / "notes.db").exists():
        raise FileNotFoundError(f"원본 DB 없음: {src / 'notes.db'} (VN_SEED_DIR로 지정)")
    shutil.rmtree(DATA, ignore_errors=True); (DATA / "media").mkdir(parents=True)
    with sqlite3.connect(f"file:{src / 'notes.db'}?mode=ro", uri=True) as s, sqlite3.connect(DATA / "notes.db") as d:
        s.backup(d)
    with sqlite3.connect(DATA / "notes.db") as d:
        q = ",".join("?" * len(SEED_IDS))
        d.execute(f"DELETE FROM notes WHERE id NOT IN ({q})", SEED_IDS)
        d.execute("UPDATE notes SET status='done' WHERE status='processing'")  # 서버가 이어서 처리(AI 호출)하지 않게
        n = d.execute("SELECT count(*) FROM notes").fetchone()[0]
    d.close()
    if n != len(SEED_IDS):
        raise RuntimeError(f"시험 노트 {n}/{len(SEED_IDS)}개만 찾음")
    for nid in SEED_IDS:
        if (src / "media" / nid).exists():
            shutil.copytree(src / "media" / nid, DATA / "media" / nid)
        t = DATA / "media" / nid / "terms.json"
        t.parent.mkdir(exist_ok=True)
        if not t.exists():
            t.write_text("[]", encoding="utf-8")  # 없으면 서버가 용어 풀이를 AI로 만들려 함 → 결정적이게 빈 목록
    if (src / "templates.json").exists():
        shutil.copy(src / "templates.json", DATA)


# ---- 4. 서버: 빈 포트 + 시작한 PID만 종료 ----
def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]


def start_server():
    port = free_port()
    log = open(V / "server.log", "w", encoding="utf-8")
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1",
                          "--port", str(port)], cwd=ROOT, env=env_data(), stdout=log, stderr=subprocess.STDOUT, creationflags=NOWIN)
    base = f"http://127.0.0.1:{port}"
    for _ in range(120):
        if p.poll() is not None:
            raise RuntimeError("서버가 바로 꺼짐 — .verify/server.log 참고")
        try:
            urllib.request.urlopen(base + "/api/notes", timeout=2); return p, base
        except OSError:
            time.sleep(0.5)
    p.terminate(); raise TimeoutError("서버 60초 안에 안 뜸")


# ---- 5. 화면 시나리오: 여기 목록에 한 줄 추가하면 끝. (이름, 주소, 폭, 다크, 점검 함수) ----
def sc_home(pg, ex): ex(pg.get_by_text("최근 노트")).to_be_visible()
def sc_library(pg, ex):
    ex(pg.get_by_text("내 노트", exact=True)).to_be_visible()
    ex(pg.locator(f'a[href*="/note/{VIDEO}"]').first).to_be_visible()
def sc_new_yt(pg, ex):
    pg.get_by_role("button", name="유튜브").click()
    ex(pg.get_by_placeholder("https://youtube.com/watch?v=abc")).to_be_visible()
def sc_new_web(pg, ex):
    pg.get_by_role("button", name="웹사이트").click()
    ex(pg.get_by_placeholder("https://...", exact=True)).to_be_visible()
def sc_note(pg, ex):
    ex(pg.locator("[data-report] h1").first).to_be_visible()  # 리포트
    ex(pg.get_by_role("button", name="스크립트", exact=True)).to_be_visible()  # 스크립트 패널
    ex(pg.get_by_placeholder("무엇이든 물어보세요")).to_be_visible()  # 채팅 패널
def sc_article(pg, ex): ex(pg.locator("[data-report] h1").first).to_be_visible()
def sc_mindmap(pg, ex):
    if not (DATA / "media" / VIDEO / "mindmap_normal.md").exists():
        raise SkipCheck("캐시된 mindmap_normal.md 없음")
    pg.get_by_role("button", name="확장", exact=True).click()
    ex(pg.locator("svg g.markmap-node").first).to_be_visible()
def sc_narrow_chat(pg, ex):
    pg.get_by_role("button", name="채팅", exact=True).first.click()
    ex(pg.get_by_placeholder("무엇이든 물어보세요")).to_be_visible()
YT7 = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?si=abcDEF123",
       "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/live/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
       "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijk123&index=2"]
def sc_yt_links(pg, ex):  # 유튜브 탭: 7종 링크 모두 「소화하기」 버튼이 나와야 함(누르지는 않음)
    pg.get_by_role("button", name="유튜브").click()
    box = pg.get_by_placeholder("https://youtube.com/watch?v=abc")
    for u in YT7:
        box.fill(u)
        try: ex(pg.get_by_role("button", name="소화하기", exact=True)).to_be_visible()
        except AssertionError: raise AssertionError("버튼 없음: " + u)
def _times(pg): return pg.locator('button[title$="로 이동"]')
def sc_chat_time_off(pg, ex):  # [시간] 끄기 → 0개 → 새로고침해도 유지
    ex(_times(pg).first).to_be_visible()
    t = pg.get_by_role("button", name="시간 표시"); t.click()
    ex(t).to_have_attribute("aria-pressed", "false"); ex(_times(pg)).to_have_count(0)
    pg.reload(); ex(pg.get_by_role("button", name="시간 표시")).to_have_attribute("aria-pressed", "false")
    ex(pg.get_by_text("AI 에이전트").first).to_be_visible(); ex(_times(pg)).to_have_count(0)
def sc_chat_time_on(pg, ex):  # 끄고 다시 켜면 [시간] 버튼이 돌아옴
    t = pg.get_by_role("button", name="시간 표시"); t.click(); ex(_times(pg)).to_have_count(0)
    t.click(); ex(t).to_have_attribute("aria-pressed", "true"); ex(_times(pg).first).to_be_visible()
def sc_dark(pg, ex):
    ex(pg.locator("html")).to_have_class("dark")
    ex(pg.locator("[data-report] h1").first).to_be_visible()


# ---- 영상 크게 보기·PIP·꾹 누르기 2배속 (유튜브는 차단돼 iframe이 비므로 window.__vnRate 기록과 data-fast로 확인) ----
def _box(pg, sel):
    pg.wait_for_function("s => { const e = document.querySelector(s); return e && e.getBoundingClientRect().width > 0 }", arg=sel)
    return pg.locator(sel).first.bounding_box()
def sc_big(pg, ex):
    pg.get_by_role("button", name="크게 보기").first.click()
    pg.wait_for_function("document.querySelector('[data-stage]').getBoundingClientRect().width >= 800")
    b = _box(pg, "[data-stage]"); h = pg.locator("[data-report] h1").first
    ex(h).to_be_visible()
    assert b["width"] >= 800 and h.bounding_box()["y"] >= b["y"] + b["height"] - 1, f"크게 보기 폭/리포트 위치 이상: {b}"
def sc_pip(pg, ex):
    pg.get_by_role("button", name="크게 보기").first.click()
    pg.wait_for_function("document.querySelector('[data-stage]').getBoundingClientRect().width >= 800")
    pg.evaluate("document.querySelector('section.overflow-y-auto').scrollTop = 900")
    ex(pg.locator("[data-stage]")).to_have_attribute("data-pip", "1")
    pg.wait_for_timeout(300); b = pg.locator("[data-stage]").bounding_box()
    assert b["x"] >= 0 and b["y"] >= 0 and b["x"] + b["width"] <= 1440 and b["y"] + b["height"] <= 900, f"PIP 화면 밖: {b}"
    c = pg.get_by_placeholder("무엇이든 물어보세요").bounding_box()
    assert b["x"] + b["width"] <= c["x"] or b["y"] + b["height"] <= c["y"], f"PIP가 채팅 입력창을 가림: {b} {c}"
def sc_hold2x(pg, ex):
    st = pg.locator("[data-stage]"); _box(pg, "[data-stage]")
    pg.keyboard.down("Space"); pg.wait_for_timeout(600)
    ex(st).to_have_attribute("data-fast", "2"); ex(pg.locator("[data-stage-badge]")).to_contain_text("2배속")
    assert 2 in pg.evaluate("window.__vnRate"), "setPlaybackRate(2) 기록 없음"
    pg.keyboard.up("Space")
    ex(st).to_have_attribute("data-fast", "0"); assert pg.evaluate("window.__vnRate").pop() == 1, "속도 복귀 안 됨"
    box = pg.locator("[data-stage-cover]").bounding_box()  # 마우스 꾹 누르기도 같은 동작
    pg.mouse.move(box["x"] + 50, box["y"] + 50); pg.mouse.down(); pg.wait_for_timeout(700)
    ex(st).to_have_attribute("data-fast", "2"); pg.mouse.up(); ex(st).to_have_attribute("data-fast", "0")
def sc_space_input(pg, ex):
    pg.get_by_placeholder("무엇이든 물어보세요").click(); pg.keyboard.down("Space"); pg.wait_for_timeout(600)
    ex(pg.locator("[data-stage]")).to_have_attribute("data-fast", "0"); pg.keyboard.up("Space")
    assert not pg.evaluate("window.__vnRate || []"), "입력창 포커스인데 속도가 바뀜"


SCENARIOS = [
    ("home", "/", 1440, False, sc_home),
    ("library", "/library", 1440, False, sc_library),
    ("new_youtube", "/new", 1440, False, sc_new_yt),
    ("new_web", "/new", 1440, False, sc_new_web),
    ("note_video", f"/note/{VIDEO}", 1440, False, sc_note),
    ("note_article", f"/note/{ARTICLE}", 1440, False, sc_article),
    ("expand_mindmap", f"/note/{VIDEO}", 1440, False, sc_mindmap),
    ("narrow_chat_1000", f"/note/{VIDEO}", 1000, False, sc_narrow_chat),
    ("dark_note", f"/note/{VIDEO}", 1440, True, sc_dark),
    ("new_yt_links", "/new", 1440, False, sc_yt_links),
    ("chat_time_off", f"/note/{VIDEO}", 1440, False, sc_chat_time_off),
    ("chat_time_on", f"/note/{VIDEO}", 1440, False, sc_chat_time_on),
    ("player_big", f"/note/{VIDEO}", 1440, False, sc_big),
    ("player_pip", f"/note/{VIDEO}", 1440, False, sc_pip),
    ("player_hold2x", f"/note/{VIDEO}", 1440, False, sc_hold2x),
    ("player_space_input", f"/note/{VIDEO}", 1440, False, sc_space_input),
]


class SkipCheck(Exception):
    pass


def run_ui(base):
    from playwright.sync_api import expect, sync_playwright
    expect.set_options(timeout=15000)
    with sync_playwright() as p:
        try:
            br = p.chromium.launch(channel="chrome", headless=True)  # 설치된 Chrome, 창 없음
        except Exception:
            br = p.chromium.launch(headless=True)  # 번들 chromium
        for name, path, w, dark, fn in SCENARIOS:
            blocked, errs = [], []

            def route(r, blocked=blocked):
                u = urlparse(r.request.url)
                if u.hostname != "127.0.0.1":
                    return r.abort()  # 외부(유튜브 등) 차단 → 결정적
                if u.path.startswith("/api/") and r.request.method != "GET":
                    blocked.append(f"{r.request.method} {u.path}"); return r.abort()  # AI·쓰기 동작 금지
                r.continue_()

            def scenario(name=name, path=path, w=w, dark=dark, fn=fn, blocked=blocked, errs=errs):
                ctx = br.new_context(viewport={"width": w, "height": 900}, locale="ko-KR")
                if dark:
                    ctx.add_init_script("localStorage.setItem('theme','dark')")
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.route("**/*", route)
                try:
                    pg.goto(base + path, wait_until="load")
                    fn(pg, expect)
                    pg.wait_for_timeout(500)
                    if errs:
                        raise RuntimeError("페이지 오류: " + "; ".join(errs[:3]))
                finally:
                    pg.screenshot(path=str(SHOTS / f"{name}.png"))
                    ctx.close()
            step(f"ui:{name}", scenario)
            if results[-1][2].startswith("SkipCheck"):
                results[-1] = (f"ui:{name}", True, "건너뜀 — " + results[-1][2].split(": ", 1)[1])
            if blocked:
                results[-1] = (results[-1][0], results[-1][1], results[-1][2] + f" (막은 요청: {', '.join(blocked[:3])})")
        br.close()


def main():
    t0 = time.time()
    shutil.rmtree(SHOTS, ignore_errors=True); SHOTS.mkdir(parents=True)
    step("web:deps", web_deps)
    step("web:build", lambda: sh(["npm", "run", "build"], ROOT / "web"))
    step("web:lint", lambda: sh(["npm", "run", "lint"], ROOT / "web"))
    step("seed", seed)
    for m in ("files", "scenes", "transcript"):
        step(f"backend:{m}", self_check(m))
    step("backend:import", lambda: sh([sys.executable, "-c", "import app.main"], ROOT / "backend", env_data()))
    srv = None
    if all(ok for n, ok, _ in results if n in ("seed", "web:build")):
        def go():
            nonlocal srv
            srv, base = start_server()
            run_ui(base)
        step("server+ui", go)
    if srv:
        srv.terminate(); srv.wait(10)  # 시작한 PID만
    fails = [r for r in results if not r[1]]
    lines = [f"# verify 결과 — {time.strftime('%Y-%m-%d %H:%M')}", "",
             f"- 걸린 시간: {time.time() - t0:.0f}초 / 통과 {len(results) - len(fails)}/{len(results)}",
             f"- 시험 데이터 원본: {seed_dir()} (복사본: .verify/data) / 스크린샷: .verify/shots/", "",
             "| 단계 | 결과 | 이유·시간 |", "|---|---|---|"]
    lines += [f"| {n} | {'통과' if ok else '실패'} | {why.replace('|', '/').replace(chr(10), ' ')} |" for n, ok, why in results]
    (V / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n{'OK' if not fails else 'FAIL'} — {len(results) - len(fails)}/{len(results)} 통과, {time.time() - t0:.0f}초 → .verify/summary.md")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
