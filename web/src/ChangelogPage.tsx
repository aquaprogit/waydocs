import { useState } from 'react'
import { api } from './api'
import { relTime } from './docmodel'
import { useAsync } from './hooks'
import { href } from './router'
import type { ChangelogItem } from './types'
import { Avatar, SourceTag, TicketChip } from './ui'

const SINCE: [string, number | null][] = [
  ['7 days', 7],
  ['30 days', 30],
  ['All time', null],
]

export default function ChangelogPage({ version }: { version: number }) {
  const [since, setSince] = useState<number | null>(null)
  const [ticket, setTicket] = useState('')
  const [imports, setImports] = useState(false)
  const log = useAsync(() => api.changelog({ sinceDays: since, ticket, includeImports: imports }), [since, ticket, imports, version])

  const groups = new Map<string, ChangelogItem[]>()
  for (const i of log.data ?? []) {
    const day = new Date(i.createdUtc).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    groups.set(day, [...(groups.get(day) ?? []), i])
  }

  return (
    <div className="page">
      <h1 className="doc-title">Changelog</h1>
      <p className="muted">Every revision across all docs, newest first. Each carries its change message and ticket.</p>
      <div className="filters">
        <div className="seg">
          {SINCE.map(([label, v]) => (
            <button key={label} className={since === v ? 'on' : ''} onClick={() => setSince(v)}>
              {label}
            </button>
          ))}
        </div>
        <input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="Filter by ticket, e.g. 4936" />
        <label className="check-inline">
          <input type="checkbox" checked={imports} onChange={(e) => setImports(e.target.checked)} /> include initial imports
        </label>
      </div>

      {log.data && !log.data.length && (
        <div className="empty-state">
          No revisions match. Edit a doc, create a link in the graph, or use <b>Mock data → Simulate Claude MCP edit</b>.
        </div>
      )}

      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="cl-day">
          <h3>{day}</h3>
          <ul className="cl-list">
            {items.map((i) => (
              <li key={`${i.docId}-${i.number}`}>
                <Avatar author={i.author} />
                <div className="cl-main">
                  <div>
                    <a href={href('doc', i.docId)} className="cl-doc">
                      {i.title}
                    </a>{' '}
                    <a className="rev mono" href={href('history', i.docId)}>
                      r{i.number}
                    </a>
                  </div>
                  <div className="cl-msg">{i.message}</div>
                </div>
                <div className="cl-meta">
                  <TicketChip ticket={i.ticket} />
                  <SourceTag source={i.source} />
                  <span className="muted small">{relTime(i.createdUtc)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
