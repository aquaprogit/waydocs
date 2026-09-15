import type {
  ChangelogItem,
  CheckIssue,
  DocFull,
  DocHeader,
  DocHeaderInput,
  DocLinks,
  GapItem,
  GraphData,
  HistoryItem,
  SaveResult,
} from './types.js'

const BASE = (process.env.SD_DOCS_API_URL || 'http://localhost:5180').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch (e) {
    throw new ApiError(
      `Cannot reach the SD Docs API at ${BASE}. Start it with ` +
        '`dotnet run` in server/SdDocs.Api (or set SD_DOCS_API_URL). ' +
        `Underlying error: ${(e as Error).message}`,
    )
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await call(path, init)
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      detail = JSON.parse(text).error || text
    } catch {
      /* keep raw text */
    }
    throw new ApiError(`${res.status} ${res.statusText}: ${detail}`, res.status)
  }
  return (text ? JSON.parse(text) : undefined) as T
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

export interface SaveRequest {
  id: string
  header: DocHeaderInput
  content: string
  message: string
  ticket?: string | null
  baseRevision: number | null
}

export const api = {
  base: BASE,

  listDocs: () => req<DocHeader[]>('/docs'),
  getDoc: (id: string, rev?: number) => req<DocFull>(`/doc${qs({ id, rev })}`),
  getSections: (id: string, headings: string[]) =>
    req<{ content: string; tokens: number }>(`/doc/sections${qs({ id })}`, { method: 'POST', body: JSON.stringify({ headings }) }),
  search: (q: string, headersOnly: boolean, limit: number) =>
    req<{ header: DocHeader; score: number; field: string; snippet: string }[]>(`/search${qs({ q, headersOnly, limit })}`),
  find: (type: string, value: string) => req<DocHeader[]>(`/find${qs({ type, value })}`),
  graph: () => req<GraphData>('/graph'),
  links: (id: string) => req<DocLinks>(`/links${qs({ id })}`),
  history: (id: string) => req<HistoryItem[]>(`/history${qs({ id })}`),
  diff: (id: string, from: number, to: number) => req<{ before: string; after: string }>(`/diff${qs({ id, from, to })}`),
  changelog: (sinceDays?: number, ticket?: string, includeImports?: boolean) =>
    req<ChangelogItem[]>(`/changelog${qs({ sinceDays, ticket, includeImports })}`),
  gaps: () => req<GapItem[]>('/gaps'),
  check: () => req<CheckIssue[]>('/check'),

  save: (request: SaveRequest) =>
    req<SaveResult>(`/doc${qs({ author: 'Claude', source: 'mcp' })}`, { method: 'PUT', body: JSON.stringify(request) }),
  link: (from: string, to: string, type: string, message: string) =>
    req<SaveResult>(`/link${qs({ author: 'Claude', source: 'mcp' })}`, { method: 'POST', body: JSON.stringify({ from, to, type, message }) }),
  revert: (id: string, to: number, message: string) =>
    req<SaveResult>(`/revert${qs({ id, author: 'Claude', source: 'mcp' })}`, { method: 'POST', body: JSON.stringify({ to, message }) }),
}
