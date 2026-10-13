"""영상노트 verify: 빌드·린트 → 백엔드 자체 점검 → 시험 데이터 복사 → 빈 포트 서버 → Playwright headless 화면 시나리오.
결과 .verify/summary.md + .verify/shots/*.png, 하나라도 실패하면 exit 1. 실제 data/는 읽기만 한다.
실행: verify.bat (= uv run --project backend python verify/run.py)"""
import json, os, re, shutil, socket, sqlite3, subprocess, sys, time, urllib.request
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
        # 사용자가 원본에서 시험 노트를 지웠으면 가장 최근 백업(notes.db.bak-*)에서 그 줄만 가져옴
        have = {r[0] for r in d.execute("SELECT id FROM notes")}
        for b in sorted(src.glob("notes.db.bak-*"), key=lambda p: p.stat().st_mtime, reverse=True):
            miss = [i for i in SEED_IDS if i not in have]
            if not miss: break
            d.execute("ATTACH DATABASE ? AS b", (str(b),))  # 읽기만 함
            try:  # 옛 백업은 칸이 적을 수 있음(예: deleted_at) → 둘 다 있는 칸만 옮김
                cols = ",".join(c[1] for c in d.execute("PRAGMA b.table_info(notes)") if c[1] in {r[1] for r in d.execute("PRAGMA main.table_info(notes)")})
                d.execute(f"INSERT INTO notes ({cols}) SELECT {cols} FROM b.notes WHERE id IN ({','.join('?' * len(miss))})", miss)
            except sqlite3.Error: pass
            d.commit(); d.execute("DETACH DATABASE b")
            have = {r[0] for r in d.execute("SELECT id FROM notes")}
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
def sc_home(pg, ex):  # 릴리스 홈 배치: 위 줄 「새로 추가하기」, 라이브러리 카드 줄 + 전체 보기, 구독 칸, 사이드바 노트 목록·휴지통·구독
    ex(pg.get_by_role("heading", name="라이브러리")).to_be_visible()
    ex(pg.get_by_role("link", name="전체 보기")).to_have_attribute("href", "/library")
    ex(pg.locator("[data-card]").first).to_be_visible()
    assert pg.locator("[data-card]").count() == 3, pg.locator("[data-card]").count()
    ex(pg.locator("[data-card]").nth(1).get_by_text("유튜브")).to_be_visible(); ex(pg.locator("[data-card]").first.get_by_text("웹사이트")).to_be_visible()
    w = pg.locator("[data-card]").first.bounding_box()["width"]; assert 200 <= w <= 214, w  # 릴리스처럼 212px 고정폭
    ex(pg.locator("[data-subs]")).to_be_visible(); ex(pg.locator("[data-subs]").get_by_text("아직 구독한 채널이 없어요")).to_be_visible()
    ex(pg.get_by_role("button", name="새로 추가하기").first).to_be_visible()
    ex(pg.locator("[data-lib-tree] a[href^='/note/']")).to_have_count(3)
    ex(pg.locator("[data-lib-tree]").get_by_role("link", name="휴지통")).to_be_visible()
    ex(pg.get_by_role("link", name="구독", exact=True)).to_be_visible()
    pg.get_by_role("button", name="라이브러리 접기").click(); ex(pg.locator("[data-lib-tree]")).to_have_count(0)
    pg.reload(); ex(pg.get_by_role("button", name="라이브러리 펼치기")).to_be_visible()  # 접힘 상태 유지
    pg.get_by_role("button", name="라이브러리 펼치기").click()


def sc_trash(pg, ex):  # 삭제 → 휴지통 → 복원(시험용 복사 데이터)
    nid = "FlKHoxHe2O0-1791460989"
    card = pg.locator(f"li:has(a[href='/note/{nid}'])")
    card.get_by_title("더보기").click(); card.get_by_role("button", name="삭제").click()
    d = pg.get_by_role("dialog"); ex(d.get_by_text("휴지통에서 다시 꺼낼 수 있어요", exact=False)).to_be_visible()
    d.get_by_role("button", name="휴지통으로").click()
    ex(pg.locator(f"main a[href='/note/{nid}']")).to_have_count(0)
    pg.locator("[data-lib-tree]").get_by_role("link", name="휴지통").click()
    row = pg.locator("[data-trash-row]", has=pg.locator(f"a[href='/note/{nid}']")); ex(row).to_be_visible()
    row.get_by_role("button", name="영구 삭제").click(); ex(pg.get_by_role("dialog", name="영구 삭제 확인")).to_be_visible()
    pg.keyboard.press("Escape"); ex(pg.get_by_role("dialog", name="영구 삭제 확인")).to_have_count(0)
    row.get_by_role("button", name="복원").click(); ex(pg.locator("[data-trash-row]")).to_have_count(0)
    pg.goto(pg.url.split("/trash")[0] + "/library"); ex(pg.locator(f"main a[href='/note/{nid}']").first).to_be_visible()


def sc_subs(pg, ex):  # 구독: 채널 추가 → 칩 + 새 영상 목록(유튜브 응답은 가짜로)
    state = {"subs": []}
    pg.route("**/api/subs/videos", lambda r: r.fulfill(json=[{"id": "abcdefghijk", "title": "새 영상 제목", "thumbnail": "", "channel": "테스트채널", "duration": 60}] if state["subs"] else []))
    def subs(r):
        if r.request.method == "POST": state["subs"] = [{"url": "https://www.youtube.com/@test", "name": "테스트채널"}]
        r.fulfill(json=state["subs"])
    pg.route("**/api/subs", subs)
    pg.reload()
    pg.get_by_role("button", name="구독", exact=True).click()
    pg.get_by_label("채널 링크").fill("https://www.youtube.com/@test"); pg.get_by_role("button", name="추가", exact=True).click()
    ex(pg.get_by_text("테스트채널").first).to_be_visible(); ex(pg.get_by_text("새 영상 제목")).to_be_visible()
    ex(pg.get_by_text("새 영상 1개")).to_be_visible()
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
    ex(pg.get_by_placeholder("무엇이든 요청하세요 (질문, 작성, 수정)")).to_be_visible()  # 채팅 패널
    # 시드 노트는 terms.json 있음 → 맨 끝에 정확히 한 번 (용어는 따로 불러와서 기다림)
    ex(pg.get_by_role("heading", name="용어 풀이", exact=True)).to_have_count(1 if json.loads((DATA / "media" / VIDEO / "terms.json").read_text(encoding="utf-8")) else 0)
def sc_article(pg, ex):
    ex(pg.locator("[data-report] h1").first).to_be_visible()
    h = pg.locator("[data-src-head]"); ex(h.locator("h2")).to_be_visible()  # 릴리스: 왼쪽 머리말 = 제목 + 바깥 링크 아이콘
    ex(h.get_by_role("link", name="원문 링크 열기")).to_have_attribute("target", "_blank")
    tip = pg.locator("[data-share-tip]").first; tip.scroll_into_view_if_needed(); ex(tip).to_be_visible()  # 공유·내보내기 첫 안내
    pg.screenshot(path=str(SHOTS / "note_article_tip.png"))
    tip.get_by_role("button", name="안내 닫기").click(); pg.reload(); pg.locator("[data-report] h1").first.wait_for()
    ex(pg.locator("[data-share-tip]")).to_have_count(0)
def sc_mindmap(pg, ex):
    if not (DATA / "media" / VIDEO / "mindmap_normal.md").exists():
        raise SkipCheck("캐시된 mindmap_normal.md 없음")
    pg.get_by_role("button", name="확장", exact=True).click()
    ex(pg.locator("svg g.markmap-node").first).to_be_visible()
def sc_narrow_chat(pg, ex):
    pg.get_by_role("button", name="채팅", exact=True).first.click()
    ex(pg.get_by_placeholder("무엇이든 요청하세요 (질문, 작성, 수정)")).to_be_visible()
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
def sc_big(pg, ex):  # 크게 보기 = 왼쪽 영상·스크립트 칸이 넓어지고 리포트는 오른쪽에 그대로(겹침 없음)
    pg.get_by_role("button", name="크게 보기").last.click()
    pg.wait_for_function("document.querySelector('[data-stage]').getBoundingClientRect().width >= 600")
    b = _box(pg, "[data-stage]"); h = pg.locator("[data-report] h1").first
    ex(h).to_be_visible(); ex(pg.get_by_role("button", name="스크립트", exact=True)).to_be_visible()
    hb = h.bounding_box()
    assert b["width"] >= 600 and hb["x"] >= b["x"] + b["width"], f"크게 보기 폭/리포트 겹침: {b} {hb}"
    pg.get_by_role("button", name="작게 보기").last.click()
    pg.wait_for_function("document.querySelector('[data-stage]').getBoundingClientRect().width < 400")
def sc_hold2x(pg, ex):
    st = pg.locator("[data-stage]"); _box(pg, "[data-stage]")
    pg.keyboard.down("Space"); pg.wait_for_timeout(600)
    ex(st).to_have_attribute("data-fast", "2"); ex(pg.locator("[data-stage-badge]")).to_contain_text("2배속")
    assert 2 in pg.evaluate("window.__vnRate"), "setPlaybackRate(2) 기록 없음"
    pg.keyboard.up("Space")
    ex(st).to_have_attribute("data-fast", "0"); assert pg.evaluate("window.__vnRate").pop() == 1, "속도 복귀 안 됨"
    assert pg.locator("[data-stage-cover]").count() == 0, "덮개가 유튜브 버튼(전체화면 등)을 가림"
def sc_big_hold(pg, ex):  # 크게 보기 때만 가운데 꾹 누르기 2배속(위아래 버튼 줄은 비움)
    pg.get_by_role("button", name="크게 보기").last.click()
    pg.wait_for_function("document.querySelector('[data-stage]').getBoundingClientRect().width >= 600")
    st = _box(pg, "[data-stage]"); cv = _box(pg, "[data-stage-cover]")
    assert cv["y"] >= st["y"] + 50 and cv["y"] + cv["height"] <= st["y"] + st["height"] - 50, f"덮개가 위아래 버튼 줄을 가림: {st} {cv}"
    pg.mouse.move(cv["x"] + cv["width"] / 2, cv["y"] + cv["height"] / 2); pg.mouse.down(); pg.wait_for_timeout(600)
    ex(pg.locator("[data-stage]")).to_have_attribute("data-fast", "2")
    pg.mouse.up(); ex(pg.locator("[data-stage]")).to_have_attribute("data-fast", "0")
    assert pg.evaluate("window.__vnRate").pop() == 1, "속도 복귀 안 됨"
    pg.get_by_role("button", name="작게 보기").last.click()
    ex(pg.locator("[data-stage-cover]")).to_have_count(0)
def sc_space_input(pg, ex):
    pg.get_by_placeholder("무엇이든 요청하세요 (질문, 작성, 수정)").click(); pg.keyboard.down("Space"); pg.wait_for_timeout(600)
    ex(pg.locator("[data-stage]")).to_have_attribute("data-fast", "0"); pg.keyboard.up("Space")
    assert not pg.evaluate("window.__vnRate || []"), "입력창 포커스인데 속도가 바뀜"

def sc_real2x(pg, ex):  # --online: 실제 유튜브. 영상 클릭→재생, 스페이스 누르는 동안 2배, 유튜브 전체화면 버튼 동작
    st = _box(pg, "[data-stage]")
    pg.frame_locator("[data-stage] iframe").first.locator("video").wait_for(state="attached", timeout=30000)
    pg.mouse.click(st["x"] + st["width"] / 2, st["y"] + st["height"] / 2); pg.wait_for_timeout(4000)  # 광고·버퍼링 여유
    f = next(x for x in pg.frames if "youtube.com/embed" in x.url)
    t = lambda: f.evaluate("() => document.querySelector('video').currentTime")
    a = t(); pg.wait_for_timeout(3000); b = t()
    pg.keyboard.down("Space"); pg.wait_for_timeout(3000); c = t(); pg.keyboard.up("Space")
    pg.wait_for_timeout(500); rate = f.evaluate("() => document.querySelector('video').playbackRate")
    assert b - a > 2, f"영상 클릭으로 재생 안 됨: 3초 동안 {b - a:.2f}초"
    assert c - b > 1.6 * (b - a), f"2배속 안 됨(영상 클릭 뒤 스페이스): 1배속 {b - a:.2f}초 / 누르는 동안 {c - b:.2f}초"
    assert rate == 1, f"떼고 나서 속도 {rate}"
    pg.mouse.move(st["x"] + 20, st["y"] + 20); pg.wait_for_timeout(300)
    f.locator("button[aria-label='전체 화면 열기'], .ytp-fullscreen-button").first.click(timeout=5000); pg.wait_for_timeout(1000)
    assert pg.evaluate("document.fullscreenElement && document.fullscreenElement.tagName") == "IFRAME", "유튜브 전체화면 버튼이 안 먹음"

def sc_real_big(pg, ex):  # --online: 크게 보기에서 가운데 짧게 누르기=재생, 꾹=2배, 전체화면 버튼은 그대로
    pg.get_by_role("button", name="크게 보기").last.click()
    pg.wait_for_function("document.querySelector('[data-stage]').getBoundingClientRect().width >= 600")
    pg.frame_locator("[data-stage] iframe").first.locator("video").wait_for(state="attached", timeout=30000)
    cv = _box(pg, "[data-stage-cover]"); x, y = cv["x"] + cv["width"] / 2, cv["y"] + cv["height"] / 2
    pg.mouse.click(x, y); pg.wait_for_timeout(4000)
    f = next(x for x in pg.frames if "youtube.com/embed" in x.url)
    t = lambda: f.evaluate("() => document.querySelector('video').currentTime")
    a = t(); pg.wait_for_timeout(3000); b = t()
    pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(3000); c = t(); pg.mouse.up()
    pg.wait_for_timeout(500); rate = f.evaluate("() => document.querySelector('video').playbackRate")
    assert b - a > 2, f"가운데 클릭으로 재생 안 됨: 3초 동안 {b - a:.2f}초"
    assert c - b > 1.6 * (b - a), f"꾹 누르기 2배속 안 됨: 1배속 {b - a:.2f}초 / 누르는 동안 {c - b:.2f}초"
    assert rate == 1, f"떼고 나서 속도 {rate}"
    st = _box(pg, "[data-stage]"); pg.mouse.move(st["x"] + st["width"] - 30, st["y"] + st["height"] - 20); pg.wait_for_timeout(500)
    fb = f.locator("button[aria-label='전체 화면 열기'], .ytp-fullscreen-button").first
    fb.click(timeout=5000); pg.wait_for_timeout(1000)
    assert pg.evaluate("document.fullscreenElement && document.fullscreenElement.tagName") == "IFRAME", "크게 보기에서 전체화면 버튼이 안 먹음"


# ---- 릴리스 확장 기능 1묶음 (mimic/lilys-ext/spec.md A·B·C·D·E·G). 생성(POST)은 가짜 응답으로 바꿔 끼워 요청 내용만 확인 ----
def _exts_without(pg, drop):  # 시드 노트의 확장 결과 중 일부를 "아직 안 만든" 상태로 보이게
    def h(r):
        resp = r.fetch(); d = resp.json()
        for k in drop: d.pop(k, None)
        r.fulfill(response=resp, json=d)
    pg.route("**/api/notes/*/ext", h)
def _open_add(pg):
    pg.get_by_role("button", name="확장", exact=True).click()
    pg.get_by_role("button", name="확장 리포트 목록").click()
    pg.get_by_role("button", name="확장 리포트 추가").click()
    return pg.get_by_role("dialog", name="확장 리포트 추가")
def sc_add_modal(pg, ex):  # G: 칸 구성·기본 선택·이미 만든 것 흐림·☆로 추천↔즐겨찾기(새로고침 유지)
    dlg = _open_add(pg)
    for sec in ("추천", "더 깊이 이해하기", "시각자료", "이해 점검하기"):
        ex(dlg.locator(f"[data-sec='{sec}']")).to_have_count(1)
    ex(dlg.get_by_text("나만의 템플릿")).to_be_visible()
    ex(dlg.locator("[data-tpl='quote']").first).to_have_attribute("aria-pressed", "true")  # 영상 노트: 중요 인용구 미리 선택
    ex(dlg.get_by_role("button", name="1개 추가")).to_be_visible()
    ex(dlg.locator("[data-tpl='infographic']").first).to_be_disabled()  # 시드에 이미 있음
    dlg.locator("[data-tpl='quote']").first.click(); ex(dlg.get_by_role("button", name="추가", exact=True)).to_be_disabled()
    dlg.get_by_role("button", name="퀴즈 즐겨찾기").first.click()
    ex(dlg.locator("[data-sec='즐겨찾기']")).to_have_count(1); ex(dlg.locator("[data-sec='추천']")).to_have_count(0)
    pg.reload(); dlg = _open_add(pg)
    ex(dlg.locator("[data-sec='즐겨찾기']")).to_have_count(1)
    dlg.get_by_role("button", name="퀴즈 즐겨찾기").first.click()
    ex(dlg.locator("[data-sec='추천']")).to_have_count(1)
    dlg.get_by_role("button", name="접기").click(); ex(dlg.locator("[data-sec='그 외']")).to_have_count(0)
def sc_info_style(pg, ex):  # A: 인포그래픽 스타일 선택 → 만들기 요청에 style·extra → 결과 포스터가 그 스타일
    _exts_without(pg, ["infographic", "cartoon"])
    sent = []
    seed = json.loads((DATA / "media" / VIDEO / "ext_infographic.json").read_text(encoding="utf-8"))
    pg.route("**/api/notes/*/ext/infographic", lambda r: (sent.append(r.request.post_data_json), r.fulfill(json={**seed, "style": "handwriting"})))
    dlg = _open_add(pg)
    dlg.locator("[data-tpl='quote']").first.click(); dlg.locator("[data-tpl='infographic']").first.click(); dlg.get_by_role("button", name="1개 추가").click()
    sp = pg.get_by_role("dialog", name="인포그래픽 스타일 선택")
    ex(sp.get_by_role("radio")).to_have_count(6)
    ex(sp.get_by_role("radio", name="원페이저 한 페이지 요약")).to_have_attribute("aria-checked", "true")
    pg.screenshot(path=str(SHOTS / "info_style_picker.png"))
    sp.get_by_role("radio", name="손글씨 스케치/손그림").click()
    ex(sp.locator("[data-preview='handwriting'] [data-style='handwriting']")).to_be_visible()
    sp.get_by_role("button", name="취소").click(); ex(sp).to_have_count(0)
    assert not sent, "취소했는데 만들기 요청이 나감"
    _open_add(pg).locator("[data-tpl='infographic']").first.click()
    pg.get_by_role("dialog", name="확장 리포트 추가").locator("[data-tpl='quote']").first.click()
    pg.get_by_role("dialog", name="확장 리포트 추가").get_by_role("button", name="1개 추가").click()
    sp.get_by_role("radio", name="손글씨 스케치/손그림").click()
    sp.get_by_role("button", name="고급 설정").click(); sp.get_by_label("추가 프롬프트 (선택사항)").fill("밝은 색상 사용")
    sp.get_by_role("button", name="만들기").click()
    ex(pg.locator("[data-style='handwriting']").first).to_be_visible()
    assert sent and sent[-1] == {"style": "handwriting", "extra": "밝은 색상 사용"}, f"요청 내용: {sent}"
    assert "Gaegu" in pg.locator("[data-style='handwriting']").first.evaluate("e => getComputedStyle(e).fontFamily"), "손글씨 글꼴 아님"
def sc_toon_style(pg, ex):  # B: 만화 스타일 선택(6종·견본 그림) → 요청에 style
    _exts_without(pg, ["cartoon"])
    sent = []
    pg.route("**/api/notes/*/cartoon", lambda r: (sent.append(r.request.post_data_json), r.fulfill(json={"busy": False})) if r.request.method == "POST" else r.continue_())
    dlg = _open_add(pg)
    dlg.locator("[data-tpl='quote']").first.click(); dlg.locator("[data-tpl='cartoon']").first.click(); dlg.get_by_role("button", name="1개 추가").click()
    sp = pg.get_by_role("dialog", name="만화 스타일 선택")
    ex(sp.get_by_role("radio")).to_have_count(6)
    for k, label in (("webtoon", "웹툰 한국 웹툰"), ("chibi", "치비 귀여운 SD 캐릭터")):
        sp.get_by_role("radio", name=label).click()
        pg.wait_for_function("k => { const i = document.querySelector(`[data-preview='${k}'] img`); return i && i.complete && i.naturalWidth > 0 }", arg=k)
    pg.screenshot(path=str(SHOTS / "toon_style_picker.png"))
    sp.get_by_role("button", name="만들기").click()
    pg.wait_for_timeout(500)
    assert sent and sent[-1].get("style") == "chibi", f"요청 내용: {sent}"
def sc_web_src(pg, ex):  # C: 웹 출처 칩·삽화·웹 없음 안내
    def h(r):
        resp = r.fetch(); d = resp.json()
        d["background"] = {"kind": "md", "title": "관련 배경지식", "blocks": [{"heading": "시험 인물: 설명", "illust": "a person", "img": "s_0029.jpg",
                           "bullets": [{"text": "**시험** 문장", "refs": [0], "src": [{"url": "https://www.example.com/a", "title": "예시"}]}]}]}
        d["counter"] = {**d.get("counter", {"kind": "md", "title": "반대", "blocks": [{"heading": "h", "bullets": [{"text": "t", "refs": []}]}]}), "noweb": True}
        r.fulfill(response=resp, json=d)
    pg.route("**/api/notes/*/ext", h)
    pg.route("**/api/notes/*/ext/*/illust", lambda r: r.fulfill(json={"job": None}))
    pg.goto(pg.url.split("?")[0] + "?ext=background")
    a = pg.locator("a[data-src]").first
    ex(a).to_have_text("example.com"); ex(a).to_have_attribute("href", "https://www.example.com/a"); ex(a).to_have_attribute("target", "_blank")
    ex(pg.locator("img[data-illust]")).to_have_count(1)
    pg.screenshot(path=str(SHOTS / "web_sources.png"))
    pg.goto(pg.url.split("?")[0] + "?ext=counter")
    ex(pg.locator("[data-noweb]")).to_be_visible()
def sc_report_foot(pg, ex):  # D: 👍 저장(새로고침 유지)·↻ 확인 창·💡 확장 추천 3줄·컬렉션 지정·주소 ?ext= 유지
    sent = []
    pg.route("**/api/notes/*/ext/background", lambda r: (sent.append(r.request.url), r.fulfill(json={"kind": "md", "title": "배경지식 결과", "blocks": [{"heading": "h", "bullets": [{"text": "t", "refs": []}]}]})))
    pg.goto(pg.url.split("?")[0] + "?ext=action")
    foot = pg.locator("[data-foot]").last
    ex(foot).to_be_visible()
    foot.get_by_role("button", name="좋아요").click(); ex(foot.get_by_role("button", name="좋아요")).to_have_attribute("aria-pressed", "true")
    pg.wait_for_timeout(300); pg.reload()
    ex(pg.locator("[data-foot]").last.get_by_role("button", name="좋아요")).to_have_attribute("aria-pressed", "true")
    foot = pg.locator("[data-foot]").last
    foot.get_by_role("button", name="좋아요").click()  # 되돌림
    foot.get_by_role("button", name="다시 만들기").click()
    ex(pg.get_by_role("dialog", name="다시 만들기 확인")).to_be_visible()
    pg.get_by_role("dialog", name="다시 만들기 확인").get_by_role("button", name="취소").click()
    lines = foot.locator("h3:has-text('확장') ~ button")
    ex(lines).to_have_count(3)
    foot.get_by_role("button", name="컬렉션 지정").click(); ex(pg.get_by_role("button", name="인박스")).to_be_visible(); pg.keyboard.press("Escape")
    ex(pg.get_by_role("button", name="인박스")).to_have_count(0)
    pg.screenshot(path=str(SHOTS / "report_foot.png"))
    foot.get_by_role("button", name="관련 배경지식 심층 탐색").click()
    ex(pg.get_by_role("heading", name="배경지식 결과")).to_be_visible()
    assert sent, "추천 줄을 눌렀는데 생성 요청 없음"
    assert "ext=background" in pg.url, f"주소에 ?ext= 없음: {pg.url}"
def sc_mindmap_tools(pg, ex):  # E: ⓘ · 🗑(확인 후)
    if not (DATA / "media" / VIDEO / "mindmap_normal.md").exists():
        raise SkipCheck("캐시된 mindmap_normal.md 없음")
    pg.get_by_role("button", name="확장", exact=True).click()
    ex(pg.get_by_label("마인드맵 도움말")).to_be_visible()
    pg.get_by_role("button", name="마인드맵 삭제").click()
    ex(pg.get_by_text("이 상세도 마인드맵을 지울까요?")).to_be_visible()
    pg.get_by_role("button", name="취소").click()
    ex(pg.locator("svg g.markmap-node").first).to_be_visible()


# ---- 2묶음 (spec H·I·J): 글 템플릿 13개·댓글분석·표·스크립트·PPT ----
REST13 = ["스크립트", "타임스탬프", "교재", "보고서", "회의록", "사용자 인터뷰", "문헌검토", "투자 종목 분석", "투자 방법론", "논문 리뷰", "중요 인용구", "블로그", "말씀"]
def sc_more_tpls(pg, ex):  # H·I: 그 외 칸 릴리스 순서, 댓글분석은 유튜브 노트만, PPT는 시각자료에 NEW
    dlg = _open_add(pg)
    names = dlg.locator("[data-sec='그 외'] button[data-tpl]").all_inner_texts()
    assert [n.strip() for n in names[:13]] == REST13, f"그 외 순서: {names}"
    ex(dlg.locator("[data-sec='더 깊이 이해하기'] [data-tpl='comments']")).to_have_count(1)
    ex(dlg.locator("[data-sec='시각자료'] [data-tpl='ppt']")).to_contain_text("NEW")
def sc_article_tpls(pg, ex):  # 웹 글 노트: 댓글분석 없음, 추천=배경·심화조사·반대 시각·인포그래픽
    dlg = _open_add(pg)
    ex(dlg.locator("[data-tpl='comments']")).to_have_count(0)
    assert [t.strip() for t in dlg.locator("[data-sec='추천'] button[data-tpl]").all_inner_texts()] == ["관련 배경지식", "심화조사", "반대 시각 조사", "인포그래픽"]
    ex(dlg.get_by_role("button", name="추가", exact=True)).to_be_disabled()  # 웹 글은 기본 선택 없음
def sc_script_table(pg, ex):  # 스크립트(AI 없이 실제 생성) + 표 그리기
    def h(r):
        resp = r.fetch(); d = resp.json(); d.pop("script", None)
        d["stock"] = {"kind": "md", "title": "투자 종목 분석", "blocks": [{"heading": "표", "table": {"cols": ["종목", "근거", "리스크"], "rows": [["A사", "실적", "환율"], ["B사", "수주", "금리"]]}, "bullets": []}]}
        r.fulfill(response=resp, json=d)
    pg.route("**/api/notes/*/ext", h)
    pg.goto(pg.url.split("?")[0] + "?ext=stock")
    ex(pg.locator("table[data-table] th")).to_have_count(3); ex(pg.locator("table[data-table] tbody tr")).to_have_count(2)
    dlg = _open_add(pg)
    dlg.locator("[data-tpl='quote']").first.click(); dlg.locator("[data-tpl='script']").first.click(); dlg.get_by_role("button", name="1개 추가").click()
    ex(pg.get_by_role("heading", name="00:00")).to_be_visible()
DECK = {"kind": "ppt", "title": "시험 덱", "style": "cobalt", "accent": "", "slides": [
    {"layout": "cover", "title": "표지 제목", "subtitle": "부제", "points": [], "stat": "", "quote": "", "ref": None},
    {"layout": "two", "title": "비교", "subtitle": "", "points": [], "stat": "", "quote": "", "ref": None, "left": {"head": "전", "points": ["a"]}, "right": {"head": "후", "points": ["b"]}},
    {"layout": "closing", "title": "마무리", "subtitle": "", "points": ["행동 1"], "stat": "", "quote": "", "ref": None}]}
def sc_ppt(pg, ex):  # J: 만들기 창(9종·2~30장·지시) → 요청 → 카드·슬라이드쇼·장별 수정
    sent = []
    pg.route("**/api/notes/*/ppt", lambda r: (sent.append(r.request.post_data_json), r.fulfill(json=DECK)) if r.request.method == "POST" else r.continue_())
    pg.route("**/api/notes/*/ppt/revise", lambda r: (sent.append(r.request.post_data_json), r.fulfill(json={**DECK, "slides": [DECK["slides"][0], {**DECK["slides"][1], "title": "고친 비교"}, DECK["slides"][2]]})))
    dlg = _open_add(pg)
    dlg.locator("[data-tpl='quote']").first.click(); dlg.locator("[data-tpl='ppt']").first.click(); dlg.get_by_role("button", name="1개 추가").click()
    sp = pg.get_by_role("dialog", name="PPT 만들기")
    ex(sp.get_by_role("radio")).to_have_count(9)
    ex(sp.locator("[data-count]")).to_have_text("5")
    sp.get_by_role("button", name="한 장 빼기").click(); ex(sp.locator("[data-count]")).to_have_text("4")
    sp.get_by_role("radio", name="코발트").click(); sp.get_by_label("커스텀 지시").fill("숫자 위주로")
    pg.screenshot(path=str(SHOTS / "ppt_picker.png"))
    sp.get_by_role("button", name="만들기").click()
    ex(pg.locator("[data-ppt] [data-slide]")).to_have_count(3)
    assert sent[-1] == {"style": "cobalt", "count": 4, "extra": "숫자 위주로"}, sent
    pg.screenshot(path=str(SHOTS / "ppt_deck.png"))
    pg.get_by_role("button", name="슬라이드쇼").click()
    show = pg.get_by_role("dialog", name="슬라이드쇼")
    ex(show.locator("[data-pos]")).to_have_text("1 / 3"); pg.keyboard.press("ArrowRight"); ex(show.locator("[data-pos]")).to_have_text("2 / 3")
    pg.keyboard.press("Escape"); ex(show).to_have_count(0)
    pg.locator("[data-slide='1']").hover(); pg.get_by_role("button", name="2번 슬라이드 수정").click()
    ed = pg.get_by_role("dialog", name="슬라이드 수정")
    ex(ed.get_by_role("button", name="수정본 생성")).to_be_disabled()
    ed.get_by_label("2번 슬라이드 변경").fill("색을 파랗게"); ex(ed.get_by_text("변경할 슬라이드 1개")).to_be_visible()
    pg.screenshot(path=str(SHOTS / "ppt_edit.png"))
    ed.get_by_role("button", name="수정본 생성").click()
    ex(pg.locator("[data-ppt]")).to_contain_text("고친 비교")
    assert sent[-1] == {"changes": {"1": "색을 파랗게"}}, sent
    ex(pg.get_by_role("link", name="PPTX 다운로드")).to_have_attribute("href", re.compile(r"/ppt\.pptx$"))


# ---- 3묶음 (spec K·L·M): 팟캐스트·애니메이션·요약 화면(도식·미니 목차·요점 접기·용어 질문하기) ----
SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><rect width="600" height="450" fill="#f7f7f5"/><text x="300" y="50" text-anchor="middle" font-size="28">흐름</text><circle cx="100" cy="200" r="10" fill="#6663fd"><animate attributeName="cx" values="100;500;100" dur="2s" repeatCount="indefinite"/></circle></svg>'
POD = {"kind": "podcast", "title": "시험 에피소드", "host": {"name": "김민준", "role": "AI 기술 해설가"},
       "paras": [{"text": f"문단 {i} **핵심**", "list": ["주제: 설명"] if i == 1 else [], "refs": [0]} for i in range(5)]}
def _inject(pg, extra):
    def h(r):
        resp = r.fetch(); d = resp.json(); d.update(extra); r.fulfill(response=resp, json=d)
    pg.route("**/api/notes/*/ext", h)
def sc_podcast(pg, ex):  # K: 해설자 말풍선 문단 + 음성 만들기 → 듣기 → 읽는 문단 강조
    _inject(pg, {"podcast": POD})
    st = {"ready": []}
    pg.route("**/api/notes/*/podcast/audio", lambda r: (st.update(ready=[[i, f"p_{i}.mp3"] for i in range(5)]), r.fulfill(json={"done": 5, "total": 5, "busy": False, "err": None})) if r.request.method == "POST" else r.fulfill(json={"job": None, "ready": st["ready"]}))
    pg.route("**/media/*/podcast/*.mp3", lambda r: r.fulfill(status=200, content_type="audio/mpeg", body=b""))
    pg.goto(pg.url.split("?")[0] + "?ext=podcast")
    ex(pg.locator("[data-podcast] [data-para]")).to_have_count(5)
    ex(pg.locator("[data-podcast]").get_by_text("김민준").first).to_be_visible(); ex(pg.locator("[data-podcast]").get_by_text("AI 기술 해설가").first).to_be_visible()
    pg.get_by_role("button", name="음성으로 듣기").click()
    pg.get_by_role("button", name="듣기", exact=True).click()
    ex(pg.locator("[data-para='0']")).to_have_class(re.compile("bg-hl"))
    pg.screenshot(path=str(SHOTS / "podcast.png"))
def sc_animation(pg, ex):  # L: 쉬운 말 리포트 + 소제목마다 움직이는 SVG(<img>로)
    _inject(pg, {"animation": {"kind": "anim", "title": "애니메이션 시험", "intro": "도입 문장", "blocks": [{"heading": f"{i}. 소제목", "bullets": [{"text": "쉬운 설명", "refs": [0]}], "svg": SVG} for i in (1, 2, 3)]}})
    pg.goto(pg.url.split("?")[0] + "?ext=animation")
    ex(pg.locator("img[data-anim-svg]")).to_have_count(3)
    pg.wait_for_function("() => [...document.querySelectorAll('img[data-anim-svg]')].every(i => i.complete && i.naturalWidth > 0)")
    pg.screenshot(path=str(SHOTS / "animation.png"))
def sc_summary_bits(pg, ex):  # M
    pg.route("**/api/notes/*/diagram", lambda r: r.fulfill(json={"svg": SVG}) if r.request.method == "GET" else r.abort())
    pg.reload()
    ex(pg.locator("img[data-diagram]")).to_be_visible()
    rail = pg.locator("[data-rail]"); ex(rail).to_be_visible(); rail.hover(); ex(pg.locator("[data-rail-pop]")).to_be_visible()
    pg.screenshot(path=str(SHOTS / "summary_rail.png"))
    pg.mouse.move(700, 600)
    kp = pg.locator("[data-report] ul").first; n0 = pg.locator("[data-report] ul").count()
    pg.get_by_role("button", name="핵심 요점 접기").click(); ex(pg.get_by_role("button", name="핵심 요점 펼치기")).to_be_visible()
    assert pg.locator("[data-report] ul").count() == n0 - 1, "요점 목록이 안 접힘"
    pg.get_by_role("button", name="핵심 요점 펼치기").click()
    t = pg.locator("[data-term]").first
    if t.count():
        name = t.inner_text(); t.hover()
        pg.get_by_label(f"{name} 질문하기").fill("예를 들어줘"); pg.keyboard.press("Enter")
        ex(pg.get_by_placeholder("무엇이든 요청하세요 (질문, 작성, 수정)")).to_have_value(re.compile(re.escape(name)))


def _no_hscroll(pg, dlg, what):
    w = dlg.evaluate("e => [e.scrollWidth, e.clientWidth, e.getBoundingClientRect().right, innerWidth]")
    assert w[0] <= w[1] + 1 and w[2] <= w[3] + 1, f"{what} 가로 넘침: {w}"
def sc_narrow_modals(pg, ex):  # 작은 창(1000px 미만은 확장 탭이 탭 전환): 추가 창·스타일 창·PPT 창이 화면 안에, 가로 넘침 없음
    _exts_without(pg, ["infographic"])
    pg.get_by_role("button", name="확장", exact=True).first.click()
    pg.get_by_role("button", name="확장 리포트 목록").click(); pg.get_by_role("button", name="확장 리포트 추가").click()
    dlg = pg.get_by_role("dialog", name="확장 리포트 추가"); _no_hscroll(pg, dlg, "추가 창")
    pg.screenshot(path=str(SHOTS / "narrow_add.png"))
    dlg.locator("[data-tpl='quote']").first.click(); dlg.locator("[data-tpl='infographic']").first.click(); dlg.locator("[data-tpl='ppt']").first.click()
    dlg.get_by_role("button", name="2개 추가").click()
    sp = pg.get_by_role("dialog", name="인포그래픽 스타일 선택"); _no_hscroll(pg, sp, "스타일 창")
    ex(sp.get_by_role("button", name="만들기")).to_be_in_viewport()
    pg.screenshot(path=str(SHOTS / "narrow_style.png"))
    sp.get_by_role("button", name="취소").click()
    pp = pg.get_by_role("dialog", name="PPT 만들기"); _no_hscroll(pg, pp, "PPT 창")
    ex(pp.get_by_role("button", name="만들기")).to_be_in_viewport()
    pg.screenshot(path=str(SHOTS / "narrow_ppt.png"))


# ---- 독립 검사(2026-10-13)에서 찾은 버그 재발 방지 ----
def sc_inspector_fixes(pg, ex):
    base = pg.url.split("/note/")[0]
    r = pg.request.delete(f"{base}/api/notes/{VIDEO}/ext/..%5C..%5Cx")
    assert r.status == 400, f"폴더 밖 경로 키가 거부되지 않음: {r.status}"
    foot = pg.locator("[data-report] [data-foot]").last  # 요약 아래: 이미 만든 액션아이템은 추천에서 빠짐
    ex(foot.get_by_role("button", name="중요 인용구 한눈에 보기")).to_have_count(1)
    ex(foot.get_by_role("button", name="바로 적용할 수 있는 액션 아이템 도출")).to_have_count(0)
    ex(pg.locator("[data-diagram-fail]")).to_be_visible()  # verify는 도식 생성(POST)을 막음 → 실패 표시 + 다시 시도
    pg.get_by_role("button", name="확장", exact=True).first.click()
    pg.get_by_role("button", name="확장 리포트 목록").click(); pg.get_by_role("button", name="확장 리포트 추가").click()
    ex(pg.get_by_role("dialog", name="확장 리포트 추가")).to_be_visible(); pg.keyboard.press("Escape")
    ex(pg.get_by_role("dialog", name="확장 리포트 추가")).to_have_count(0)
    pg.goto(pg.url.split("?")[0] + "?ext=action")
    pg.locator("[data-foot]").last.get_by_role("button", name="다시 만들기").click()
    d = pg.get_by_role("dialog", name="다시 만들기 확인"); ex(d.get_by_role("button", name="다시 만들기")).to_be_focused()
    pg.keyboard.press("Escape"); ex(d).to_have_count(0)


ONLINE = "--online" in sys.argv
APP = "--app" in sys.argv  # 실제 앱 창(WebView2) 검사  # 실제 유튜브 접속이 필요한 시험(인터넷 상태에 따라 실패할 수 있어 기본에서 뺌)

SCENARIOS = [
    ("home", "/", 1440, False, sc_home),
    ("library", "/library", 1440, False, sc_library),
    ("trash", "/library", 1440, False, sc_trash),
    ("subscriptions", "/subscriptions", 1440, False, sc_subs),
    ("home_390", "/", 390, False, lambda pg, ex: ex(pg.locator("[data-card]").first).to_be_visible()),
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
    ("player_hold2x", f"/note/{VIDEO}", 1440, False, sc_hold2x),
    ("player_big_hold", f"/note/{VIDEO}", 1440, False, sc_big_hold),
    ("player_space_input", f"/note/{VIDEO}", 1440, False, sc_space_input),
    ("ext_add_modal", f"/note/{VIDEO}", 1440, False, sc_add_modal),
    ("ext_info_style", f"/note/{VIDEO}", 1440, False, sc_info_style),
    ("ext_toon_style", f"/note/{VIDEO}", 1440, False, sc_toon_style),
    ("ext_web_src", f"/note/{VIDEO}", 1440, False, sc_web_src),
    ("ext_report_foot", f"/note/{VIDEO}", 1440, False, sc_report_foot),
    ("ext_mindmap_tools", f"/note/{VIDEO}", 1440, False, sc_mindmap_tools),
    ("ext_more_tpls", f"/note/{VIDEO}", 1440, False, sc_more_tpls),
    ("ext_article_tpls", f"/note/{ARTICLE}", 1440, False, sc_article_tpls),
    ("ext_script_table", f"/note/{VIDEO}", 1440, False, sc_script_table),
    ("ext_ppt", f"/note/{VIDEO}", 1440, False, sc_ppt),
    ("ext_podcast", f"/note/{VIDEO}", 1440, False, sc_podcast),
    ("ext_animation", f"/note/{VIDEO}", 1440, False, sc_animation),
    ("summary_bits", f"/note/{VIDEO}", 1440, False, sc_summary_bits),
    ("ext_narrow_390", f"/note/{VIDEO}", 390, False, sc_narrow_modals),
    ("inspector_fixes", f"/note/{VIDEO}", 1440, False, sc_inspector_fixes),
] + ([("player_real_2x", f"/note/{VIDEO}", 1440, False, sc_real2x), ("player_real_big", f"/note/{VIDEO}", 1440, False, sc_real_big)] if ONLINE else [])


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

            def route(r, *, blocked=blocked, online=name.startswith("player_real")):  # 키워드 전용: Playwright가 2번째 인자로 request를 넘김
                u = urlparse(r.request.url)
                if u.hostname != "127.0.0.1" and not online:
                    return r.abort()  # 외부(유튜브 등) 차단 → 결정적
                if u.path.startswith("/api/") and r.request.method == "PUT" and u.path.endswith(("/feedback/report_default", "/feedback/action")):
                    return r.continue_()  # 👍👎 저장 시험(시험용 복사 데이터에만 씀)
                if (r.request.method == "DELETE" and re.fullmatch(r"/api/notes/[\w-]+", u.path) and "forever" not in (u.query or "")) or (r.request.method == "POST" and u.path.endswith("/restore")):
                    return r.continue_()  # 휴지통으로 옮기기·복원(시험용 복사 데이터, 되돌릴 수 있음)
                if r.request.method == "POST" and u.path.endswith("/ext/script"):
                    return r.continue_()  # 스크립트는 AI 없이 대본을 묶기만 함
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
    for m in ("files", "scenes", "transcript", "ppt", "podcast"):
        step(f"backend:{m}", self_check(m))
    step("backend:import", lambda: sh([sys.executable, "-c", "import app.main"], ROOT / "backend", env_data()))
    srv = None
    if all(ok for n, ok, _ in results if n in ("seed", "web:build")):
        def go():
            nonlocal srv
            srv, base = start_server()
            run_ui(base)
            def storage():  # F: 앱(pywebview)을 다시 켜도 ☆·크게 보기 등 localStorage 유지 — app.pyw 옵션 확인(실제 창 확인은 --app)
                src = (ROOT / "app.pyw").read_text(encoding="utf-8")
                assert "private_mode=False" in src and 'storage_path=str(ROOT / "data" / "webview")' in src, "app.pyw가 사생활 모드(재시작 때 설정 삭제)"
            step("desktop:storage", storage)
            if APP and WIN:  # --app: 실제 앱과 같은 WebView2 창을 두 번 띄워 스타일 창·PPT 창·재시작 후 ☆ 유지 확인(보이는 창, 마우스·키보드 안 씀)
                def app_window():
                    st, stop = V / "webview-app", V / "app.stop"
                    shutil.rmtree(st, ignore_errors=True); stop.unlink(missing_ok=True)
                    for phase in ("1", "2"):
                        w = subprocess.Popen([sys.executable, str(ROOT / "verify" / "app_window.py"), base + "/note/FlKHoxHe2O0-1791460989", str(st), str(stop)])
                        try:
                            for _ in range(40):
                                try: urllib.request.urlopen("http://127.0.0.1:9333/json/version", timeout=1); break
                                except OSError: time.sleep(1)
                            r = subprocess.run([sys.executable, str(ROOT / "verify" / "app_check.py"), phase, str(SHOTS / "app")], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
                            assert r.returncode == 0, (r.stdout + r.stderr)[-400:]
                        finally:
                            stop.touch(); w.wait(30); stop.unlink(missing_ok=True)  # 우리가 띄운 창만 닫음
                        time.sleep(2)
                step("app:window", app_window)
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
