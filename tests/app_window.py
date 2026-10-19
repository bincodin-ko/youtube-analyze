# 시험 --app 보조: 실제 앱과 같은 WebView2 창(app.pyw 옵션: private_mode=False + storage_path)을 띄우고, stop 파일이 생기면 닫는다. CDP 9333으로 검사(보이는 창, 마우스·키보드 안 씀).
import os, sys, time, webview
url, store, stop = sys.argv[1:4]
os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--remote-debugging-port=9333"
def wait(w):
    while not os.path.exists(stop): time.sleep(0.3)
    w.destroy()
w = webview.create_window("영상노트 시험", url, width=1440, height=900)
webview.start(wait, w, private_mode=False, storage_path=store)
