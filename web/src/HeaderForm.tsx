import { useState } from 'react'
import { DOC_STATUSES, type DocHeaderInput, type DocRef, type RefType } from './types'

interface Props {
  value: DocHeaderInput
  onChange: (h: DocHeaderInput) => void
  known?: Record<RefType, string[]>
}

export default function HeaderForm({ value: v, onChange, known }: Props) {
  const set = <K extends keyof DocHeaderInput>(k: K, val: DocHeaderInput[K]) => onChange({ ...v, [k]: val })
  const over = v.summary.length > 400

  return (
    <div className="hform">
      <label className="field title-field">
        <span>Title</span>
        <input value={v.title} onChange={(e) => set('title', e.target.value)} />
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
        placeholder="What triggers a refund on a cancelled order?"
        onChange={(a) => set('answers', a)}
      />
      <RefsEditor refs={v.refs} known={known} onChange={(r) => set('refs', r)} />
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
  const knownTypes = Object.keys(known ?? {})
  const [type, setType] = useState<RefType>(knownTypes[0] ?? 'ticket')
  const [val, setVal] = useState('')
  const add = () => {
    const value = val.trim().replace(/^#/, '')
    const t = type.trim()
    if (!value || !t) return
    if (!refs.some((r) => r.type === t && r.value === value)) onChange([...refs, { type: t, value }])
    setVal('')
  }
  return (
    <div className="field full">
      <span className="flabel">
        Refs <small className="hint">shared entities (tickets, services, endpoints, or any project-defined kind) — shared graph nodes</small>
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
        <input
          list="known-ref-types"
          className="ref-type-input"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="type"
        />
        <datalist id="known-ref-types">
          {knownTypes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <input
          list="known-refs"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Name"
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
