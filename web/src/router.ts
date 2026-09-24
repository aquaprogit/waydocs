import { useMemo, useSyncExternalStore } from 'react'

export type Page = 'home' | 'doc' | 'edit' | 'history' | 'graph' | 'changelog' | 'check' | 'map' | 'metrics'

export interface Route {
  page: Page
  id?: string
  params: URLSearchParams
}

const DOC_PAGES = new Set<Page>(['doc', 'edit', 'history'])
const PLAIN_PAGES = new Set<Page>(['graph', 'changelog', 'check', 'map', 'metrics'])

export function parseHash(hash: string): Route {
  const raw = decodeURIComponent(hash.replace(/^#\/?/, ''))
  const [path, query = ''] = raw.split('?')
  const [page, ...rest] = path.split('/')
  const params = new URLSearchParams(query)
  if (DOC_PAGES.has(page as Page) && rest.length) return { page: page as Page, id: rest.join('/'), params }
  if (PLAIN_PAGES.has(page as Page)) return { page: page as Page, params }
  return { page: 'home', params }
}

export function href(page: Page, id?: string, params?: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const qs = q.toString()
  return `#/${page}${id ? `/${id}` : ''}${qs ? `?${qs}` : ''}`
}

export function go(...args: Parameters<typeof href>) {
  window.location.hash = href(...args)
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseHash(hash), [hash])
}
