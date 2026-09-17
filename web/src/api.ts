import { httpApi } from './httpApi'
import { mockApi } from './mock/mockApi'

// The real backend (server/Waydocs.Api) is the default now that it exists. Set VITE_USE_MOCK=1 to fall back to
// the in-memory/localStorage prototype from Phase 0 (useful offline, or to demo without the API running).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

export type DocsApi = typeof mockApi

export const api: DocsApi = USE_MOCK ? mockApi : httpApi
