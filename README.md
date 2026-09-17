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
                     revert_doc) — registered in ~/.claude.json as "waydocs"
scripts/             start-api.ps1, start-web.ps1, build-mcp.ps1, import.mjs (imports an existing docs/ folder)
data/docs.db         gitignored SQLite file
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
