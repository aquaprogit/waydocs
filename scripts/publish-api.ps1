# Publishes the API (with the web UI bundled in as static files) as a self-contained single-file executable
# (no .NET install required to run it) into mcp/bin/<rid>/, where mcp/src/index.ts looks for it before falling
# back to a `waydocs-api` on PATH or `dotnet run` from source. Only win-x64 is buildable/testable from this
# machine; linux-x64/osx-x64/osx-arm64 need the same command run on (or cross-published for) those platforms.
param(
    [string]$Rid = 'win-x64',
    [switch]$SkipWebBuild
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$apiProject = Join-Path $repo 'server\Waydocs.Api'
$wwwroot = Join-Path $apiProject 'wwwroot'
$out = Join-Path $repo "mcp\bin\$Rid"

if (-not $SkipWebBuild) {
    Push-Location (Join-Path $repo 'web')
    try {
        if (-not (Test-Path 'node_modules')) { npm install }
        npm run build
    } finally {
        Pop-Location
    }
    if (Test-Path $wwwroot) { Remove-Item $wwwroot -Recurse -Force }
    Copy-Item (Join-Path $repo 'web\dist') $wwwroot -Recurse
}

dotnet publish $apiProject `
    -c Release `
    -r $Rid `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $out

Write-Host "Published to $out"
