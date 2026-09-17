import type { DocHeader } from './types.js'

/** The cheapest possible row — what docs_map/search_docs/find_docs return per doc. Ported from
 * web/src/docmodel.ts's mapEntry() so an agent sees exactly what the web app's Agent map page shows it would. */
export function mapEntry(h: DocHeader) {
  return { id: h.id, title: h.title, summary: h.summary, status: h.status, tokens: h.tokens }
}

/** What get_header returns — everything except the body. Ported from docmodel.ts's agentHeader(). */
export function agentHeader(h: DocHeader) {
  return {
    id: h.id,
    title: h.title,
    summary: h.summary,
    status: h.status,
    answers: h.answers,
    refs: h.refs.map((r) => `${r.type}:${r.value}`),
    sections: h.sections.map((s) => ({ heading: s.heading, tokens: s.tokens })),
    tokens: h.tokens,
    revision: h.revision,
    updated: h.updated,
    openGaps: h.openGaps,
  }
}
