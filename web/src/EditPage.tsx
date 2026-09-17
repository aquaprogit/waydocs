import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import HeaderForm from './HeaderForm'
import LiveEditor from './LiveEditor'
import SaveDialog from './SaveDialog'
import { pickInput, serializeForDiff } from './docmodel'
import { useAsync } from './hooks'
import { go, href } from './router'
import { ApiError, type DocFull, type DocHeader, type DocHeaderInput } from './types'
import { Breadcrumbs, Skeleton } from './ui'

export default function EditPage({ id, headers }: { id: string; headers: DocHeader[] }) {
  const [loaded, setLoaded] = useState<DocFull | null>(null)
  const [header, setHeader] = useState<DocHeaderInput | null>(null)
  const [content, setContent] = useState('')
  const [base, setBase] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const [headerOpen, setHeaderOpen] = useState(true)
  const known = useAsync(() => api.knownRefs(), [])
  const ids = useMemo(() => new Set(headers.map((h) => h.id)), [headers])

  useEffect(() => {
    api.getDoc(id).then(
      (d) => {
        setLoaded(d)
        setHeader(pickInput(d.header))
        setContent(d.content)
        setBase(d.header.revision)
      },
      (e: Error) => setLoadError(e.message),
    )
  }, [id])

  const original = useMemo(() => (loaded ? serializeForDiff(pickInput(loaded.header), loaded.content) : ''), [loaded])
  const draft = useMemo(() => (header ? serializeForDiff(header, content) : ''), [header, content])

  if (loadError)
    return (
      <div className="page">
        <div className="error-box">{loadError}</div>
      </div>
    )
  if (!loaded || !header) return <Skeleton />

  const dirty = original !== draft

  const save = async (message: string, ticket: string | null) => {
    setBusy(true)
    setSaveError(null)
    setConflict(false)
    try {
      const r = await api.save({ id, header, content, message, ticket, baseRevision: base })
      go('doc', id, r.changed ? { saved: r.revision } : undefined)
    } catch (e) {
      setSaveError((e as Error).message)
      setConflict(e instanceof ApiError && e.status === 409)
    } finally {
      setBusy(false)
    }
  }

  const rebase = async () => {
    const latest = await api.getDoc(id)
    setLoaded(latest)
    setBase(latest.header.revision)
    setSaveError(null)
    setConflict(false)
  }

  return (
    <div className="page edit-page">
      <div className="edit-bar">
        <div className="eb-left">
          <Breadcrumbs id={id} title={loaded.header.title} ids={ids} />
          <b>Editing</b>
          <span className="muted small">based on r{base}</span>
          {dirty && <span className="pill warn">unsaved changes</span>}
        </div>
        <span className="spacer" />
        <a className="btn" href={href('doc', id)}>
          Cancel
        </a>
        <button className="btn primary" disabled={!dirty} onClick={() => setSaveOpen(true)}>
          Review & save…
        </button>
      </div>

      <section className="panel">
        <button className="panel-head" onClick={() => setHeaderOpen((o) => !o)} aria-expanded={headerOpen}>
          <span className="caret">{headerOpen ? '▾' : '▸'}</span>
          <b>Header</b>
          <span className="muted small">summary, answers and refs — what agents read first</span>
        </button>
        {headerOpen && <HeaderForm value={header} onChange={setHeader} known={known.data} />}
      </section>

      <section className="panel editor-panel">
        <LiveEditor markdown={loaded.content} docId={id} ids={ids} onChange={setContent} />
      </section>

      {saveOpen && (
        <SaveDialog
          before={original}
          after={draft}
          busy={busy}
          error={saveError}
          conflict={conflict}
          onRebase={rebase}
          onCancel={() => setSaveOpen(false)}
          onConfirm={save}
        />
      )}
    </div>
  )
}
