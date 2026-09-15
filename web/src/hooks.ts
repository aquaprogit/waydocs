import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from './api'

export function useDocsVersion() {
  return useSyncExternalStore(api.subscribe, api.version)
}

export interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true })
  useEffect(() => {
    let alive = true
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (e: Error) => alive && setState({ error: e.message, loading: false }),
    )
    return () => {
      alive = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- callers pass the deps that fn closes over
  }, deps)
  return state
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function usePrefersDark() {
  return useSyncExternalStore(
    (cb) => {
      const q = darkQuery()
      q.addEventListener('change', cb)
      return () => q.removeEventListener('change', cb)
    },
    () => darkQuery().matches,
  )
}
