import type { DocHeader } from './types'

export default function HeaderCard({ header: h }: { header: DocHeader }) {
  const scrollTo = (slug: string) => document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className="header-card">
      <div className="hc-top">
        <span className="hc-label">Header</span>
        <span className="muted small">
          what an agent reads first · <b className="mono">{h.headerTokens}</b> tokens vs{' '}
          <b className="mono">{h.tokens.toLocaleString()}</b> for the body
        </span>
      </div>
      <p className="hc-summary">{h.summary || <em className="muted">No summary yet.</em>}</p>

      <div className="hc-grid">
        <div>
          <h4>Answers</h4>
          {h.answers.length ? (
            <ul className="qa">
              {h.answers.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">None yet — list the questions this doc answers so agents can route to it.</p>
          )}
        </div>
        {h.notCovered.length > 0 && (
          <div>
            <h4>Not covered here</h4>
            <ul className="nc">
              {h.notCovered.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {h.sections.length > 0 && (
        <details className="hc-sections">
          <summary>
            Sections <span className="muted">({h.sections.length})</span>
          </summary>
          <ul>
            {h.sections.map((s, i) => (
              <li key={i} style={{ paddingLeft: (s.level - 2) * 16 }}>
                <button className="linklike" onClick={() => scrollTo(s.slug)}>
                  {s.heading}
                </button>
                <span className="mono muted small">{s.tokens} tok</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
