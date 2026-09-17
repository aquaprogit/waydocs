import type { DocHeader, DocHeaderInput, GraphEdge, SectionInfo } from './types'

export const idToPath = (id: string) => (id === 'README' ? 'README.md' : `domains/${id}.md`)

export function pathToId(path: string): string | null {
  const p = path.replace(/\\/g, '/')
  if (p === 'README.md') return 'README'
  const m = /^domains\/(.+)\.md$/.exec(p)
  return m ? m[1] : null
}

export const domainOf = (id: string) => (id === 'README' ? 'root' : id.split('/')[0])

export const isValidId = (id: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|README))+$/.test(id)

export function isIndex(id: string) {
  return id === 'README' || id.endsWith('/README')
}

/** Folder index a doc belongs to: order/x → order/README, order/README → README. */
export function parentIndex(id: string): string | null {
  if (id === 'README') return null
  const segs = id.split('/')
  if (segs[segs.length - 1] === 'README') segs.pop()
  segs.pop()
  return segs.length ? `${segs.join('/')}/README` : 'README'
}

export function displayName(h: { id: string; title: string }) {
  return h.id === 'README' ? 'Home' : h.title
}

export type Resolved = { kind: 'doc'; id: string; anchor?: string } | { kind: 'outside'; path: string } | { kind: 'external' }

export function resolveHref(fromId: string, href: string): Resolved {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return { kind: 'external' }
  const [pathPart, anchor] = href.split('#')
  const parts = idToPath(fromId).split('/')
  parts.pop()
  for (const seg of pathPart.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (!parts.length) return { kind: 'outside', path: pathPart }
      parts.pop()
    } else parts.push(seg)
  }
  const id = pathPart.endsWith('.md') ? pathToId(parts.join('/')) : null
  return id ? { kind: 'doc', id, anchor } : { kind: 'outside', path: pathPart }
}

/** Replaces fenced code blocks with blank lines so link/heading scans ignore them. */
export function stripFences(content: string) {
  let inFence = false
  return content
    .split('\n')
    .map((l) => {
      if (/^\s*```/.test(l)) {
        inFence = !inFence
        return ''
      }
      return inFence ? '' : l
    })
    .join('\n')
}

export function markdownLinks(content: string): string[] {
  const out: string[] = []
  for (const m of stripFences(content).matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) out.push(m[1])
  return out
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4)

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9æøå]+/g, '-')
    .replace(/^-+|-+$/g, '')

const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/

export function parseSections(content: string): SectionInfo[] {
  const lines = stripFences(content).split('\n')
  const raw = content.split('\n')
  const marks: { i: number; level: number; heading: string }[] = []
  lines.forEach((l, i) => {
    const m = HEADING.exec(l)
    if (m) marks.push({ i, level: m[1].length, heading: m[2].replace(/[`*]/g, '') })
  })
  return marks.map((m, k) => {
    let end = raw.length
    for (let j = k + 1; j < marks.length; j++)
      if (marks[j].level <= m.level) {
        end = marks[j].i
        break
      }
    return {
      heading: m.heading,
      slug: slugify(m.heading),
      level: m.level,
      tokens: estimateTokens(raw.slice(m.i, end).join('\n')),
    }
  })
}

/** Returns the markdown of the named sections (matched by heading or slug), each including its sub-sections. */
export function extractSections(content: string, names: string[]): string {
  const wanted = new Set(names.map((n) => slugify(n)))
  const lines = stripFences(content).split('\n')
  const raw = content.split('\n')
  const out: string[] = []
  lines.forEach((l, i) => {
    const m = HEADING.exec(l)
    if (!m || !wanted.has(slugify(m[2]))) return
    let end = raw.length
    for (let j = i + 1; j < lines.length; j++) {
      const n = HEADING.exec(lines[j])
      if (n && n[1].length <= m[1].length) {
        end = j
        break
      }
    }
    out.push(raw.slice(i, end).join('\n').trimEnd())
  })
  return out.join('\n\n')
}

export function extractGaps(content: string): string[] {
  const lines = stripFences(content).split('\n')
  const gaps: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('[DOC GAP]')) continue
    const block = [lines[i]]
    while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) block.push(lines[++i])
    gaps.push(
      block
        .map((l) => l.replace(/^\s*>\s?/, ''))
        .join(' ')
        .replace(/\*\*\[DOC GAP\]\*\*|\[DOC GAP\]/g, '')
        .replace(/[*_`]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }
  return gaps
}

export function autoEdges(id: string, content: string, ids: Set<string>): GraphEdge[] {
  const edges: GraphEdge[] = []
  const parent = parentIndex(id)
  if (parent && ids.has(parent)) edges.push({ from: id, to: parent, type: 'part-of' })
  const seen = new Set<string>()
  for (const href of markdownLinks(content)) {
    const r = resolveHref(id, href)
    if (r.kind !== 'doc' || r.id === id || !ids.has(r.id) || seen.has(r.id)) continue
    seen.add(r.id)
    edges.push({ from: id, to: r.id, type: 'mentions' })
  }
  return edges
}

export function normalizeHeader(h: DocHeaderInput): DocHeaderInput {
  const uniq = <T,>(xs: T[], key: (x: T) => string) => {
    const seen = new Set<string>()
    return xs.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)))
  }
  return {
    title: h.title.trim(),
    summary: h.summary.trim().replace(/\s+/g, ' '),
    status: h.status,
    answers: h.answers.map((a) => a.trim()).filter(Boolean),
    refs: uniq(
      h.refs.map((r) => ({ type: r.type, value: r.value.trim() })).filter((r) => r.value),
      (r) => `${r.type}:${r.value}`,
    ),
  }
}

export const pickInput = (h: DocHeaderInput): DocHeaderInput => ({
  title: h.title,
  summary: h.summary,
  status: h.status,
  answers: [...h.answers],
  refs: h.refs.map((r) => ({ ...r })),
})

/** Header + body as one text blob so a line diff shows header changes too. */
export function serializeForDiff(h: DocHeaderInput, content: string): string {
  const list = (name: string, xs: string[]) => (xs.length ? [`${name}:`, ...xs.map((x) => `  - ${x}`)] : [`${name}: []`])
  return [
    `title: ${h.title}`,
    `summary: ${h.summary}`,
    `status: ${h.status}`,
    ...list('answers', h.answers),
    ...list(
      'refs',
      h.refs.map((r) => `${r.type}: ${r.value}`),
    ),
    '---',
    content.trimEnd(),
    '',
  ].join('\n')
}

/** One `docs_map` row — the cheapest routing view of a doc. */
export function mapEntry(h: DocHeader) {
  return { id: h.id, title: h.title, summary: h.summary, status: h.status, tokens: h.tokens }
}

/** What `get_header` / `search_docs` return to an agent — never the body. */
export function agentHeader(h: DocHeader) {
  return {
    id: h.id,
    title: h.title,
    summary: h.summary,
    status: h.status,
    answers: h.answers,
    refs: h.refs.map((r) => `${r.type}:${r.value}`),
    sections: h.sections.map((s) => ({ heading: s.heading, tokens: s.tokens })),
    tokens: h.tokens,
    revision: h.revision,
    updated: h.updated,
    openGaps: h.openGaps,
  }
}

const PALETTE = ['#3a6ea5', '#8a5a9e', '#4f7a4f', '#b0603a', '#2f8a8a', '#a5813a', '#a53a5e', '#5a6aa5', '#6a8a2f']

export function domainColor(domain: string) {
  if (domain === 'root') return '#8a7f68'
  let h = 0
  for (const c of domain) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const DOMAIN_INDEX_TEMPLATE =
  '## Purpose\n\n\n## Documentation index\n\n| Document | Topics |\n|----------|--------|\n\n## Related APIs\n\n## Related Services\n'

export const DEFAULT_TEMPLATE =
  '## Purpose\n\n\n## Main Rules\n\n\n## Edge Cases\n\n\n## Workflow\n\n1. \n\n## Related APIs\n\n\n## Related Services\n\n\n## Known Problems\n\n\n## Examples\n'

export const GAP_BLOCK = '> **[DOC GAP]** *What is unknown?*\n> Expected source: ticket #XXXX / PO contact / not yet investigated.'
