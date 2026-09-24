#!/usr/bin/env node
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }

function isOutdated(current: string, latest: string): boolean {
  const c = current.split('.').map(Number)
  const l = latest.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) !== (c[i] ?? 0)) return (l[i] ?? 0) > (c[i] ?? 0)
  }
  return false
}

// Best-effort, single call per process start (one per Claude Code session) — a slow or unreachable GitHub
// never blocks startup or fails it; a stale/malformed response is just treated as "no update available".
async function checkForUpdate(current: string): Promise<{ current: string; latest: string } | null> {
  try {
    const res = await fetch('https://api.github.com/repos/aquaprogit/waydocs/releases/latest', {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string }
    const latest = data.tag_name?.replace(/^v/, '')
    if (!latest || !isOutdated(current, latest)) return null
    return { current, latest }
  } catch {
    return null
  }
}

function parseArgs(argv: string[]) {
  // `waydocs-mcp --path <dir>` (no subcommand, existing MCP registrations) defaults to 'mcp'; a bare leading
  // word switches mode, e.g. `waydocs-mcp web --path <dir>`.
  let command: 'mcp' | 'web' = 'mcp'
  let rest = argv
  if (argv[0] === 'web' || argv[0] === 'mcp') {
    command = argv[0]
    rest = argv.slice(1)
  }
  const out: { command: 'mcp' | 'web'; path?: string } = { command }
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--path') out.path = rest[++i]
  }
  return out
}

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

async function waitForApi(url: string, child: ChildProcess, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`waydocs API exited early (code ${child.exitCode}) before it came up at ${url}`)
    }
    try {
      const res = await fetch(`${url}/api/docs`)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`waydocs API did not come up at ${url} within ${timeoutMs}ms`)
}

// Tries to launch `command args`; resolves to the child on success, or null if `command` isn't on PATH
// (ENOENT), so the caller can fall back to another way of starting the API.
function trySpawn(command: string, args: string[]): Promise<ChildProcess | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') resolve(null)
      else reject(err)
    }
    child.once('error', onError)
    // No error within a tick means the process actually started — stop listening so a later runtime crash is
    // reported via exitCode instead of being swallowed here.
    setImmediate(() => {
      child.off('error', onError)
      resolve(child)
    })
  })
}

// .NET runtime identifier for the current platform — matches the folder names scripts/publish-api.ps1 (or its
// linux/macOS equivalent) publishes into under mcp/bin/.
function currentRid(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  if (process.platform === 'win32') return `win-${arch}`
  if (process.platform === 'darwin') return `osx-${arch}`
  if (process.platform === 'linux') return `linux-${arch}`
  throw new Error(`Unsupported platform: ${process.platform}`)
}

// Starts the API scoped to `projectPath` on a free local port and returns its base URL. Only used when the
// caller hasn't already pointed us at a running instance via WAYDOCS_API_URL (e.g. local dev against
// `.\scripts\start-api.ps1`). Prefers the self-contained binary bundled in this package (no .NET install
// required); falls back to a `waydocs-api` on PATH, then to `dotnet run --project server/Waydocs.Api` when
// working inside this monorepo's own source tree.
async function startOwnApi(projectPath: string): Promise<string> {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const apiArgs = ['--urls', url, '--path', projectPath]

  const bundled = path.resolve(__dirname, '..', 'bin', currentRid(), process.platform === 'win32' ? 'waydocs-api.exe' : 'waydocs-api')
  let child = existsSync(bundled) ? await trySpawn(bundled, apiArgs) : null

  if (!child) child = await trySpawn('waydocs-api', apiArgs)

  if (!child) {
    const apiProject = path.resolve(__dirname, '..', '..', 'server', 'Waydocs.Api')
    if (!existsSync(apiProject)) {
      throw new Error(
        "Can't find the waydocs API — no bundled binary for this platform, `waydocs-api` isn't on PATH, " +
          'and this is not the waydocs source repo (which falls back to `dotnet run`).',
      )
    }
    child = await trySpawn('dotnet', ['run', '--project', apiProject, '--urls', url, '--', '--path', projectPath])
    if (!child) throw new Error('Neither `waydocs-api` nor `dotnet` is on PATH — cannot start the waydocs API.')
  }

  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const cleanup = () => {
    if (child.exitCode === null) child.kill()
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })

  try {
    await waitForApi(url, child)
  } catch (e) {
    cleanup()
    throw new Error(`${(e as Error).message}${stderr ? `\n--- API stderr ---\n${stderr}` : ''}`)
  }

  return url
}

async function runMcp(projectPath: string) {
  // Runs alongside API startup rather than after it, so a slow GitHub call never adds to the time before
  // the agent's first tool call goes through.
  const updateCheck = checkForUpdate(pkg.version)
  if (!process.env.WAYDOCS_API_URL) {
    process.env.WAYDOCS_API_URL = await startOwnApi(projectPath)
  }
  const update = await updateCheck

  // Imported after WAYDOCS_API_URL is set — client.ts reads it once at module load.
  const { registerTools } = await import('./tools.js')

  const server = new McpServer(
    { name: 'waydocs', version: pkg.version },
    update
      ? {
          instructions:
            `waydocs-mcp is out of date: this project is running ${update.current}, but ${update.latest} is available. ` +
            'Tell the user to update it (see "Upgrading" in the waydocs README) — this session keeps using the old ' +
            'tools/behavior until they do and restart their session.',
        }
      : undefined,
  )

  registerTools(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// `waydocs-mcp web --path <dir>`: starts the API (same resolution as MCP mode) with its bundled web UI, opens
// it in the default browser, and stays alive until Ctrl+C — for a human browsing docs, not an agent.
async function runWeb(projectPath: string) {
  const updateCheck = checkForUpdate(pkg.version)
  const url = process.env.WAYDOCS_API_URL ?? (await startOwnApi(projectPath))
  const update = await updateCheck
  console.log(`Waydocs is running at ${url}`)
  if (update) console.log(`⚠ waydocs-mcp ${update.current} is out of date — ${update.latest} is available. Run: npm install -g waydocs-mcp@latest`)
  console.log('Press Ctrl+C to stop.')
  openBrowser(url)
  await new Promise(() => {}) // SIGINT/SIGTERM handlers registered in startOwnApi exit the process
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const projectPath = path.resolve(args.path ?? process.cwd())

  if (args.command === 'web') await runWeb(projectPath)
  else await runMcp(projectPath)
}

await main()
