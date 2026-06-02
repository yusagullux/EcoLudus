Write-Host "This script will clean the project, install dependencies, and start the dev server." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to cancel at any time." -ForegroundColor Yellow

# Confirm
$confirm = Read-Host "Continue? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
  Write-Host "Aborted." -ForegroundColor Red
  exit 1
}

Write-Host "Removing .next, node_modules, and package-lock.json (if they exist)..." -ForegroundColor Cyan
if (Test-Path -Path ".next") { Remove-Item -Recurse -Force .next }
if (Test-Path -Path "node_modules") { Remove-Item -Recurse -Force node_modules }
if (Test-Path -Path "package-lock.json") { Remove-Item -Force package-lock.json }

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
  Write-Host "npm install failed. See output above." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Starting dev server..." -ForegroundColor Cyan
npm run dev
