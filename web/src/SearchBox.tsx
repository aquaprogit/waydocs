import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { go } from './router'
import type { SearchHit } from './types'
import { Highlight } from './ui'

export default function SearchBox() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) setHits([])
      else api.search(q, { limit: 8 }).then((h) => (setHits(h), setSel(0)))
    }, 120)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (h: SearchHit) => {
    go('doc', h.header.id)
    setOpen(false)
    setQ('')
    input.current?.blur()
  }

  return (
    <div className="search">
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, hits.length - 1))
          else if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0))
          else if (e.key === 'Enter' && hits[sel]) pick(hits[sel])
          else if (e.key === 'Escape') input.current?.blur()
        }}
        placeholder="Search docs, tickets, services…"
        aria-label="Search docs"
      />
      <kbd className="kbd">Ctrl K</kbd>
      {open && q.trim() && (
        <ul className="search-pop">
          {hits.length === 0 && <li className="empty muted">No matches</li>}
          {hits.map((h, i) => (
            <li key={h.header.id} className={i === sel ? 'sel' : ''} onMouseDown={() => pick(h)} onMouseEnter={() => setSel(i)}>
              <div className="sp-title">{h.header.title}</div>
              <div className="sp-id mono">
                {h.header.id} · matched in {h.field}
              </div>
              <div className="sp-snip">
                <Highlight text={h.snippet} q={q} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
