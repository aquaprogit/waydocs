import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ApiError, api, estimateTokens } from './client.js'
import { agentHeader, mapEntry } from './shape.js'
import type { DocHeader } from './types.js'
import type { DocHeaderInput } from './types.js'

const STATUSES = ['Current', 'Draft', 'Deprecated'] as const

const headerSchema = z.object({
  title: z.string(),
  summary: z.string().max(400).describe('1-3 sentences — what an agent reads first to decide whether to open the doc'),
  status: z.enum(STATUSES),
  answers: z.array(z.string()).max(8).describe('questions this doc answers'),
  refs: z.array(
    z.object({
      type: z.string().describe('entity kind this ref points at — project-defined, e.g. "ticket", "service", "endpoint"'),
      value: z.string(),
    }),
  ),
})

type Json = Record<string, unknown>
// A string result is sent as-is (get_doc's markdown); anything else as pretty-printed JSON.
const ok = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }],
})
const fail = (message: string) => ({ isError: true as const, content: [{ type: 'text' as const, text: message }] })

// Docs at least this big get their section headings listed in search_docs hits, so an agent can go straight to
// get_doc with `sections` instead of paying for the whole body (or a get_header round-trip to learn the headings).
const LARGE_DOC_TOKENS = 1000

// Runs a read tool and meters it — the numbers behind usage_stats and the web UI's Metrics page. Every call's
// output counts as cost; `bodiesRead` names the docs whose body the call actually read, which the API credits
// (once per session) as what reading those files directly would have cost. Discovery tools read no bodies:
// an agent reading raw files would never have opened every doc a search merely listed. A metrics failure
// never surfaces as a tool failure: recordToolUsage swallows its own errors.
async function guarded<T>(tool: string, fn: () => Promise<T>, bodiesRead: (result: T) => string[] = () => []) {
  try {
    const result = await fn()
    const payload = ok(result)
    void api.recordToolUsage(tool, bodiesRead(result), estimateTokens(payload.content[0].text))
    return payload
  } catch (e) {
    return fail(e instanceof ApiError ? e.message : (e as Error).message)
  }
}

// Writes and usage_stats aren't metered: they don't stand in for reading anything.
async function unmetered<T>(fn: () => Promise<T>) {
  try {
    return ok(await fn())
  } catch (e) {
    return fail(e instanceof ApiError ? e.message : (e as Error).message)
  }
}

// get_doc's output: plain markdown with a one-line identity header, not JSON — escaping the body into a JSON
// string and attaching the full header made a read cost ~1.5x the raw file.
const docLine = (h: DocHeader) => `# ${h.title}\n${h.id} · rev ${h.revision} · ${h.status} · ${h.tokens} tokens`

export function registerTools(server: McpServer) {
  // ---------------------------------------------------------------- headers only (cheap — scan before opening anything)

  server.registerTool(
    'docs_map',
    {
      title: 'Map of every doc',
      description:
        'The cheapest possible view of every doc: id, title, summary, status, body token count — no answers, refs, or body. ' +
        'Call this first for any question; only open the docs that look relevant via get_header or get_doc.',
      inputSchema: { domain: z.string().nullish().describe('filter to one domain, e.g. "order"') },
    },
    async ({ domain }) =>
      guarded('docs_map', async () => (await api.listDocs()).filter((h) => !domain || h.domain === domain).map(mapEntry)),
  )

  server.registerTool(
    'search_docs',
    {
      title: 'Search docs by question or keywords',
      description:
        'Ranks docs by title/summary/answers/refs (headers only, no body scan) — good for "which doc answers X?". ' +
        `Hits on docs of ${LARGE_DOC_TOKENS}+ tokens also list their section headings: pass the ones you need to get_doc's sections.`,
      inputSchema: { query: z.string(), limit: z.number().int().positive().max(50).default(10) },
    },
    async ({ query, limit }) =>
      guarded('search_docs', async () => {
        const hits = await api.search(query, true, limit)
        return hits.map((h) => ({
          ...mapEntry(h.header),
          matchedIn: h.field,
          snippet: h.snippet,
          ...(h.header.tokens >= LARGE_DOC_TOKENS && { sections: h.header.sections.map((s) => s.heading) }),
        }))
      }),
  )

  server.registerTool(
    'find_docs',
    {
      title: 'Find docs referencing a ref entity (ticket, service, endpoint, or any project-defined type)',
      description: 'Exact-match lookup over the refs every doc lists in its header — start here for "docs about ticket #4936" or "docs touching OrderSubmittingHandler".',
      inputSchema: { type: z.string(), value: z.string() },
    },
    async ({ type, value }) =>
      guarded('find_docs', async () => (await api.find(type, value)).map(mapEntry)),
  )

  server.registerTool(
    'get_neighbors',
    {
      title: 'Docs connected to one doc in the graph',
      description:
        'part-of (folder membership) and mentions (inline links) edges touching this doc, in both directions. ' +
        'depth 2 also includes neighbors-of-neighbors.',
      inputSchema: { id: z.string(), depth: z.number().int().min(1).max(3).default(1) },
    },
    async ({ id, depth }) =>
      guarded('get_neighbors', async () => {
        const graph = await api.graph()
        const titleOf = new Map(graph.nodes.map((n) => [n.id, n.title]))
        if (!titleOf.has(id)) throw new ApiError(`No doc '${id}'.`)
        let frontier = new Set([id])
        const seen = new Set([id])
        const edgesOut: { from: string; to: string; type: string }[] = []
        for (let d = 0; d < depth; d++) {
          const next = new Set<string>()
          for (const e of graph.edges) {
            if (frontier.has(e.from) && !seen.has(e.to)) { next.add(e.to); edgesOut.push(e) }
            else if (frontier.has(e.to) && !seen.has(e.from)) { next.add(e.from); edgesOut.push(e) }
            else if (frontier.has(e.from) && frontier.has(e.to)) edgesOut.push(e)
          }
          for (const n of next) seen.add(n)
          frontier = next
          if (frontier.size === 0) break
        }
        return {
          neighbors: [...seen].filter((n) => n !== id).map((n) => ({ id: n, title: titleOf.get(n) ?? n })),
          edges: edgesOut.map((e) => ({ ...e, fromTitle: titleOf.get(e.from) ?? e.from, toTitle: titleOf.get(e.to) ?? e.to })),
        }
      }),
  )

  server.registerTool(
    'get_header',
    {
      title: 'Full header of one doc (no body)',
      description: 'Summary, answers, refs, section list with per-section token counts — everything except the markdown body.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) =>
      guarded('get_header', async () => agentHeader((await api.getDoc(id)).header)),
  )

  // ---------------------------------------------------------------- body

  server.registerTool(
    'get_doc',
    {
      title: 'Read a doc body (or just some sections)',
      description:
        'Returns markdown: the title, then "id · rev · status · tokens", then the body. Prefer passing sections (matched by heading, ' +
        'case/punctuation-insensitive) over reading the whole body — search_docs lists the headings of large docs, get_header lists ' +
        'every doc\'s with per-section token counts. Omit sections for the whole doc, revision for the current one. Pass ' +
        'withHeader: true only when you are about to save_doc, which needs the full header (answers, refs) to send back.',
      inputSchema: {
        id: z.string(),
        sections: z.array(z.string()).nullish(),
        revision: z.number().int().positive().nullish(),
        withHeader: z.boolean().default(false),
      },
    },
    async ({ id, sections, revision, withHeader }) =>
      guarded(
        'get_doc',
        async () => {
          const doc = await api.getDoc(id, revision ?? undefined)
          const top = withHeader ? `${docLine(doc.header)}\n${JSON.stringify(agentHeader(doc.header))}` : docLine(doc.header)
          if (!sections || sections.length === 0) return `${top}\n\n${doc.content}`
          const { content } = await api.getSections(id, sections)
          if (!content.trim())
            throw new ApiError(
              `No section of '${id}' matches ${JSON.stringify(sections)}. Headings: ${doc.header.sections.map((s) => s.heading).join(' | ')}`,
            )
          return `${top}\n\n${content}`
        },
        () => [id],
      ),
  )

  // ---------------------------------------------------------------- history / health

  server.registerTool(
    'doc_history',
    { title: 'Revision history of a doc', description: 'Every revision: number, message, ticket, author, source, date.', inputSchema: { id: z.string() } },
    async ({ id }) => guarded('doc_history', () => api.history(id)),
  )

  server.registerTool(
    'diff_doc',
    {
      title: 'Diff two revisions of a doc',
      description: 'Header fields are serialized above the "---" line so header changes (summary, answers, refs) show in the diff too. Pass 0 for "before the doc existed".',
      inputSchema: { id: z.string(), from: z.number().int().min(0), to: z.number().int().min(1) },
    },
    async ({ id, from, to }) => guarded('diff_doc', () => api.diff(id, from, to)),
  )

  server.registerTool(
    'changelog',
    {
      title: 'Recent revisions across all docs',
      description: 'What changed and why, newest first — filter by ticket or a day window.',
      inputSchema: { sinceDays: z.number().int().positive().nullish(), ticket: z.string().nullish(), includeImports: z.boolean().default(false) },
    },
    async ({ sinceDays, ticket, includeImports }) =>
      guarded('changelog', () => api.changelog(sinceDays ?? undefined, ticket ?? undefined, includeImports)),
  )

  server.registerTool(
    'list_gaps',
    { title: 'Open [DOC GAP] markers', description: 'Every unresolved doc gap across all docs (or one domain).', inputSchema: { domain: z.string().nullish() } },
    async ({ domain }) =>
      guarded('list_gaps', async () =>
        (await api.gaps()).filter((g) => !domain || g.docId.startsWith(`${domain}/`) || g.docId === domain),
      ),
  )

  server.registerTool(
    'check_docs',
    {
      title: 'Doc health check',
      description: 'Broken links, missing/oversized summaries, headers with no answers, stale .cursor/ paths, docs not linked from any index.',
      inputSchema: {},
    },
    async () => guarded('check_docs', () => api.check()),
  )

  // ---------------------------------------------------------------- writes

  server.registerTool(
    'save_doc',
    {
      title: 'Create or update a doc',
      description:
        'Always send the FULL header (not a partial patch) and the full body. A change message is required; pass the ticket when the ' +
        'change traces to one. For an existing doc, baseRevision must be its current revision number (from get_header, or ' +
        'get_doc\'s "rev") — a stale value is rejected with a conflict so you never silently overwrite someone else\'s edit; re-read and retry in that case. ' +
        'For a brand-new doc, pass baseRevision: null.',
      inputSchema: {
        id: z.string().describe('domain/kebab-case-name, e.g. order/basket-lines; domain/README for a domain index'),
        header: headerSchema,
        content: z.string().describe('markdown body — do not repeat the title as an H1, it is added automatically'),
        message: z.string().describe('required — why this changed'),
        ticket: z.string().nullish(),
        baseRevision: z.number().int().positive().nullable(),
      },
    },
    async ({ id, header, content, message, ticket, baseRevision }) =>
      unmetered(() => api.save({ id, header: header as DocHeaderInput, content, message, ticket, baseRevision })),
  )

  server.registerTool(
    'revert_doc',
    {
      title: 'Revert a doc to an earlier revision',
      description: 'Adds a new revision with that old content — history is never rewritten.',
      inputSchema: { id: z.string(), toRevision: z.number().int().positive(), message: z.string() },
    },
    async ({ id, toRevision, message }) => unmetered(() => api.revert(id, toRevision, message)),
  )

  // ---------------------------------------------------------------- metrics

  server.registerTool(
    'usage_stats',
    {
      title: 'Tokens saved by using Waydocs instead of reading raw doc files',
      description:
        'For every read call made against this project (this session and prior ones), compares everything Waydocs returned — ' +
        'discovery calls included — to what reading the full body of each doc actually opened with get_doc would have cost, ' +
        'each doc counted once per session. Writes are not counted. Report this back to the user when they ask how much ' +
        'Waydocs is saving them; a negative number means it is costing more than reading the files directly.',
      inputSchema: { sinceDays: z.number().int().positive().nullish().describe('limit to the last N days; omit for all-time') },
    },
    async ({ sinceDays }) => unmetered(() => api.metricsSummary(sinceDays ?? undefined)),
  )
}
