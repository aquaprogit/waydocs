# Rebuilds the MCP server after editing mcp/src — Claude Code loads mcp/dist/index.js at session start, so a
# session must be restarted to pick up a fresh build.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location (Join-Path $repo 'mcp')
if (-not (Test-Path 'node_modules')) { npm install }
npm run build
