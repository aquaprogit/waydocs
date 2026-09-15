# SD Docs

Local, versioned business documentation for SD-Backend, built for AI agents and for editing by hand.

- Every doc has a **header** (title, summary, the questions it answers, what it does not cover, refs, typed links) that an
  agent reads first to decide whether to load the body or only some sections.
- Docs form a **graph**: typed doc→doc links (`part-of`, `mentions`, `depends-on`, `related`, `supersedes`,
  `conflicts-with`) plus shared entity refs (tickets, services, endpoints, DB/D365 objects).
- Every save is an append-only **revision** with a required change message and optional ticket.

## Status

Backend, web app and MCP server all work end-to-end. **No real SD-Backend content has been imported yet** —
the API's export path is deliberately blank (`server/SdDocs.Api/appsettings.json` → `Docs:ExportPath`), so it
never writes into `SD-Backend/docs`, and `scripts/import.mjs` (which would pull `docs/` in as r1 revisions)
has not been run. The only docs in the store right now are a synthetic `widgets/*` test set used to verify
save/history/diff/graph/search/MCP. Import real content, and point `Docs:ExportPath` back at
`SD-Backend/docs`, only when asked.

```
server/SdDocs.Api/   .NET 10 minimal API + EF Core SQLite (port 5180)
web/                 React 19 + Vite — browse, edit, history/diff, graph (port 5183)
mcp/                 stdio MCP server (tools: docs_map, search_docs, find_docs, get_neighbors, get_header,
                     get_doc, doc_history, diff_doc, changelog, list_gaps, check_docs, save_doc, link_docs,
                     revert_doc) — registered in ~/.claude.json as "sd-docs"
scripts/             start-api.ps1, start-web.ps1, build-mcp.ps1, import.mjs (not run against real docs yet)
data/docs.db         gitignored SQLite file
```

## Run it

```powershell
# terminal 1
.\scripts\start-api.ps1        # http://localhost:5180

# terminal 2
.\scripts\start-web.ps1        # http://localhost:5183, proxies /api to :5180
```

`web/src/api.ts` defaults to the real API. Set `VITE_USE_MOCK=1` to fall back to the old in-memory/localStorage
prototype (`web/src/mock/mockApi.ts`, seeded from `SD-Backend/docs` via `npm run seed` in `web/`) instead.

After editing `mcp/src/*`, run `.\scripts\build-mcp.ps1` and start a new Claude Code session in SD-Backend to
pick up the rebuilt server (MCP servers load once at session start). See
`SD-Backend/.claude/skills/sd-docs/SKILL.md` for the tool reference.
