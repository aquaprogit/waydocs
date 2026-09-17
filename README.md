# Waydocs

Versioned documentation that AI agents can navigate without reading whole files, built for any project.

- Every doc has a **header** (title, summary, the questions it answers, what it does not cover, refs, typed links) that an
  agent reads first to decide whether to load the body or only some sections.
- Docs form a **graph**: typed doc→doc links (`part-of`, `mentions`, `depends-on`, `related`, `supersedes`,
  `conflicts-with`) plus shared entity refs — any project-defined kind (tickets, services, endpoints, or your own).
- Every save is an append-only **revision** with a required change message and optional ticket.

```
server/Waydocs.Api/  .NET 10 minimal API + EF Core SQLite (port 5180)
web/                 React 19 + Vite — browse, edit, history/diff, graph (port 5183)
mcp/                 stdio MCP server (tools: docs_map, search_docs, find_docs, get_neighbors, get_header,
                     get_doc, doc_history, diff_doc, changelog, list_gaps, check_docs, save_doc, link_docs,
                     revert_doc) — registered per-project in ~/.claude.json as "waydocs", command
                     `node mcp/dist/index.js --path <project>` (it spawns its own API
                     scoped to that project's .waydocs/docs.db, on a free local port, no setup needed).
                     Set WAYDOCS_API_URL to point it at an already-running API instead (e.g. for dev
                     against `.\scripts\start-api.ps1`).
scripts/             start-api.ps1, start-web.ps1, build-mcp.ps1, import.mjs (imports an existing docs/ folder)
.waydocs/docs.db     gitignored SQLite file for the project at --path (defaults to cwd)
```

## Run it

```powershell
# terminal 1
.\scripts\start-api.ps1        # http://localhost:5180

# terminal 2
.\scripts\start-web.ps1        # http://localhost:5183, proxies /api to :5180
```

`web/src/api.ts` defaults to the real API. Set `VITE_USE_MOCK=1` to fall back to an in-memory/localStorage
prototype (`web/src/mock/mockApi.ts`, seeded from a docs folder via `npm run seed` in `web/`, set
`WAYDOCS_SOURCE=<path>`) instead.

## Bringing in your own docs

- Point `server/Waydocs.Api/appsettings.json` → `Docs:ExportPath` at a folder if you want every save mirrored
  out to markdown files (with YAML frontmatter) alongside your existing repo — useful if other tools already
  `Read` those files.
- Run `WAYDOCS_SOURCE=<path to your docs folder> node scripts/import.mjs` to pull existing markdown into the
  store as r1 revisions (heuristically inferring title/summary/refs — hand-edit the generated headers after).

After editing `mcp/src/*`, run `.\scripts\build-mcp.ps1` and start a new Claude Code session in the consuming
project to pick up the rebuilt server (MCP servers load once at session start). See that project's
`.claude/skills/waydocs/SKILL.md` for the tool reference.

## Installing it in another project (no .NET install needed)

`server/Waydocs.Api` publishes self-contained (`scripts/publish-api.ps1`, `dotnet publish -r <rid>
--self-contained -p:PublishSingleFile=true`) into `mcp/bin/<rid>/waydocs-api[.exe]` — a single executable with
the .NET runtime baked in, so consumers don't need .NET installed at all. `mcp/src/index.ts` looks for that
bundled binary for the current platform first, then a `waydocs-api` on PATH, then falls back to
`dotnet run --project server/Waydocs.Api` when run from inside this repo's own source tree.

```powershell
# once, from this repo — publishes the self-contained binary this machine's platform needs
.\scripts\publish-api.ps1              # defaults to win-x64; pass -Rid linux-x64 / osx-arm64 / osx-x64 on
                                        # those platforms (needs to be run on or cross-published for each)

# in the consuming project's ~/.claude.json mcp server entry:
#   command: node, args: ["<path to mcp/dist/index.js>", "--path", "<project path>"]
```

Each published binary is ~100MB (ASP.NET Core + EF Core statically linked in) and lives under `mcp/bin/`,
which is gitignored — it's a build artifact, not source.

`.github/workflows/publish-api.yml` builds win-x64/linux-x64/linux-arm64/osx-x64/osx-arm64 self-contained
binaries (all from `ubuntu-latest` — a target RID's runtime pack comes from NuGet, so no per-OS runner is
needed) on every push to a `v*.*.*` tag and attaches them to a GitHub Release; `workflow_dispatch` lets you
run it manually too.

`mcp/scripts/download-api.mjs` runs as `waydocs-mcp`'s `postinstall` (see `mcp/package.json`) and downloads
`waydocs-api-<rid>.tar.gz` from the GitHub Release matching the installed package's version (`v<version>` tag)
into `mcp/bin/<rid>/`, so `npm install -g waydocs-mcp` alone gets a working binary with no .NET and no manual
publish step. It's a no-op inside this monorepo's own checkout (dev uses `scripts/publish-api.ps1` instead),
skippable via `WAYDOCS_SKIP_API_DOWNLOAD=1`, and never fails the `npm install` itself — a missing/failed
download just means `mcp/src/index.ts`'s runtime error surfaces later instead.

Not yet done: publishing `waydocs-mcp` to npm and cutting a real `v0.1.0` tag so a release (and its binaries)
actually exists for the postinstall script to find — until then it downloads nothing and warns. A
`waydocs serve --web --path <dir>` command for the optional local web viewer is also still open.
