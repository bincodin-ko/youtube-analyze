"""verify 보조: 숨긴 pywebview 창으로 localStorage가 앱 재시작 뒤에도 남는지 확인 (app.pyw와 같은 옵션).
사용: python webview_storage.py set|get <url> <저장 폴더>  → 값(get) 또는 None 출력, 창을 못 띄우면 ERR
앞 창의 WebView2가 저장 폴더를 몇 초 더 잡고 있으면 실패하므로 부르는 쪽(run.py)이 다시 시도한다."""
import os
import sys
import webview

mode, url, path = sys.argv[1:4]
out = {}


def go(w):
    try:
        if mode == "set": w.evaluate_js("localStorage.setItem('vnProbe', 'ok')")
        else: out["v"] = w.evaluate_js("localStorage.getItem('vnProbe')")
    except Exception as e:
        out["v"] = f"ERR {e}"
    finally:
        try: w.destroy()
        except Exception: pass


w = webview.create_window("verify", url, hidden=True)
webview.start(go, w, private_mode=False, storage_path=path)
print(out.get("v"), flush=True)
os._exit(0)  # WebView2 정리 대기로 멈추지 않게
