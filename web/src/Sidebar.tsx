import { useMemo, useState } from 'react'
import { KIND_LABEL, displayName, domainColor } from './docmodel'
import { href } from './router'
import type { DocHeader } from './types'

function depth(id: string) {
  const segs = id.split('/')
  return Math.max(0, segs.length - 2 - (segs[segs.length - 1] === 'README' ? 1 : 0))
}

function label(h: DocHeader) {
  const segs = h.id.split('/')
  return segs.length === 2 && segs[1] === 'README' ? 'Overview' : displayName(h)
}

export default function Sidebar({ headers, activeId }: { headers: DocHeader[]; activeId?: string }) {
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const map = new Map<string, DocHeader[]>()
    for (const h of headers) {
      if (h.id === 'README') continue
      if (f && !`${h.title} ${h.id}`.toLowerCase().includes(f)) continue
      map.set(h.domain, [...(map.get(h.domain) ?? []), h])
    }
    return [...map.entries()].map(([domain, items]) => ({ domain, items }))
  }, [headers, filter])

  const toggle = (d: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  return (
    <aside className="sidebar">
      <input className="side-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter docs…" />
      <a className={`side-item home ${activeId === 'README' ? 'on' : ''}`} href={href('doc', 'README')}>
        Home
      </a>
      {groups.map((g) => {
        const open = !!filter || !collapsed.has(g.domain)
        return (
          <div key={g.domain} className="side-group">
            <button className="side-domain" onClick={() => toggle(g.domain)} aria-expanded={open}>
              <span className="caret">{open ? '▾' : '▸'}</span>
              <span className="dot" style={{ background: domainColor(g.domain) }} />
              <span className="dname">{g.domain}</span>
              <span className="count mono">{g.items.length}</span>
            </button>
            {open && (
              <ul>
                {g.items.map((h) => (
                  <li key={h.id}>
                    <a
                      href={href('doc', h.id)}
                      className={`side-item ${h.id === activeId ? 'on' : ''} ${h.status === 'Deprecated' ? 'deprecated' : ''}`}
                      style={{ paddingLeft: 30 + depth(h.id) * 14 }}
                      title={h.summary}
                    >
                      <span className="si-title">{label(h)}</span>
                      {h.kind !== 'Feature' && h.kind !== 'DomainIndex' && <span className="tag">{KIND_LABEL[h.kind]}</span>}
                      {h.status === 'Draft' && <span className="tag draft">Draft</span>}
                      {h.openGaps > 0 && (
                        <span className="gapdot" title={`${h.openGaps} open doc gap(s)`}>
                          {h.openGaps}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </aside>
  )
}
