@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/3] 파이썬 패키지 설치 확인
uv sync --project backend || (echo uv가 필요합니다: winget install astral-sh.uv & pause & exit /b 1)
echo [2/3] 화면 빌드
if not exist web\dist (
  pushd web
  call npm install || exit /b 1
  call npm run build || exit /b 1
  popd
)
echo [3/3] 아이콘과 바탕화면 바로가기 만들기
backend\.venv\Scripts\python.exe app.pyw --install || (pause & exit /b 1)
echo.
echo 설치 끝. 바탕화면의 "영상노트" 아이콘을 더블클릭하세요.
echo 지우려면 바탕화면의 영상노트 아이콘만 삭제하면 됩니다. 노트 데이터는 data 폴더에 그대로 남습니다.
pause
