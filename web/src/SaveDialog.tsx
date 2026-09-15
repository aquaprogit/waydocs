import { useState } from 'react'
import DiffView from './DiffView'
import Modal from './Modal'

interface Props {
  before: string
  after: string
  busy: boolean
  error: string | null
  conflict: boolean
  onRebase: () => void
  onCancel: () => void
  onConfirm: (message: string, ticket: string | null) => void
}

export default function SaveDialog({ before, after, busy, error, conflict, onRebase, onCancel, onConfirm }: Props) {
  const [message, setMessage] = useState('')
  const [ticket, setTicket] = useState('')
  const canSave = !!message.trim() && !busy
  const submit = () => canSave && onConfirm(message.trim(), ticket.trim().replace(/^#/, '') || null)

  return (
    <Modal
      title="Save new revision"
      onClose={onCancel}
      wide
      footer={
        <>
          <span className="muted small">Ctrl+Enter to save</span>
          <span className="spacer" />
          <button className="btn" onClick={onCancel}>
            Keep editing
          </button>
          <button className="btn primary" disabled={!canSave} onClick={submit}>
            {busy ? 'Saving…' : 'Save revision'}
          </button>
        </>
      }
    >
      <div className="save-diff">
        <DiffView before={before} after={after} />
      </div>
      <div className="save-fields">
        <label className="field grow">
          <span>
            Change message <b className="req">required</b>
          </span>
          <textarea
            autoFocus
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
            }}
            placeholder="Why did this change? e.g. Product owner check removed — role is now the only gate"
          />
        </label>
        <label className="field ticket-field">
          <span>Ticket</span>
          <input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="#4936" />
        </label>
      </div>
      {error && (
        <div className="error-box">
          <span>{error}</span>
          {conflict && (
            <button className="btn small" onClick={onRebase}>
              Rebase my draft onto latest
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
