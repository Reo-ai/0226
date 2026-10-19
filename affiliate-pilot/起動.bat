@echo off
rem Windows用: ダブルクリックで Affiliate Pilot AI を起動します
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ja から LTS 版をインストールしてから、もう一度開いてください。
  pause
  exit /b 1
)
node scripts\start.mjs
pause
