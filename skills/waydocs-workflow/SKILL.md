---
name: waydocs-workflow
description: >-
  How to use an installed Waydocs MCP server (tools named docs_map, search_docs, find_docs, get_neighbors,
  get_header, get_doc, doc_history, diff_doc, changelog, list_gaps, check_docs, save_doc, revert_doc) as the
  project's documentation system instead of grepping or reading raw markdown files. Use this skill whenever
  a waydocs-style tool is available AND you need project context (how something works, why a decision was
  made, what a service/endpoint/ticket touches) or you just learned something during a task that future
  work should know (a new endpoint, a gotcha, a design decision, a bug's root cause). Trigger it before
  falling back to Glob/Grep/Read over a docs folder, before writing a new .md file to record findings, and
  whenever the user asks to "check the docs," "document this," "update the docs," or asks something that
  sounds like it has a written answer somewhere in the project.
---

# Working with Waydocs

Waydocs is a documentation MCP server: each project's docs live in a local SQLite store, not as loose
markdown files, and every doc has a **header** (title, summary, `answers` — the questions it answers, `refs`
— links to project entities like tickets/services/endpoints) plus a body. Every save is an append-only
**revision** with a required change message, so the doc history is a real changelog.

The point of this skill is to make you use that system the way it's designed to be used: **cheap headers
first, bodies only when needed, and write back what you learn instead of leaving it in your head or in a
throwaway file.**

## Detecting Waydocs

Don't assume the MCP server is registered under the name "waydocs" — the server key in `.mcp.json` or
`~/.claude.json` is whatever the user chose. Instead, check whether tools named `docs_map`, `search_docs`,
`get_header`, `get_doc`, and `save_doc` are available to you right now. If they are, this skill applies. If
they aren't, there's no Waydocs server here — fall back to normal file search, and don't tell the user their
docs are missing just because the tool isn't installed.

## Reading: headers before bodies, search before browsing

Waydocs is structured so that scanning every doc's header is cheap and reading a full body is comparatively
expensive. Respect that gradient:

1. **Start with `docs_map`** (optionally filtered by `domain`) or **`search_docs`** with the user's question
   or the keywords you're chasing. Both return only title/summary/status (`docs_map`) or title/summary/
   matched-field/snippet (`search_docs`) — enough to tell if a doc is relevant without opening it.
2. If you already know the entity you care about (a ticket number, a service class, an endpoint, a DB
   object — anything the project tags as a `ref`), use **`find_docs`** with that type/value instead of
   guessing which doc might mention it.
3. Once you've found a candidate doc, use **`get_neighbors`** if you need the surrounding picture — the
   folder it belongs to and the docs it links to or is linked from — before deciding you need more docs.
4. Only call **`get_doc`** when a summary genuinely isn't enough. Pass `sections` (matched by heading) to
   pull just the parts you need rather than the whole body — most questions are answered by one or two
   sections, not the entire doc. Use `get_header` instead of `get_doc` when you only need the answers/refs
   list, not any body text at all.

Treat this the same way you'd treat reading a large file: you wouldn't `Read` a 2000-line file to answer a
question a `Grep` could answer in one line. `docs_map`/`search_docs`/`find_docs` are your `Grep`; `get_doc`
is your full `Read`.

Do not grep the filesystem for markdown docs, and do not read a project's `docs/` folder directly, when a
Waydocs server is available — the SQLite-backed docs are the source of truth, and stray `.md` files may be
stale exports or leftovers from before Waydocs was adopted. If you're unsure whether a folder of `.md` files
is authoritative, check `docs_map` first; if the topic is covered there, trust that over a file on disk.

## Writing: save what you learn, don't let it evaporate

When a task teaches you something a future task would want to know — you found where an endpoint is wired
up, you worked out why a bug happens, the user explained a design decision, you added a new service — write
it into Waydocs with **`save_doc`** rather than leaving it only in your response or in a new standalone
markdown file. A one-off `NOTES.md` is exactly the kind of undiscoverable doc Waydocs exists to replace.

`save_doc` always takes the **full** header and **full** body, not a patch:

- **`id`**: `domain/kebab-case-name` (e.g. `order/basket-lines`), or `domain/README` for a domain's index
  doc. Pick a domain that matches how the project already organizes docs — check `docs_map` for existing
  domains before inventing a new one.
- **`header.summary`**: 1–3 sentences, max 400 characters. This is what gets scanned by `docs_map` and
  `search_docs` before anyone opens the body, so write it as the answer to "what is this doc about," not a
  generic restatement of the title.
- **`header.answers`**: up to 8 questions this doc answers, phrased the way someone would actually ask them
  ("why does X retry on timeout?" not "retry behavior"). This is what `search_docs` ranks against, so vague
  or missing answers make the doc effectively unsearchable even though it exists.
- **`header.refs`**: entities this doc is about, as `{type, value}` pairs — `ticket`, `service`, `endpoint`,
  `dbObject`, or whatever kind fits the project. These are what `find_docs` matches on exactly, so use the
  same type names and value formatting the project already uses elsewhere (check an existing doc with a
  similar ref via `get_header` if unsure).
- **`header.status`**: `Current`, `Draft`, or `Deprecated` — pick deliberately, don't default to `Current`
  for something you're not sure is finished or correct.
- **`message`**: required, and should say *why* the change happened, not just that it happened. "Update
  docs" or "fix" tells a future reader nothing; "document the retry backoff added for ticket #4936" does.
  Pass `ticket` too when the change traces to one, so `changelog` can be filtered by it later.
- **`baseRevision`**: `null` for a brand-new doc. For an existing one, use the revision number you just read
  via `get_header`/`get_doc` — if it's stale, the save is rejected as a conflict instead of silently
  clobbering someone else's edit. Treat that rejection as a signal to re-read the current doc and reapply
  your change on top, not as an error to route around.

If you're updating an existing doc, read its current header first (`get_header`) so you extend the existing
`answers`/`refs` rather than overwriting a well-maintained header with a thin one just because you didn't
look.

## Checking doc health and history

- Use **`list_gaps`** to see open `[DOC GAP]` markers — placeholders someone left for information that's
  still missing — when asked to review documentation completeness, or before writing a new doc in an area
  that might already have a flagged gap.
- Use **`check_docs`** for a broader health pass (broken links, missing/oversized summaries, headers with no
  `answers`, docs not linked from any index) when asked to audit the docs, or periodically if you're doing
  substantial doc-writing work in one session.
- Use **`doc_history`** and **`diff_doc`** to see who changed what and why, and **`changelog`** to see recent
  changes project-wide (optionally filtered by `ticket` or a day window) — reach for these before asking the
  user "why is this doc like this," since the answer is often already recorded.
- Use **`revert_doc`** to undo a bad save. It adds a new revision restoring the old content rather than
  rewriting history, so the fact that a revert happened stays visible in `doc_history`.
