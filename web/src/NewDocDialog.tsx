import { useState } from 'react'
import { api } from './api'
import Modal from './Modal'
import { DEFAULT_TEMPLATE, DOMAIN_INDEX_TEMPLATE, slugify } from './docmodel'
import { go } from './router'
import type { DocHeader, DocHeaderInput } from './types'

const emptyHeader = (title: string, summary: string): DocHeaderInput => ({
  title,
  summary,
  status: 'Draft',
  answers: [],
  refs: [],
})

export default function NewDocDialog({ headers, onClose }: { headers: DocHeader[]; onClose: () => void }) {
  const domains = [...new Set(headers.filter((h) => h.domain !== 'root').map((h) => h.domain))]
  const [domain, setDomain] = useState(domains[0] ?? '__new')
  const [newDomain, setNewDomain] = useState('')
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dom = domain === '__new' ? slugify(newDomain) : domain
  const id = `${dom}/${slug ? slugify(slug) : slugify(title) || '…'}`
  const ready = !!dom && !!title.trim() && !!summary.trim() && !id.endsWith('…') && !busy

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      if (domain === '__new' && !headers.some((h) => h.id === `${dom}/README`))
        await api.save({
          id: `${dom}/README`,
          header: emptyHeader(newDomain.trim(), `Overview and index of the ${newDomain.trim()} domain.`),
          content: DOMAIN_INDEX_TEMPLATE,
          message: `Create domain ${dom}`,
          ticket,
          baseRevision: null,
        })
      await api.save({
        id,
        header: emptyHeader(title, summary),
        content: DEFAULT_TEMPLATE,
        message: `Create ${id}`,
        ticket,
        baseRevision: null,
      })
      onClose()
      go('edit', id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New doc"
      onClose={onClose}
      footer={
        <>
          <span className="mono muted small">{id}</span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!ready} onClick={create}>
            Create & edit
          </button>
        </>
      }
    >
      <p className="muted small">The header comes first: an agent should know what this doc is about before the body exists.</p>
      <div className="form-grid">
        <label className="field">
          <span>Domain</span>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domains.map((d) => (
              <option key={d}>{d}</option>
            ))}
            <option value="__new">New domain…</option>
          </select>
        </label>
        {domain === '__new' && (
          <label className="field">
            <span>New domain name</span>
            <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="basket" />
          </label>
        )}
        <label className="field full">
          <span>
            Title <b className="req">required</b>
          </span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Basket line types" />
        </label>
        <label className="field full">
          <span>
            File name <small className="hint">defaults to the title</small>
          </span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(title) || 'basket-line-types'} />
        </label>
        <label className="field full">
          <span>
            Summary <b className="req">required</b>
            <em className={`counter mono ${summary.length > 400 ? 'over' : ''}`}>{summary.length}/400</em>
          </span>
          <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label className="field">
          <span>Ticket</span>
          <input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="#5080" />
        </label>
      </div>
      {error && <div className="error-box">{error}</div>}
    </Modal>
  )
}
