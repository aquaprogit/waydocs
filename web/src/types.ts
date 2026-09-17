export const DOC_KINDS = ['DomainIndex', 'Feature', 'Reference', 'QaLog', 'Backlog', 'Plan'] as const
export type DocKind = (typeof DOC_KINDS)[number]

export const DOC_STATUSES = ['Current', 'Draft', 'Deprecated'] as const
export type DocStatus = (typeof DOC_STATUSES)[number]

// Ref entity kinds are project-defined (e.g. "ticket", "service", "endpoint") — not a fixed enum.
export type RefType = string

export const MANUAL_LINK_TYPES = ['depends-on', 'related', 'supersedes', 'conflicts-with'] as const
export type ManualLinkType = (typeof MANUAL_LINK_TYPES)[number]
export const LINK_TYPES = ['part-of', 'mentions', ...MANUAL_LINK_TYPES] as const
export type LinkType = (typeof LINK_TYPES)[number]

export interface DocRef {
  type: RefType
  value: string
}

export interface DocLink {
  to: string
  type: ManualLinkType
}

export interface DocHeaderInput {
  title: string
  summary: string
  kind: DocKind
  status: DocStatus
  answers: string[]
  notCovered: string[]
  refs: DocRef[]
  links: DocLink[]
}

export interface SectionInfo {
  heading: string
  slug: string
  level: number
  tokens: number
}

// 'Claude' marks agent-authored revisions; any other string is a human author's name.
export type Author = string
export type Source = 'mcp' | 'web' | 'import'

export interface DocHeader extends DocHeaderInput {
  id: string
  domain: string
  revision: number
  currentRevision: number
  updated: string
  updatedBy: Author
  tokens: number
  headerTokens: number
  mapTokens: number
  sections: SectionInfo[]
  openGaps: number
}

export interface DocFull {
  header: DocHeader
  content: string
}

export interface Revision {
  number: number
  parent: number | null
  header: DocHeaderInput
  content: string
  message: string
  ticket: string | null
  author: Author
  source: Source
  createdUtc: string
}

export interface HistoryItem extends Omit<Revision, 'header' | 'content'> {
  title: string
  tokens: number
}

export interface SaveRequest {
  id: string
  header: DocHeaderInput
  content: string
  message: string
  ticket?: string | null
  baseRevision: number | null
}

export interface SaveResult {
  changed: boolean
  revision: number
  added: number
  removed: number
}

export interface SearchHit {
  header: DocHeader
  score: number
  field: string
  snippet: string
}

export interface GraphEdge {
  from: string
  to: string
  type: LinkType
  auto: boolean
}

export interface GraphData {
  nodes: DocHeader[]
  edges: GraphEdge[]
}

export interface TitledEdge extends GraphEdge {
  title: string
}

export interface SharedRef {
  ref: DocRef
  docs: { id: string; title: string }[]
}

export interface DocLinks {
  outgoing: TitledEdge[]
  incoming: TitledEdge[]
  sharedRefs: SharedRef[]
}

export interface ChangelogItem {
  docId: string
  title: string
  number: number
  message: string
  ticket: string | null
  author: Author
  source: Source
  createdUtc: string
}

export interface ChangelogFilter {
  sinceDays?: number | null
  ticket?: string
  includeImports?: boolean
}

export interface GapItem {
  docId: string
  title: string
  text: string
}

export type CheckKind = 'broken-link' | 'stale-path' | 'not-indexed' | 'missing-answers' | 'summary' | 'deprecated-link'

export interface CheckIssue {
  docId: string
  severity: 'error' | 'warn'
  kind: CheckKind
  detail: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
