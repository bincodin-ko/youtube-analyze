@echo off
rem Video-note headless verify: build, lint, backend self-checks, UI scenarios -> .verify\summary.md (exit 1 on fail)
chcp 65001 >nul
cd /d "%~dp0"
uv run --project backend python verify/run.py %*
exit /b %errorlevel%
