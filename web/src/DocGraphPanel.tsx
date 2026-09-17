import { useState } from 'react'
import { href } from './router'
import type { DocHeader, DocLinks, DocRef, LinkType } from './types'

// Short labels for a few common ref kinds; any other project-defined type falls back to its own name.
const REF_ICON: Record<string, string> = { ticket: '#', service: 'svc', endpoint: 'api' }

const INCOMING: Record<LinkType, string> = {
  'part-of': 'contains',
  mentions: 'mentioned by',
  related: 'related',
  'depends-on': 'needed by',
  supersedes: 'superseded by',
  'conflicts-with': 'conflicts with',
}

/** Refs and graph links — secondary metadata a reader rarely needs first, so this sits below the body rather
 *  than above it (unlike HeaderCard, which is what an agent or a skimming reader wants up front). */
export default function DocGraphPanel({ header: h, links }: { header: DocHeader; links?: DocLinks }) {
  const [openRef, setOpenRef] = useState<string | null>(null)
  const shared = (r: DocRef) => links?.sharedRefs.find((s) => s.ref.type === r.type && s.ref.value === r.value)
  const manualOut = links?.outgoing.filter((e) => !e.auto) ?? []
  const autoOut = links?.outgoing.filter((e) => e.auto) ?? []
  const incoming = links?.incoming ?? []

  if (!h.refs.length && manualOut.length + autoOut.length + incoming.length === 0) return null

  return (
    <section className="graph-panel">
      {h.refs.length > 0 && (
        <div className="hc-row">
          <h4>Refs</h4>
          <div className="chips">
            {h.refs.map((r) => {
              const key = `${r.type}:${r.value}`
              const s = shared(r)
              return (
                <span key={key} className="ref-wrap">
                  <button
                    className={`chip ref ref-${r.type} ${s ? 'shared' : ''}`}
                    onClick={() => s && setOpenRef(openRef === key ? null : key)}
                    title={s ? `Also in ${s.docs.length} other doc(s) — click to see` : 'Only this doc'}
                  >
                    <span className="ref-t">{REF_ICON[r.type] ?? r.type}</span>
                    {r.value}
                    {s && <span className="ref-n">+{s.docs.length}</span>}
                  </button>
                  {openRef === key && s && (
                    <div className="popover" onMouseLeave={() => setOpenRef(null)}>
                      <div className="muted small">Also referenced by</div>
                      {s.docs.map((d) => (
                        <a key={d.id} href={href('doc', d.id)}>
                          {d.title}
                          <span className="mono muted"> {d.id}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {manualOut.length + autoOut.length + incoming.length > 0 && (
        <div className="hc-row">
          <h4>Graph</h4>
          <div className="chips">
            {manualOut.map((e) => (
              <a key={`o-${e.type}-${e.to}`} className={`chip link lt-${e.type}`} href={href('doc', e.to)}>
                <span className="lt">{e.type} →</span>
                {e.title}
              </a>
            ))}
            {autoOut.map((e) => (
              <a key={`a-${e.type}-${e.to}`} className="chip link auto" href={href('doc', e.to)}>
                <span className="lt">{e.type} →</span>
                {e.title}
              </a>
            ))}
            {incoming.map((e) => (
              <a key={`i-${e.type}-${e.from}`} className={`chip link in ${e.auto ? 'auto' : `lt-${e.type}`}`} href={href('doc', e.from)}>
                <span className="lt">← {INCOMING[e.type]}</span>
                {e.title}
              </a>
            ))}
            <a className="chip ghost" href={href('graph', undefined, { focus: h.id })}>
              Open in graph ↗
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
