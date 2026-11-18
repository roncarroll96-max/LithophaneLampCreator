@echo off
rem Starts the Lithophane Lamp Creator on this PC and opens it in your browser.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it free from https://nodejs.org and run this again.
  pause
  exit /b 1
)
start "" http://localhost:5178
node server.js
