import { KIND_LABEL } from './docmodel'
import type { Author, DocKind, DocStatus, Source } from './types'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function Highlight({ text, q }: { text: string; q: string }) {
  const terms = q
    .toLowerCase()
    .split(/[\s?!,.()]+/)
    .filter((t) => t.length > 2)
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map(esc).join('|')})`, 'gi')
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>
}

export function KindPill({ kind }: { kind: DocKind }) {
  return <span className={`pill kind-${kind}`}>{KIND_LABEL[kind]}</span>
}

export function StatusPill({ status }: { status: DocStatus }) {
  return status === 'Current' ? null : <span className={`pill status-${status.toLowerCase()}`}>{status}</span>
}

export function Avatar({ author }: { author: Author }) {
  return (
    <span className={`avatar ${author === 'Claude' ? 'claude' : 'human'}`} title={author}>
      {author === 'Claude' ? 'C' : 'V'}
    </span>
  )
}

export function TicketChip({ ticket }: { ticket: string | null }) {
  return ticket ? <span className="chip ticket mono">#{ticket}</span> : null
}

export function SourceTag({ source }: { source: Source }) {
  return <span className={`tag src-${source}`}>{source}</span>
}

export function Skeleton() {
  return (
    <div className="page">
      <div className="skeleton w40" />
      <div className="skeleton w70" />
      <div className="skeleton block" />
    </div>
  )
}
