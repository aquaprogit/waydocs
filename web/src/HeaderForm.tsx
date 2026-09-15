import { useState } from 'react'
import { KIND_LABEL } from './docmodel'
import {
  DOC_KINDS,
  DOC_STATUSES,
  MANUAL_LINK_TYPES,
  REF_TYPES,
  type DocHeader,
  type DocHeaderInput,
  type DocLink,
  type DocRef,
  type ManualLinkType,
  type RefType,
} from './types'

interface Props {
  value: DocHeaderInput
  onChange: (h: DocHeaderInput) => void
  docId: string
  headers: DocHeader[]
  known?: Record<RefType, string[]>
}

export default function HeaderForm({ value: v, onChange, docId, headers, known }: Props) {
  const set = <K extends keyof DocHeaderInput>(k: K, val: DocHeaderInput[K]) => onChange({ ...v, [k]: val })
  const over = v.summary.length > 400

  return (
    <div className="hform">
      <label className="field title-field">
        <span>Title</span>
        <input value={v.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label className="field">
        <span>Kind</span>
        <select value={v.kind} onChange={(e) => set('kind', e.target.value as DocHeaderInput['kind'])}>
          {DOC_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select value={v.status} onChange={(e) => set('status', e.target.value as DocHeaderInput['status'])}>
          {DOC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="field full">
        <span>
          Summary <b className="req">required</b>
          <em className={`counter mono ${over ? 'over' : ''}`}>{v.summary.length}/400</em>
        </span>
        <textarea rows={3} value={v.summary} onChange={(e) => set('summary', e.target.value)} />
        <small className="hint">1–3 sentences. An agent reads this to decide whether to open the doc at all.</small>
      </label>

      <ListEditor
        label="Answers"
        hint="questions this doc answers (max 8)"
        items={v.answers}
        max={8}
        placeholder="When is DiscountReference sent to D365?"
        onChange={(a) => set('answers', a)}
      />
      <ListEditor
        label="Not covered here"
        hint="nearby topics that live elsewhere"
        items={v.notCovered}
        placeholder="Basket lines → order/basket"
        onChange={(a) => set('notCovered', a)}
      />
      <RefsEditor refs={v.refs} known={known} onChange={(r) => set('refs', r)} />
      <LinksEditor links={v.links} docId={docId} headers={headers} onChange={(l) => set('links', l)} />
    </div>
  )
}

function ListEditor(props: {
  label: string
  hint: string
  items: string[]
  max?: number
  placeholder: string
  onChange: (items: string[]) => void
}) {
  const { label, hint, items, max, placeholder, onChange } = props
  return (
    <div className="field full">
      <span className="flabel">
        {label} <small className="hint">{hint}</small>
      </span>
      {items.map((it, i) => (
        <div className="list-row" key={i}>
          <span className="list-bullet">{i + 1}</span>
          <input
            value={it}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove">
            ×
          </button>
        </div>
      ))}
      {(!max || items.length < max) && (
        <button className="btn small ghost add-btn" onClick={() => onChange([...items, ''])}>
          + Add
        </button>
      )}
    </div>
  )
}

function RefsEditor({ refs, known, onChange }: { refs: DocRef[]; known?: Record<RefType, string[]>; onChange: (r: DocRef[]) => void }) {
  const [type, setType] = useState<RefType>('service')
  const [val, setVal] = useState('')
  const add = () => {
    const value = val.trim().replace(/^#/, '')
    if (!value) return
    if (!refs.some((r) => r.type === type && r.value === value)) onChange([...refs, { type, value }])
    setVal('')
  }
  return (
    <div className="field full">
      <span className="flabel">
        Refs <small className="hint">tickets, services, endpoints, DB / D365 objects — shared graph nodes</small>
      </span>
      <div className="chips">
        {refs.map((r) => (
          <span key={`${r.type}:${r.value}`} className={`chip ref ref-${r.type}`}>
            <span className="ref-t">{r.type}</span>
            {r.value}
            <button className="chip-x" onClick={() => onChange(refs.filter((x) => x !== r))} aria-label={`Remove ${r.value}`}>
              ×
            </button>
          </span>
        ))}
        {!refs.length && <span className="muted small">No refs</span>}
      </div>
      <div className="add-row">
        <select value={type} onChange={(e) => setType(e.target.value as RefType)}>
          {REF_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          list="known-refs"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={type === 'ticket' ? '4936' : type === 'endpoint' ? 'GET /api/…' : 'Name'}
        />
        <datalist id="known-refs">
          {(known?.[type] ?? []).map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <button className="btn small" onClick={add}>
          Add ref
        </button>
      </div>
    </div>
  )
}

function LinksEditor(props: { links: DocLink[]; docId: string; headers: DocHeader[]; onChange: (l: DocLink[]) => void }) {
  const { links, docId, headers, onChange } = props
  const [type, setType] = useState<ManualLinkType>('related')
  const [to, setTo] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const others = headers.filter((h) => h.id !== docId)
  const title = (id: string) => headers.find((h) => h.id === id)?.title ?? id
  const add = () => {
    const t = to.trim()
    if (!t) return
    if (!others.some((h) => h.id === t)) return setErr(`No doc '${t}'`)
    if (links.some((l) => l.to === t && l.type === type)) return setErr('Already linked')
    onChange([...links, { to: t, type }])
    setTo('')
    setErr(null)
  }
  return (
    <div className="field full">
      <span className="flabel">
        Links <small className="hint">typed edges to other docs · part-of and mentions are automatic</small>
      </span>
      <div className="chips">
        {links.map((l) => (
          <span key={`${l.type}:${l.to}`} className={`chip link lt-${l.type}`}>
            <span className="lt">{l.type} →</span>
            {title(l.to)}
            <button className="chip-x" onClick={() => onChange(links.filter((x) => x !== l))} aria-label={`Remove link to ${l.to}`}>
              ×
            </button>
          </span>
        ))}
        {!links.length && <span className="muted small">No typed links</span>}
      </div>
      <div className="add-row">
        <select value={type} onChange={(e) => setType(e.target.value as ManualLinkType)}>
          {MANUAL_LINK_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          list="doc-ids"
          value={to}
          onChange={(e) => (setTo(e.target.value), setErr(null))}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="domain/doc-id"
        />
        <datalist id="doc-ids">
          {others.map((h) => (
            <option key={h.id} value={h.id} label={h.title} />
          ))}
        </datalist>
        <button className="btn small" onClick={add}>
          Add link
        </button>
        {err && <span className="field-err">{err}</span>}
      </div>
    </div>
  )
}
