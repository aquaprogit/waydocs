import { useState } from 'react'
import { api } from './api'
import DiffView from './DiffView'
import Modal from './Modal'
import { relTime } from './docmodel'
import { useAsync } from './hooks'
import { href } from './router'
import { Avatar, Skeleton, SourceTag, TicketChip } from './ui'

export default function HistoryPage({ id, version }: { id: string; version: number }) {
  const hist = useAsync(() => api.history(id), [id, version])
  const [to, setTo] = useState<number | null>(null)
  const [fromSel, setFromSel] = useState<number | null>(null)
  const [revertOf, setRevertOf] = useState<number | null>(null)

  const items = hist.data ?? []
  const latest = items[0]?.number ?? 0
  const toN = to && to <= latest ? to : latest
  const fromN = fromSel !== null && fromSel < toN ? fromSel : Math.max(0, toN - 1)
  const diff = useAsync(() => (toN ? api.diff(id, fromN, toN) : Promise.resolve(null)), [id, fromN, toN, version])

  if (hist.error)
    return (
      <div className="page">
        <div className="error-box">{hist.error}</div>
      </div>
    )
  if (!hist.data) return <Skeleton />

  return (
    <div className="page history-page">
      <div className="doc-top">
        <div className="crumbs mono">{id}</div>
        <div className="doc-actions">
          <a className="btn" href={href('doc', id)}>
            ← Back to doc
          </a>
        </div>
      </div>
      <h1 className="doc-title">
        {items[0]?.title} <span className="muted light">· history</span>
      </h1>

      <div className="hist-grid">
        <ol className="hist-list">
          {items.map((r) => (
            <li
              key={r.number}
              className={r.number === toN ? 'on' : ''}
              onClick={() => {
                setTo(r.number)
                setFromSel(null)
              }}
            >
              <div className="hl-top">
                <span className="rev mono">r{r.number}</span>
                <span className="hl-msg">{r.message}</span>
              </div>
              <div className="hl-meta">
                <Avatar author={r.author} />
                <SourceTag source={r.source} />
                <TicketChip ticket={r.ticket} />
                <span className="muted small">{relTime(r.createdUtc)}</span>
                <span className="spacer" />
                <a className="linklike small" href={href('doc', id, { rev: r.number })} onClick={(e) => e.stopPropagation()}>
                  view
                </a>
                {r.number !== latest && (
                  <button
                    className="linklike small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRevertOf(r.number)
                    }}
                  >
                    revert to this
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="hist-diff">
          <div className="hd-head">
            <span className="muted">Compare</span>
            <select value={fromN} onChange={(e) => setFromSel(Number(e.target.value))}>
              {[0, ...items.map((i) => i.number)]
                .filter((n) => n < toN)
                .sort((a, b) => b - a)
                .map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? '(empty)' : `r${n}`}
                  </option>
                ))}
            </select>
            <span>
              → <b className="mono">r{toN}</b>
            </span>
            <span className="muted small">header fields are diffed above the --- line</span>
          </div>
          {diff.data ? <DiffView before={diff.data.before} after={diff.data.after} /> : <div className="skeleton block" />}
        </div>
      </div>

      {revertOf !== null && (
        <RevertDialog
          id={id}
          to={revertOf}
          onClose={() => setRevertOf(null)}
          onDone={() => {
            setRevertOf(null)
            setTo(null)
          }}
        />
      )}
    </div>
  )
}

function RevertDialog({ id, to, onClose, onDone }: { id: string; to: number; onClose: () => void; onDone: () => void }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await api.revert(id, to, message)
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={`Revert to r${to}`}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!message.trim() || busy} onClick={submit}>
            Create revert revision
          </button>
        </>
      }
    >
      <p className="muted">History stays intact — this adds a new revision with the content of r{to}.</p>
      <label className="field full">
        <span>
          Reason <b className="req">required</b>
        </span>
        <input autoFocus value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Agent edit was wrong about …" />
      </label>
      {error && <div className="error-box">{error}</div>}
    </Modal>
  )
}
