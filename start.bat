@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist web\dist (
  pushd web
  call npm install || exit /b 1
  call npm run build || exit /b 1
  popd
)
rem 이미 영상노트가 떠 있으면 브라우저만 연다
for /l %%p in (8765,1,8775) do (
  curl -s -m 2 http://127.0.0.1:%%p/api/notes >nul 2>&1 && curl -s -m 2 http://127.0.0.1:%%p/api/notes | findstr /b "[" >nul && (start http://127.0.0.1:%%p & exit /b 0)
)
rem 다른 프로그램이 쓰는 포트는 건너뛰고 빈 포트를 고른다
set PORT=
for /l %%p in (8765,1,8775) do (
  if not defined PORT (
    netstat -ano | findstr /r /c:"127.0.0.1:%%p .*LISTENING" /c:"0.0.0.0:%%p .*LISTENING" >nul || set PORT=%%p
  )
)
if not defined PORT (echo 8765~8775 포트가 모두 사용 중입니다. & pause & exit /b 1)
echo 영상노트: http://127.0.0.1:%PORT%
start "" cmd /c "timeout /t 4 >nul && start http://127.0.0.1:%PORT%"
uv run --project backend uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port %PORT%
pause
