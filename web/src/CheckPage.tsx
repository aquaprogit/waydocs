import { useState } from 'react'
import { api } from './api'
import { useAsync } from './hooks'
import { href } from './router'
import type { CheckKind } from './types'

const KIND_TITLE: Record<CheckKind, string> = {
  'broken-link': 'Broken links',
  summary: 'Summary problems',
  'stale-path': 'Stale paths (.cursor/, outside docs)',
  'not-indexed': 'Not linked from any doc',
  'missing-answers': 'Header lists no answers',
  'deprecated-link': 'Links to deprecated docs',
}

type Tab = 'problems' | 'gaps' | 'headers'

export default function CheckPage({ version }: { version: number }) {
  const issues = useAsync(() => api.check(), [version])
  const gaps = useAsync(() => api.gaps(), [version])
  const docs = useAsync(() => api.listDocs(), [version])
  const [tab, setTab] = useState<Tab>('problems')

  const list = issues.data ?? []
  const errors = list.filter((i) => i.severity === 'error').length
  const warns = list.length - errors
  const all = docs.data ?? []
  const complete = all.filter((d) => d.answers.length > 0 && d.summary).length
  const byKind = new Map<CheckKind, typeof list>()
  for (const i of list) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i])

  return (
    <div className="page">
      <h1 className="doc-title">Check</h1>
      <p className="muted">
        What <span className="mono">check_docs</span> will report. The server adds staleness: docs whose referenced services
        changed in the source repo since the doc was last verified.
      </p>
      <div className="tiles">
        <button className={`tile ${tab === 'problems' ? 'on' : ''}`} onClick={() => setTab('problems')}>
          <span className="tile-n err">{errors}</span>
          <span>errors</span>
        </button>
        <button className={`tile ${tab === 'problems' ? 'on' : ''}`} onClick={() => setTab('problems')}>
          <span className="tile-n warn">{warns}</span>
          <span>warnings</span>
        </button>
        <button className={`tile ${tab === 'gaps' ? 'on' : ''}`} onClick={() => setTab('gaps')}>
          <span className="tile-n">{gaps.data?.length ?? 0}</span>
          <span>open [DOC GAP]s</span>
        </button>
        <button className={`tile ${tab === 'headers' ? 'on' : ''}`} onClick={() => setTab('headers')}>
          <span className="tile-n">
            {complete}/{all.length}
          </span>
          <span>headers complete</span>
        </button>
      </div>

      {tab === 'problems' &&
        [...byKind.entries()].map(([kind, items]) => (
          <section key={kind} className="check-group">
            <h3>
              {KIND_TITLE[kind]} <span className="muted">({items.length})</span>
            </h3>
            <ul className="check-list">
              {items.map((i, n) => (
                <li key={n}>
                  <span className={`sev ${i.severity}`} />
                  <a className="mono" href={href('doc', i.docId)}>
                    {i.docId}
                  </a>
                  <span>{i.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {tab === 'gaps' && (
        <ul className="check-list gaps">
          {(gaps.data ?? []).map((g, n) => (
            <li key={n}>
              <span className="sev gap" />
              <a href={href('doc', g.docId)}>{g.title}</a>
              <span>{g.text}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === 'headers' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Doc</th>
                <th className="num">Summary</th>
                <th className="num">Answers</th>
                <th className="num">Refs</th>
                <th className="num">Links</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {all.map((d) => (
                <tr key={d.id} className={d.answers.length ? '' : 'incomplete'}>
                  <td>
                    <a href={href('doc', d.id)}>{d.title}</a>
                    <div className="mono muted small">{d.id}</div>
                  </td>
                  <td className="num mono">{d.summary.length}</td>
                  <td className="num mono">{d.answers.length || '—'}</td>
                  <td className="num mono">{d.refs.length}</td>
                  <td className="num mono">{d.links.length}</td>
                  <td>
                    <a className="btn small" href={href('edit', d.id)}>
                      Edit header
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
