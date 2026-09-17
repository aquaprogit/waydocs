import { useMemo, useState } from 'react'
import { displayName, domainColor } from './docmodel'
import { href } from './router'
import type { DocHeader } from './types'

function depth(id: string) {
  const segs = id.split('/')
  return Math.max(0, segs.length - 2 - (segs[segs.length - 1] === 'README' ? 1 : 0))
}

function label(h: DocHeader) {
  return displayName(h)
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
        const overview = g.items.find((h) => h.id === `${g.domain}/README`)
        const children = overview ? g.items.filter((h) => h.id !== overview.id) : g.items
        return (
          <div key={g.domain} className="side-group">
            <div className="side-domain">
              <button
                className="side-caret"
                onClick={() => toggle(g.domain)}
                aria-expanded={open}
                aria-label={open ? `Collapse ${g.domain}` : `Expand ${g.domain}`}
              >
                <span className={`caret ${open ? 'open' : ''}`}>›</span>
              </button>
              {overview ? (
                <a href={href('doc', overview.id)} className={`side-domain-link ${overview.id === activeId ? 'on' : ''}`} title={overview.summary}>
                  <span className="dot" style={{ background: domainColor(g.domain) }} />
                  <span className="dname">{g.domain}</span>
                </a>
              ) : (
                <button className="side-domain-link" onClick={() => toggle(g.domain)}>
                  <span className="dot" style={{ background: domainColor(g.domain) }} />
                  <span className="dname">{g.domain}</span>
                </button>
              )}
              <span className="count mono">{g.items.length}</span>
            </div>
            {open && (
              <ul>
                {children.map((h) => (
                  <li key={h.id}>
                    <a
                      href={href('doc', h.id)}
                      className={`side-item ${h.id === activeId ? 'on' : ''} ${h.status === 'Deprecated' ? 'deprecated' : ''}`}
                      style={{ paddingLeft: 8 + depth(h.id) * 14 }}
                      title={h.summary}
                    >
                      <span className="si-title">{label(h)}</span>
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
