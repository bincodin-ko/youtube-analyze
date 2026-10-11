"""영상노트 데스크톱 창 — 서버를 이 프로세스 안에서 띄우고 전용 창(pywebview)으로 연다. 창을 닫으면 서버도 꺼짐.
실행: backend\\.venv\\Scripts\\pythonw.exe app.pyw   (install.bat이 바탕화면 바로가기를 만든다)
"""
import os, socket, sys, threading, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "backend"))
(ROOT / "data").mkdir(exist_ok=True)
if sys.stdout is None:  # pythonw는 콘솔이 없어 로그를 파일로
    sys.stdout = sys.stderr = open(ROOT / "data" / "app.log", "a", encoding="utf-8", buffering=1)
PORTS = range(8765, 8776)
ICON = ROOT / "app.ico"


def running_port():
    """이미 떠 있는 영상노트(start.bat 등)가 있으면 그 포트"""
    for p in PORTS:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{p}/api/notes", timeout=1) as r:
                if r.read(1) == b"[":
                    return p
        except Exception:
            pass


def free_port():
    for p in PORTS:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)):
                return p
    raise SystemExit("8765~8775 포트가 모두 사용 중이에요")


def make_icon():
    """로고(web/src/components/ui.tsx Logo)와 같은 모양의 app.ico"""
    from PIL import Image, ImageDraw
    s = 256
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = s / 32
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=9 * k, fill="#0c0d08")
    d.polygon([(9 * k, 8.5 * k), (9 * k, 16.5 * k), (15.5 * k, 12.5 * k)], fill="#ffffff")
    for x, y, w in [(9, 19, 14), (9, 23, 9), (18, 10.5, 5)]:
        d.rounded_rectangle([x * k, y * k, (x + w) * k, (y + 2) * k], radius=k, fill="#ffffff")
    d.ellipse([22 * k, 4 * k, 27 * k, 9 * k], fill="#dfff32")  # 라임 점 하나(작은 크기에서도 구분되게)
    im.save(ICON, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


# 서버가 뜰 때까지 먼저 보여 줄 로딩 화면(앱 색 토큰과 같은 색, 다크 모드 대응)
LOADING = """<!doctype html><meta charset="utf-8"><style>
:root{--bg:#f4f5f4;--fg:#0c0d08;--muted:#9fa28e;--accent:#dfff32}
@media (prefers-color-scheme:dark){:root{--bg:#111210;--fg:#ecede6;--muted:#8a8d7a}}
html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font-family:Pretendard,"Malgun Gothic",system-ui,sans-serif}
body{display:grid;place-items:center}.box{text-align:center}
.logo{width:64px;height:64px;border-radius:18px;background:var(--fg);margin:0 auto;position:relative}
.logo:after{content:"";position:absolute;right:8px;top:8px;width:10px;height:10px;border-radius:50%;background:var(--accent)}
.logo i{position:absolute;left:18px;top:17px;border-left:14px solid var(--bg);border-top:9px solid transparent;border-bottom:9px solid transparent}
h1{font-size:20px;font-weight:700;margin:24px 0 8px}p{font-size:14px;color:var(--muted);margin:0}
.bar{width:180px;height:4px;border-radius:2px;background:color-mix(in srgb,var(--muted) 25%,transparent);margin:28px auto 0;overflow:hidden}
.bar b{display:block;width:40%;height:100%;border-radius:2px;background:var(--fg);animation:m 1.2s ease-in-out infinite}
@keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
@media (prefers-reduced-motion:reduce){.bar b{animation:none;width:100%}}
</style><div class="box"><div class="logo"><i></i></div><h1>영상노트</h1><p id="t">프로그램을 준비하고 있어요…</p><div class="bar"><b></b></div></div>"""


def start_server(window):
    """창이 뜬 뒤 백그라운드에서 서버를 띄우고, 준비되면 앱 화면으로 바꾼다"""
    port = running_port()
    if port is None:
        try:
            import uvicorn
            from app.main import app  # 무거운 import(음성인식 등)라 여기서
            port = free_port()
            server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
            threading.Thread(target=server.run, daemon=True).start()
            for _ in range(600):  # 최대 60초
                if running_port() == port:
                    break
                time.sleep(0.1)
            else:
                raise RuntimeError("서버가 60초 안에 켜지지 않았어요")
        except Exception as e:
            print("시작 실패:", repr(e))
            window.evaluate_js(f"document.getElementById('t').textContent={str('켜지 못했어요: ' + str(e) + ' (data/app.log 참고)')!r}")
            return
    window.load_url(f"http://127.0.0.1:{port}")


def main():
    if not ICON.exists():
        make_icon()
    import webview
    try:  # 작업 표시줄에 python 대신 영상노트 아이콘
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("YeongsangNote.App")
    except Exception:
        pass
    # text_select=True: pywebview 기본값(False)은 글자 선택·복사를 막는다
    w = webview.create_window("영상노트", html=LOADING, width=1440, height=900, min_size=(900, 600), background_color="#f4f5f4", text_select=True)
    webview.start(start_server, w, icon=str(ICON))


def install_shortcut():
    """바탕화면에 '영상노트' 바로가기(pythonw로 app.pyw 실행, app.ico)"""
    import subprocess
    if not ICON.exists():
        make_icon()
    pyw = ROOT / "backend" / ".venv" / "Scripts" / "pythonw.exe"
    ps = ("$d=[Environment]::GetFolderPath('Desktop');"
          "$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d '영상노트.lnk'));"
          f"$s.TargetPath='{pyw}';$s.Arguments='\"{ROOT / 'app.pyw'}\"';$s.WorkingDirectory='{ROOT}';"
          f"$s.IconLocation='{ICON}';$s.Description='영상노트';$s.Save();Join-Path $d '영상노트.lnk'")
    print(subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, encoding="utf-8").stdout.strip())


if __name__ == "__main__":
    if "--install" in sys.argv:
        install_shortcut()
    else:
        main()
