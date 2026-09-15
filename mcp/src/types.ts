export interface DocRef {
  type: 'ticket' | 'service' | 'endpoint' | 'dbObject' | 'd365Entity'
  value: string
}

export interface DocLink {
  to: string
  type: 'depends-on' | 'related' | 'supersedes' | 'conflicts-with'
}

export interface SectionInfo {
  heading: string
  slug: string
  level: number
  tokens: number
}

export interface DocHeader {
  id: string
  domain: string
  title: string
  summary: string
  kind: 'DomainIndex' | 'Feature' | 'Reference' | 'QaLog' | 'Backlog' | 'Plan'
  status: 'Current' | 'Draft' | 'Deprecated'
  answers: string[]
  notCovered: string[]
  refs: DocRef[]
  links: DocLink[]
  revision: number
  currentRevision: number
  updated: string
  updatedBy: 'Claude' | 'Vladyslav'
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

export interface HistoryItem {
  number: number
  parent: number | null
  title: string
  tokens: number
  message: string
  ticket: string | null
  author: string
  source: string
  createdUtc: string
}

export interface GraphEdge {
  from: string
  to: string
  type: string
  auto: boolean
}

export interface GraphData {
  nodes: DocHeader[]
  edges: GraphEdge[]
}

export interface DocLinks {
  outgoing: (GraphEdge & { title: string })[]
  incoming: (GraphEdge & { title: string })[]
  sharedRefs: { ref: DocRef; docs: { id: string; title: string }[] }[]
}

export interface ChangelogItem {
  docId: string
  title: string
  number: number
  message: string
  ticket: string | null
  author: string
  source: string
  createdUtc: string
}

export interface GapItem {
  docId: string
  title: string
  text: string
}

export interface CheckIssue {
  docId: string
  severity: 'error' | 'warn'
  kind: string
  detail: string
}

export interface SaveResult {
  changed: boolean
  revision: number
  added: number
  removed: number
}

export interface DocHeaderInput {
  title: string
  summary: string
  kind: DocHeader['kind']
  status: DocHeader['status']
  answers: string[]
  notCovered: string[]
  refs: DocRef[]
  links: DocLink[]
}
