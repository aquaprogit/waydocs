import { useState } from 'react'
import { agentHeader, estimateTokens, extractSections, mapEntry } from './docmodel'
import type { DocHeader } from './types'

export default function AgentView({ header, content }: { header: DocHeader; content: string }) {
  const [picked, setPicked] = useState<string[]>([])
  const payload = JSON.stringify(agentHeader(header), null, 2)
  const sectionText = picked.length ? extractSections(content, picked) : ''
  const toggle = (heading: string) =>
    setPicked((p) => (p.includes(heading) ? p.filter((x) => x !== heading) : [...p, heading]))

  return (
    <div className="agent-view">
      <p className="muted">
        What the MCP server returns at each step. Agents always start at step 1 and only go further when the header says the
        doc is relevant.
      </p>

      <div className="av-step">
        <span className="av-n">0</span>
        <div className="av-text">
          <b className="mono">docs_map()</b> — this doc's row among all docs (id, title, summary, status, tokens)
        </div>
        <span className="av-tok mono">{header.mapTokens} tok</span>
      </div>
      <pre className="code">{JSON.stringify(mapEntry(header), null, 2)}</pre>

      <div className="av-step">
        <span className="av-n">1</span>
        <div className="av-text">
          <b className="mono">get_header("{header.id}")</b> — also what <span className="mono">search_docs</span> /{' '}
          <span className="mono">find_docs</span> return per doc
        </div>
        <span className="av-tok mono">{header.headerTokens} tok</span>
      </div>
      <pre className="code">{payload}</pre>

      <div className="av-step">
        <span className="av-n">2</span>
        <div className="av-text">
          <b className="mono">get_doc("{header.id}", sections=[…])</b> — pull only the sections the question needs
        </div>
        <span className="av-tok mono">{sectionText ? estimateTokens(sectionText) : 0} tok</span>
      </div>
      <div className="chips">
        {header.sections
          .filter((s) => s.level === 2)
          .map((s) => (
            <label key={s.slug} className={`chip check ${picked.includes(s.heading) ? 'on' : ''}`}>
              <input type="checkbox" checked={picked.includes(s.heading)} onChange={() => toggle(s.heading)} />
              {s.heading} <span className="mono muted">{s.tokens}</span>
            </label>
          ))}
      </div>
      {sectionText && <pre className="code">{sectionText}</pre>}

      <div className="av-step">
        <span className="av-n">3</span>
        <div className="av-text">
          <b className="mono">get_doc("{header.id}")</b> — full body, only when really needed
        </div>
        <span className="av-tok mono">{header.tokens.toLocaleString()} tok</span>
      </div>
    </div>
  )
}
