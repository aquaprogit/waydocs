#!/usr/bin/env node
// npm postinstall: fetches the self-contained waydocs-api binary for this platform from the matching
// GitHub Release (built by .github/workflows/publish-api.yml) into mcp/bin/<rid>/, so `npm install -g
// waydocs-mcp` needs no .NET install. Never fails the install — a missing/failed binary just means
// mcp/src/index.ts's clear runtime error fires later instead of npm install aborting.
import { createWriteStream, existsSync, mkdirSync, chmodSync, rmSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = createRequire(import.meta.url)('../package.json')

const REPO = 'aquaprogit/waydocs'

function currentRid() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  if (process.platform === 'win32') return `win-${arch}`
  if (process.platform === 'darwin') return `osx-${arch}`
  if (process.platform === 'linux') return `linux-${arch}`
  return null
}

function warn(msg) {
  console.warn(`[waydocs] ${msg}`)
}

async function main() {
  // Inside this monorepo's own checkout, dev uses scripts/publish-api.ps1 or mcp/src/index.ts's `dotnet run`
  // fallback — never a downloaded release asset.
  const apiProject = path.resolve(__dirname, '..', '..', 'server', 'Waydocs.Api')
  if (existsSync(apiProject)) {
    console.log('[waydocs] source repo detected, skipping API binary download')
    return
  }

  if (process.env.WAYDOCS_SKIP_API_DOWNLOAD) {
    console.log('[waydocs] WAYDOCS_SKIP_API_DOWNLOAD set, skipping API binary download')
    return
  }

  const rid = currentRid()
  if (!rid) {
    warn(`unsupported platform ${process.platform}/${process.arch} — no prebuilt API binary. MCP calls will ` +
      'fail until you build server/Waydocs.Api yourself and place it under mcp/bin/<rid>/ — see README.')
    return
  }

  const exeName = rid.startsWith('win') ? 'waydocs-api.exe' : 'waydocs-api'
  const destDir = path.resolve(__dirname, '..', 'bin', rid)
  const exePath = path.join(destDir, exeName)
  if (existsSync(exePath)) {
    console.log(`[waydocs] API binary already present at ${exePath}`)
    return
  }

  const tag = `v${pkg.version}`
  const asset = `waydocs-api-${rid}.tar.gz`
  const url = `https://github.com/${REPO}/releases/download/${tag}/${asset}`

  console.log(`[waydocs] downloading ${url}`)
  let res
  try {
    res = await fetch(url, { redirect: 'follow' })
  } catch (e) {
    warn(`could not reach ${url} (${e.message}). MCP calls will fail until a binary exists at ${exePath} — see README.`)
    return
  }
  if (!res.ok || !res.body) {
    warn(`no release asset at ${url} (HTTP ${res.status}). MCP calls will fail until a binary exists at ${exePath} — see README.`)
    return
  }

  mkdirSync(destDir, { recursive: true })
  const archiveName = `${asset}.download`
  const archivePath = path.join(destDir, archiveName)
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(archivePath))
    // Both the archive filename and cwd are relative/bare here — no Windows drive-letter path appears in the
    // argv at all, since some tar builds (GNU tar's ssh-remote-archive heuristic) misparse "C:\..." as a
    // "host:path" spec when it's passed directly as an argument instead of via a shell that path-translates it.
    execFileSync('tar', ['-xzf', archiveName], { cwd: destDir, stdio: 'inherit' })
  } catch (e) {
    warn(`failed to extract ${asset} (${e.message}). MCP calls will fail until a binary exists at ${exePath} — see README.`)
    return
  } finally {
    rmSync(archivePath, { force: true })
  }

  if (!rid.startsWith('win')) chmodSync(exePath, 0o755)

  console.log(`[waydocs] installed API binary at ${exePath}`)
}

await main()
