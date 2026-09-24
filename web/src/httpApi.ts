import {
  ApiError,
  type Author,
  type ChangelogFilter,
  type ChangelogItem,
  type CheckIssue,
  type DocFull,
  type DocHeader,
  type DocLinks,
  type GapItem,
  type GraphData,
  type HistoryItem,
  type RefType,
  type SaveRequest,
  type SaveResult,
  type SearchHit,
  type Source,
} from './types'

let version = 0
const listeners = new Set<() => void>()
const bump = () => {
  version++
  listeners.forEach((l) => l())
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  } catch (e) {
    throw new ApiError(
      `Cannot reach the Waydocs API. Start it with \`dotnet run\` in server/Waydocs.Api (port 5180). Underlying error: ${(e as Error).message}`,
      0,
    )
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      detail = JSON.parse(text).error ?? text
    } catch {
      /* keep raw text */
    }
    throw new ApiError(detail, res.status)
  }
  return (text ? JSON.parse(text) : undefined) as T
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

export const httpApi = {
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  version: () => version,

  source: () => req<{ source: string | null }>('/source').then((r) => r.source ?? ''),

  listDocs: () => req<DocHeader[]>('/docs'),

  getDoc: (id: string, revision?: number) => req<DocFull>(`/doc${qs({ id, rev: revision })}`),

  getSections: (id: string, headings: string[]) =>
    req<{ content: string; tokens: number }>(`/doc/sections${qs({ id })}`, {
      method: 'POST',
      body: JSON.stringify({ headings }),
    }),

  search: (q: string, opts: { limit?: number; headersOnly?: boolean } = {}) =>
    req<SearchHit[]>(`/search${qs({ q, headersOnly: opts.headersOnly, limit: opts.limit })}`),

  find: (type: RefType, value: string) => req<DocHeader[]>(`/find${qs({ type, value })}`),

  knownRefs: () => req<Record<RefType, string[]>>('/known-refs'),

  graph: () => req<GraphData>('/graph'),

  links: (id: string) => req<DocLinks>(`/links${qs({ id })}`),

  history: (id: string) => req<HistoryItem[]>(`/history${qs({ id })}`),

  diff: (id: string, from: number, to: number) => req<{ before: string; after: string }>(`/diff${qs({ id, from, to })}`),

  async save(request: SaveRequest, author: Author = 'Human', source: Source = 'web'): Promise<SaveResult> {
    const r = await req<SaveResult>(`/doc${qs({ author, source })}`, { method: 'PUT', body: JSON.stringify(request) })
    if (r.changed) bump()
    return r
  },

  async revert(id: string, to: number, message: string, author: Author = 'Human', source: Source = 'web'): Promise<SaveResult> {
    const r = await req<SaveResult>(`/revert${qs({ id, author, source })}`, {
      method: 'POST',
      body: JSON.stringify({ to, message }),
    })
    if (r.changed) bump()
    return r
  },

  async deleteDoc(id: string): Promise<void> {
    await req<{ deleted: boolean }>(`/doc${qs({ id })}`, { method: 'DELETE' })
    bump()
  },

  changelog: (f: ChangelogFilter = {}) =>
    req<ChangelogItem[]>(`/changelog${qs({ sinceDays: f.sinceDays ?? undefined, ticket: f.ticket, includeImports: f.includeImports })}`),

  gaps: () => req<GapItem[]>('/gaps'),

  check: () => req<CheckIssue[]>('/check'),

  /** No server-side concept — kept so components written against the mock's DocsApi shape still compile. */
  async simulateAgentEdit(id: string): Promise<SaveResult> {
    const doc = await req<DocFull>(`/doc${qs({ id })}`)
    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const header = {
      title: doc.header.title,
      summary: doc.header.summary,
      status: doc.header.status,
      answers: doc.header.answers,
      refs: doc.header.refs,
    }
    const content = `${doc.content.trimEnd()}\n\n> **[DOC GAP]** *Re-verify after the latest release (simulated agent note, ${time}).*\n> Expected source: mock MCP edit.\n`
    return httpApi.save(
      { id, header, content, message: 'Flag rule for re-verification after release (simulated MCP edit)', baseRevision: doc.header.revision },
      'Claude',
      'mcp',
    )
  },

  async reset() {
    throw new ApiError('Reset only applies to the offline mock — the real API is a persistent store.', 400)
  },
}
