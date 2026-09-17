import { useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveHref, slugify } from './docmodel'
import { href } from './router'

type HastLike = { type: string; value?: string; children?: HastLike[] }

function textOf(n?: HastLike): string {
  if (!n) return ''
  if (n.type === 'text') return n.value ?? ''
  return (n.children ?? []).map(textOf).join('')
}

const scrollTo = (slug: string) => document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function Markdown({ content, docId, ids }: { content: string; docId: string; ids: Set<string> }) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href: target, children }) => {
        if (!target) return <span>{children}</span>
        if (target.startsWith('#'))
          return (
            <a
              href={target}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(target.slice(1))
              }}
            >
              {children}
            </a>
          )
        const r = resolveHref(docId, target)
        if (r.kind === 'doc')
          return ids.has(r.id) ? (
            <a className="doc-link" href={href('doc', r.id)}>
              {children}
            </a>
          ) : (
            <span className="broken-link" title={`Broken link: no doc '${r.id}'`}>
              {children}
            </span>
          )
        if (r.kind === 'outside')
          return (
            <span className="outside-link" title={`Points outside the docs: ${r.path}`}>
              {children}
            </span>
          )
        return (
          <a href={target} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      },
      blockquote: ({ node, children }) => (
        <blockquote className={textOf(node as unknown as HastLike).includes('[DOC GAP]') ? 'gap' : undefined}>{children}</blockquote>
      ),
      strong: ({ node, children }) =>
        textOf(node as unknown as HastLike).trim() === '[DOC GAP]' ? <span className="gap-mark">⚠ Doc gap</span> : <strong>{children}</strong>,
      h2: ({ node, children }) => <h2 id={slugify(textOf(node as unknown as HastLike))}>{children}</h2>,
      h3: ({ node, children }) => <h3 id={slugify(textOf(node as unknown as HastLike))}>{children}</h3>,
      table: ({ children }) => (
        <div className="table-wrap">
          <table>{children}</table>
        </div>
      ),
    }),
    [docId, ids],
  )
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
