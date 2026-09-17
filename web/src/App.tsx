import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import AgentMapPage from './AgentMapPage'
import ChangelogPage from './ChangelogPage'
import CheckPage from './CheckPage'
import DocView from './DocView'
import EditPage from './EditPage'
import GraphPage from './GraphPage'
import HistoryPage from './HistoryPage'
import MockMenu from './MockMenu'
import NewDocDialog from './NewDocDialog'
import SearchBox from './SearchBox'
import Sidebar from './Sidebar'
import { useAsync, useDocsVersion } from './hooks'
import { go, href, useRoute, type Page } from './router'
import { PageState } from './ui'
import './App.css'

const NAV: [Page, string][] = [
  ['doc', 'Docs'],
  ['graph', 'Graph'],
  ['changelog', 'Changelog'],
  ['check', 'Check'],
  ['map', 'Agent map'],
]

const num = (v: string | null) => (v ? Number(v) : undefined)

export default function App() {
  const route = useRoute()
  const version = useDocsVersion()
  const list = useAsync(() => api.listDocs(), [version])
  const [newOpen, setNewOpen] = useState(false)
  const headers = useMemo(() => list.data ?? [], [list.data])
  const ids = useMemo(() => new Set(headers.map((h) => h.id)), [headers])
  const docTarget = route.id ?? route.params.get('focus') ?? 'README'

  useEffect(() => {
    if (route.page === 'home' && headers.length) go('doc', 'README')
  }, [route.page, headers.length])

  const section: Page = route.page === 'edit' || route.page === 'history' || route.page === 'home' ? 'doc' : route.page

  let page: ReactNode = null
  if (list.error) page = <PageState status={list.status} message={list.error} />
  else if (route.page === 'doc' && route.id)
    page = (
      <DocView
        key={`${route.id}@${route.params.get('rev') ?? ''}`}
        id={route.id}
        ids={ids}
        rev={num(route.params.get('rev'))}
        tab={route.params.get('tab') ?? 'read'}
        saved={num(route.params.get('saved'))}
        version={version}
      />
    )
  else if (route.page === 'edit' && route.id) page = <EditPage key={route.id} id={route.id} headers={headers} />
  else if (route.page === 'history' && route.id) page = <HistoryPage key={route.id} id={route.id} version={version} />
  else if (route.page === 'graph')
    page = <GraphPage key={route.params.get('focus') ?? ''} version={version} focus={route.params.get('focus') ?? undefined} />
  else if (route.page === 'changelog') page = <ChangelogPage version={version} />
  else if (route.page === 'check') page = <CheckPage version={version} />
  else if (route.page === 'map') page = <AgentMapPage headers={headers} />

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href('doc', 'README')}>
          <span className="brand-mark">§</span>
          <span>Waydocs</span>
        </a>
        <nav className="nav">
          {NAV.map(([p, label]) => (
            <a key={p} href={p === 'doc' ? href('doc', docTarget) : href(p)} className={section === p ? 'on' : ''}>
              {label}
            </a>
          ))}
        </nav>
        <SearchBox />
        <div className="top-actions">
          <button className="btn primary small" onClick={() => setNewOpen(true)}>
            + New doc
          </button>
          <MockMenu docId={route.page === 'doc' ? route.id : undefined} />
        </div>
      </header>
      <div className={`layout ${route.page === 'graph' ? 'full' : ''}`}>
        {route.page !== 'graph' && <Sidebar headers={headers} activeId={route.id} />}
        <main className="main">{page}</main>
      </div>
      {newOpen && <NewDocDialog headers={headers} onClose={() => setNewOpen(false)} />}
    </div>
  )
}
