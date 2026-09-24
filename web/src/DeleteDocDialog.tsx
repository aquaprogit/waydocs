import { useState } from 'react'
import { api } from './api'
import Modal from './Modal'
import { go } from './router'

export default function DeleteDocDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ready = confirmText.trim() === id && !busy

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteDoc(id)
      onClose()
      go('home')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Delete doc"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger" disabled={!ready} onClick={remove}>
            Delete permanently
          </button>
        </>
      }
    >
      <p>
        This deletes <b className="mono">{id}</b> and its entire revision history for good — there is no revert or trash to recover it from.
      </p>
      <label className="field full">
        <span>
          Type <b className="mono">{id}</b> to confirm
        </span>
        <input autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={id} />
      </label>
      {error && <div className="error-box">{error}</div>}
    </Modal>
  )
}
