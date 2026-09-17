# Publishes the API as a self-contained single-file executable (no .NET install required to run it) into
# mcp/bin/<rid>/, where mcp/src/index.ts looks for it before falling back to a `waydocs-api` on PATH or
# `dotnet run` from source. Only win-x64 is buildable/testable from this machine; linux-x64/osx-x64/osx-arm64
# need the same command run on (or cross-published for) those platforms.
param(
    [string]$Rid = 'win-x64'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out = Join-Path $repo "mcp\bin\$Rid"

dotnet publish (Join-Path $repo 'server\Waydocs.Api') `
    -c Release `
    -r $Rid `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $out

Write-Host "Published to $out"
