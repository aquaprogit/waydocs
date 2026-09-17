# Waydocs

[![npm](https://img.shields.io/npm/v/waydocs-mcp.svg)](https://www.npmjs.com/package/waydocs-mcp)
[![Publish waydocs-api](https://github.com/aquaprogit/waydocs/actions/workflows/publish-api.yml/badge.svg)](https://github.com/aquaprogit/waydocs/actions/workflows/publish-api.yml)

**Versioned documentation your AI agent can navigate without reading whole files.**

Waydocs gives every doc a **header** — title, summary, the questions it answers, refs — that an agent reads
first to decide whether to open the body or just one section. Docs form a **graph** automatically (`part-of`
folder membership, `mentions` inline links) plus shared entity refs of any project-defined kind — tickets,
services, endpoints, whatever fits your project. Every save is an append-only **revision** with a required
change message, so history is a real changelog, not just diffs.

It runs entirely on your machine — one MCP server per project, its own local SQLite file, no account, no
server to host, no data leaving your computer.

## Install

```bash
npm install -g waydocs-mcp
```

This also downloads a self-contained API binary for your platform (Windows/macOS/Linux, x64/arm64) — **no
.NET install required.**

Then register it as an MCP server, scoped to whichever project you want documented. In Claude Code, add this
to `~/.claude.json` (or your project's `.mcp.json`):

```json
{
  "mcpServers": {
    "waydocs": {
      "command": "waydocs-mcp",
      "args": ["--path", "C:\\path\\to\\your\\project"]
    }
  }
}
```

Restart your Claude Code session (MCP servers load once at startup) and it's live — no separate server to
start, no port to remember. The first call auto-spawns the API in the background, scoped to that project's own
`.waydocs/docs.db`, and shuts it down when the session ends.

Ask your agent something like *"map the docs for this project"* to confirm it's working — `docs_map` should
return an (empty, for a new project) list.

### Tools available to the agent

| Tool | What it's for |
|---|---|
| `docs_map` | Cheapest view of every doc — id, title, summary, status. Always call this first. |
| `search_docs` | Rank docs by title/summary/answers/refs for a question or keywords. |
| `find_docs` | Exact lookup by ref entity — ticket, service, endpoint, or any project-defined type. |
| `get_neighbors` | Docs connected to one doc in the graph, 1–3 hops deep. |
| `get_header` | Full header of one doc — everything except the body. |
| `get_doc` | Read a doc's body, or just the sections you need. |
| `doc_history` / `diff_doc` | Revision history and diffs between any two revisions. |
| `changelog` | Recent revisions across all docs, filterable by ticket or day window. |
| `list_gaps` / `check_docs` | Open `[DOC GAP]` markers and a health check (broken links, missing summaries, etc.). |
| `save_doc` | Create or update a doc — full header + body, with optimistic-concurrency conflict checks. |
| `revert_doc` | Revert a doc to an earlier revision (adds a new revision — history is never rewritten). |

### Bringing in docs you already have

`scripts/import.mjs` bulk-imports an existing markdown folder as revision-1 docs (heuristically inferring
titles, summaries, and refs — plan to hand-edit the generated headers afterward). It isn't packaged with the
npm install yet, so it currently needs a clone of this repo:

```bash
git clone https://github.com/aquaprogit/waydocs.git
cd waydocs
WAYDOCS_API_URL=http://127.0.0.1:<port from your running waydocs-mcp> WAYDOCS_SOURCE=<path to your docs folder> node scripts/import.mjs
```

### Browsing docs in a web UI

```bash
waydocs-mcp web --path <project path>
```

Starts the same API used by MCP mode — with the full React UI (browse, edit, history/diff, dependency graph)
bundled in — on a free local port, and opens it in your default browser. Ctrl+C stops it; nothing is left
running in the background.

## How it works

```
server/Waydocs.Api/   .NET 10 minimal API + EF Core SQLite — the actual doc store, with web/dist served as
                      static files (wwwroot) when bundled in at publish time
web/                  React 19 + Vite — browse, edit, history/diff, graph
mcp/                  The npm package (waydocs-mcp) — CLI (mcp/web modes) + install-time API downloader
scripts/              Dev scripts (start-api.ps1, start-web.ps1, build-mcp.ps1, publish-api.ps1, import.mjs)
.waydocs/docs.db      Per-project SQLite file, created at --path (defaults to cwd)
```

Each `waydocs-mcp` process is scoped by `--path <project>`: it stores that project's docs in
`<project>/.waydocs/docs.db` and spawns its own API instance on a free local port to serve them — no shared
server, no accounts, no auth. Your filesystem permissions are the only security boundary, same as any other
local dev tool.

## Developing Waydocs itself

Cloning this repo instead of installing the package:

```powershell
# terminal 1 — API on http://localhost:5180, serving this repo's own dogfood docs
.\scripts\start-api.ps1

# terminal 2 — web UI on http://localhost:5183, proxies /api to :5180
.\scripts\start-web.ps1
```

`web/src/api.ts` defaults to the real API. Set `VITE_USE_MOCK=1` to fall back to an in-memory/localStorage
prototype (`web/src/mock/mockApi.ts`, seeded via `npm run seed` in `web/`, `WAYDOCS_SOURCE=<path>`) instead.

Point `server/Waydocs.Api/appsettings.json` → `Docs:ExportPath` at a folder if you want every save mirrored
out to markdown files (with YAML frontmatter) alongside your existing repo, for tools that only `Read` files.

After editing `mcp/src/*`, run `.\scripts\build-mcp.ps1` and start a new Claude Code session in whatever
project consumes it — MCP servers only load their code once, at session start.

## Upgrading

Updates are manual — there's no auto-update check. To move to a newer version:

```bash
npm install -g waydocs-mcp@latest
```

npm replaces the old global install directory outright, so the `postinstall` step downloads a fresh binary
matching the new version's GitHub Release — no leftover binary from the old version lingers. Any per-project
`.waydocs/docs.db` is migrated automatically the next time that binary runs against it (EF Core applies
whatever new migrations exist on startup); if a release drops a header field, data that only lived in that
field is discarded by the migration, same as any other schema change. No `~/.claude.json` changes are needed —
just restart your Claude Code session afterward so it picks up the new binary (MCP servers only load once, at
session start).

## Releasing (maintainers)

1. Bump the version in `mcp/package.json` — it must match the git tag, since the postinstall downloader fetches
   release `v<package version>`'s assets.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` — this triggers
   [`.github/workflows/publish-api.yml`](.github/workflows/publish-api.yml), which builds the web UI, bundles
   it into each self-contained `waydocs-api` binary (win-x64/linux-x64/linux-arm64/osx-x64/osx-arm64, all built
   from `ubuntu-latest` — a RID's runtime pack comes from NuGet, not the host OS), and attaches them to a
   GitHub Release. `workflow_dispatch` lets you run it manually without tagging, for a test build.
3. `cd mcp && npm publish` once the release's assets are up, so `npm install -g waydocs-mcp` matches a release
   that actually exists.

## Roadmap

- A `LICENSE` file (currently unset).
