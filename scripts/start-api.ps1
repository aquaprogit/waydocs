# Runs the Waydocs API in the foreground on http://localhost:5180 (Ctrl+C to stop).
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location (Join-Path $repo 'server\Waydocs.Api')
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --urls http://localhost:5180
