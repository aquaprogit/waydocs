import type { ReactNode } from 'react'
import { domainColor } from './docmodel'
import { href } from './router'
import type { Author, DocStatus, Source } from './types'

const humanize = (seg: string) => seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Fancy breadcrumb trail for a doc id: Home › Domain › … › current page, each folder segment linking to its
    Overview doc when one exists, with a domain-colored dot marking the domain crumb. */
export function Breadcrumbs({ id, title, ids }: { id: string; title: string; ids?: Set<string> }) {
  const crumbs: { label: string; href?: string; dot?: string }[] = [{ label: 'Home', href: id === 'README' ? undefined : href('doc', 'README') }]
  if (id !== 'README') {
    const segs = id.split('/')
    const isOverview = segs[segs.length - 1] === 'README'
    const folders = segs.slice(0, -1)
    const acc: string[] = []
    folders.forEach((seg, i) => {
      acc.push(seg)
      const folderId = `${acc.join('/')}/README`
      const isCurrent = isOverview && i === folders.length - 1
      crumbs.push({
        label: humanize(seg),
        href: !isCurrent && (!ids || ids.has(folderId)) ? href('doc', folderId) : undefined,
        dot: i === 0 ? domainColor(seg) : undefined,
      })
    })
    if (!isOverview) crumbs.push({ label: title })
  }
  return (
    <nav className="crumbs mono" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span className="crumb-seg" key={i}>
          {i > 0 && <span className="crumb-sep">/</span>}
          {c.href ? (
            <a className="crumb" href={c.href}>
              {c.dot && <span className="dot" style={{ background: c.dot }} />}
              {c.label}
            </a>
          ) : (
            <span className="crumb current">
              {c.dot && <span className="dot" style={{ background: c.dot }} />}
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

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

export function StatusPill({ status }: { status: DocStatus }) {
  return status === 'Current' ? null : <span className={`pill status-${status.toLowerCase()}`}>{status}</span>
}

export function Avatar({ author }: { author: Author }) {
  return (
    <span className={`avatar ${author === 'Claude' ? 'claude' : 'human'}`} title={author}>
      {author.charAt(0).toUpperCase()}
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

/** Full-page error/not-found state — for a failed top-level load, not a transient form/dialog error. */
export function PageState({ status, message, action }: { status?: number; message: string; action?: ReactNode }) {
  const notFound = status === 404
  return (
    <div className="page">
      <div className="page-state">
        <div className={`page-state-glyph ${notFound ? '' : 'err'}`}>{notFound ? '?' : '!'}</div>
        <h2>{notFound ? 'Not found' : 'Something went wrong'}</h2>
        <p>{message}</p>
        {action && <div className="page-state-action">{action}</div>}
      </div>
    </div>
  )
}
