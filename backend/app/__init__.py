import os
import subprocess

# 데스크톱 앱(pythonw)에서 claude·ffmpeg·ComfyUI 등을 부를 때 검은 콘솔 창이 깜박이지 않게.
# 모든 subprocess.run/Popen이 여기를 지나므로 한 곳에서 막는다(Windows 전용).
if os.name == "nt":
    _init = subprocess.Popen.__init__

    def _no_window(self, *a, **k):
        k["creationflags"] = k.get("creationflags", 0) | subprocess.CREATE_NO_WINDOW
        _init(self, *a, **k)

    subprocess.Popen.__init__ = _no_window
