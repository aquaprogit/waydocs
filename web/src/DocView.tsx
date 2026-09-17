import { useState } from 'react'
import { api } from './api'
import AgentView from './AgentView'
import DocGraphPanel from './DocGraphPanel'
import HeaderCard from './HeaderCard'
import Markdown from './Markdown'
import { relTime } from './docmodel'
import { useAsync } from './hooks'
import { href } from './router'
import { Avatar, Breadcrumbs, PageState, Skeleton, StatusPill } from './ui'

interface Props {
  id: string
  ids: Set<string>
  rev?: number
  tab: string
  saved?: number
  version: number
}

export default function DocView({ id, ids, rev, tab, saved, version }: Props) {
  const doc = useAsync(() => api.getDoc(id, rev), [id, rev, version])
  const links = useAsync(() => api.links(id), [id, version])
  const [dismissed, setDismissed] = useState(false)

  if (doc.error) {
    const fallback = [...ids][0]
    return (
      <PageState
        status={doc.status}
        message={doc.status === 404 ? `There's no doc at “${id}”. It may have been renamed or removed.` : doc.error}
        action={
          fallback && (
            <a className="btn" href={href('doc', fallback)}>
              Browse docs
            </a>
          )
        }
      />
    )
  }
  if (!doc.data) return <Skeleton />

  const { header: h, content } = doc.data
  const old = h.revision !== h.currentRevision
  const agent = tab === 'agent'

  return (
    <div className="page doc-page">
      <div className="doc-top">
        <Breadcrumbs id={h.id} title={h.title} ids={ids} />
        <div className="doc-actions">
          <div className="seg">
            <a href={href('doc', id, { rev })} className={!agent ? 'on' : ''}>
              Read
            </a>
            <a href={href('doc', id, { rev, tab: 'agent' })} className={agent ? 'on' : ''}>
              Agent view
            </a>
          </div>
          <a className="btn" href={href('history', id)}>
            History <span className="mono muted">r{h.currentRevision}</span>
          </a>
          {!old && (
            <a className="btn primary" href={href('edit', id)}>
              Edit
            </a>
          )}
        </div>
      </div>

      {saved && !dismissed && !old && (
        <div className="banner ok">
          <span>
            Saved as <b>r{saved}</b>. <a href={href('history', id)}>See the diff</a>
          </span>
          <button className="icon-btn" onClick={() => setDismissed(true)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {old && (
        <div className="banner">
          <span>
            Viewing <b>r{h.revision}</b> — current is r{h.currentRevision}. <a href={href('doc', id)}>Open current</a>
          </span>
        </div>
      )}

      <h1 className="doc-title">{h.title}</h1>
      <div className="doc-meta">
        <StatusPill status={h.status} />
        <span className="meta-item">
          <Avatar author={h.updatedBy} /> r{h.revision} · {relTime(h.updated)}
        </span>
        <span className="meta-item mono">{h.tokens.toLocaleString()} tokens</span>
        {h.openGaps > 0 && (
          <span className="pill warn">
            {h.openGaps} open gap{h.openGaps > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {agent ? (
        <AgentView header={h} content={content} />
      ) : (
        <>
          <HeaderCard header={h} />
          <article className="md">
            <Markdown content={content} docId={id} ids={ids} />
          </article>
          <DocGraphPanel header={h} links={links.data} />
        </>
      )}
    </div>
  )
}
