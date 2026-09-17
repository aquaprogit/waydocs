import { useEffect, useState } from 'react'
import { api } from './api'
import { href } from './router'
import type { DocHeader, SearchHit } from './types'
import { Highlight } from './ui'

export default function AgentMapPage({ headers }: { headers: DocHeader[] }) {
  const [q, setQ] = useState('What triggers a refund on a cancelled order?')
  const [hits, setHits] = useState<SearchHit[]>([])

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim()) api.search(q, { headersOnly: true, limit: 5 }).then(setHits)
      else setHits([])
    }, 150)
    return () => clearTimeout(t)
  }, [q])

  const mapTok = headers.reduce((n, h) => n + h.mapTokens, 0)
  const headerTok = headers.reduce((n, h) => n + h.headerTokens, 0)
  const bodyTok = headers.reduce((n, h) => n + h.tokens, 0)
  const top = hits[0]?.header
  const pulled = top ? top.headerTokens + top.tokens : 0

  return (
    <div className="page">
      <h1 className="doc-title">Agent map</h1>
      <p className="muted">
        What <span className="mono">docs_map()</span> gives an agent: every header, no bodies. The agent picks docs from here and
        then loads only those.
      </p>

      <div className="tiles">
        <div className="tile static">
          <span className="tile-n">{headers.length}</span>
          <span>docs</span>
        </div>
        <div className="tile static">
          <span className="tile-n ok">{mapTok.toLocaleString()}</span>
          <span>tokens · docs_map() of everything</span>
        </div>
        <div className="tile static">
          <span className="tile-n">{headerTok.toLocaleString()}</span>
          <span>tokens · every full header</span>
        </div>
        <div className="tile static">
          <span className="tile-n">{bodyTok.toLocaleString()}</span>
          <span>tokens · every body</span>
        </div>
      </div>

      <section className="try-box">
        <label className="field full">
          <span>Try a question — ranked on headers only (title, summary, answers, refs)</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {hits.length > 0 ? (
          <>
            <ol className="try-hits">
              {hits.map((h, i) => (
                <li key={h.header.id} className={i === 0 ? 'top' : ''}>
                  <a href={href('doc', h.header.id, { tab: 'agent' })}>{h.header.title}</a>
                  <span className="mono muted small"> {h.header.id}</span>
                  <div className="small">
                    <span className="muted">matched in {h.field}: </span>
                    <Highlight text={h.snippet} q={q} />
                  </div>
                  <span className="mono small try-tok">
                    {h.header.headerTokens} → {h.header.tokens.toLocaleString()} tok
                  </span>
                </li>
              ))}
            </ol>
            <p className="small">
              Agent reads the map (<b className="mono">{mapTok.toLocaleString()}</b>), then the top doc's header and body (
              <b className="mono">{pulled.toLocaleString()}</b>) — about{' '}
              <b className="mono">{(mapTok + pulled).toLocaleString()}</b> tokens instead of{' '}
              <b className="mono">{bodyTok.toLocaleString()}</b> for reading everything (
              {Math.round(bodyTok / Math.max(mapTok + pulled, 1))}× less).
            </p>
          </>
        ) : (
          q.trim() && <p className="muted small">No header matches — a sign that some headers need better answers or refs.</p>
        )}
      </section>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Doc</th>
              <th>Summary</th>
              <th className="num">Answers</th>
              <th className="num">Map tok</th>
              <th className="num">Header tok</th>
              <th className="num">Body tok</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h) => (
              <tr key={h.id}>
                <td>
                  <a href={href('doc', h.id, { tab: 'agent' })}>{h.title}</a>
                  <div className="mono muted small">{h.id}</div>
                </td>
                <td className="clamp small">{h.summary}</td>
                <td className="num mono">{h.answers.length || '—'}</td>
                <td className="num mono">{h.mapTokens}</td>
                <td className="num mono">{h.headerTokens}</td>
                <td className="num mono">{h.tokens.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
