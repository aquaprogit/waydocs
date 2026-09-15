# Runs the web app in the foreground on http://localhost:5183 (Ctrl+C to stop). Requires start-api.ps1 running
# separately — vite proxies /api to http://localhost:5180 (see web/vite.config.ts).
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location (Join-Path $repo 'web')
if (-not (Test-Path 'node_modules')) { npm install }
npm run dev
