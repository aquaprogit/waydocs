import { useEffect, useRef, useState } from 'react'
import { USE_MOCK, api } from './api'
import Modal from './Modal'
import { useAsync } from './hooks'

export default function MockMenu({ docId }: { docId?: string }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const source = useAsync(() => api.source(), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 3500)
    return () => clearTimeout(t)
  }, [note])

  const simulate = async () => {
    if (!docId) return
    setOpen(false)
    try {
      const r = await api.simulateAgentEdit(docId)
      setNote(`Claude saved r${r.revision} of ${docId} via MCP`)
    } catch (e) {
      setNote((e as Error).message)
    }
  }

  return (
    <div className="mock-menu" ref={box}>
      <button className="btn ghost small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {USE_MOCK ? 'Mock data ▾' : 'Dev tools ▾'}
      </button>
      {open && (
        <div className="menu">
          <div className="menu-note">
            {USE_MOCK ? (
              <>
                No backend running — data lives in this browser (localStorage), seeded from
                <span className="mono"> {source.data || 'the configured source docs folder'}</span>.
              </>
            ) : (
              <>
                Live API @ <span className="mono">localhost:5180</span>, SQLite-backed.
              </>
            )}
          </div>
          <button disabled={!docId} onClick={simulate}>
            Simulate Claude MCP edit on this doc
            <small>adds a revision by Claude — try it while editing to see the conflict flow</small>
          </button>
          {USE_MOCK && (
            <button
              onClick={() => {
                setOpen(false)
                setConfirm(true)
              }}
            >
              Reset to seed…
              <small>discard all local edits, revisions and links</small>
            </button>
          )}
        </div>
      )}
      {note && <div className="toast">{note}</div>}
      {confirm && (
        <Modal
          title="Reset mock data?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <span className="spacer" />
              <button className="btn" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  setConfirm(false)
                  await api.reset()
                  setNote('Mock data reset to seed')
                }}
              >
                Reset
              </button>
            </>
          }
        >
          <p>All edits, revisions and links made in this browser will be discarded. The seed from the source docs folder is reloaded.</p>
        </Modal>
      )}
    </div>
  )
}
