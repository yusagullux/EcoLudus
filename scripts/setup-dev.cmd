@echo off
echo This script will clean the project, install dependencies, and start the dev server.
set /p confirm=Continue? (y/N):
if /I "%confirm%" NEQ "y" (
  echo Aborted.
  exit /b 1
)

if exist .next rmdir /s /q .next
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo Installing dependencies...
npm install
if errorlevel 1 (
  echo npm install failed.
  exit /b %ERRORLEVEL%
)

echo Starting dev server...
npm run dev
