import { diffArrays, diffLines } from 'diff'
import { useMemo, useState } from 'react'

interface Row {
  kind: 'add' | 'del' | 'same'
  text: string
  a?: number
  b?: number
}

/** Treats re-padded markdown tables and trailing whitespace as unchanged — the rich editor re-serializes tables. */
function normLine(l: string) {
  const t = l.replace(/\s+$/, '')
  if (!t.trimStart().startsWith('|')) return t
  return t
    .replace(/:?-{3,}:?/g, '---')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\s+/g, ' ')
    .trim()
}

const splitLines = (s: string) => (s ? s.replace(/\n$/, '').split('\n') : [])

function buildRows(before: string, after: string, ignoreFormatting: boolean): Row[] {
  const rows: Row[] = []
  let a = 1
  let b = 1
  const parts = ignoreFormatting
    ? diffArrays(splitLines(before), splitLines(after), { comparator: (x, y) => normLine(x) === normLine(y) })
    : diffLines(before, after).map((p) => ({ ...p, value: splitLines(p.value) }))
  for (const p of parts) {
    for (const text of p.value) {
      if (p.added) rows.push({ kind: 'add', text, b: b++ })
      else if (p.removed) rows.push({ kind: 'del', text, a: a++ })
      else rows.push({ kind: 'same', text, a: a++, b: b++ })
    }
  }
  return rows
}

export default function DiffView({ before, after, context = 3 }: { before: string; after: string; context?: number }) {
  const [ignoreFormatting, setIgnoreFormatting] = useState(true)
  const rows = useMemo(() => buildRows(before, after, ignoreFormatting), [before, after, ignoreFormatting])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const added = rows.filter((r) => r.kind === 'add').length
  const removed = rows.filter((r) => r.kind === 'del').length
  const visible = rows.map((_, i) => {
    for (let d = -context; d <= context; d++) if (rows[i + d] && rows[i + d].kind !== 'same') return true
    return false
  })

  const out: React.ReactNode[] = []
  for (let i = 0; i < rows.length; i++) {
    if (!visible[i] && !expanded.has(i)) {
      let j = i
      while (j < rows.length && !visible[j]) j++
      const start = i
      out.push(
        <button key={`f${i}`} className="diff-fold" onClick={() => setExpanded((s) => new Set(s).add(start))}>
          ⋯ {j - i} unchanged line{j - i > 1 ? 's' : ''}
        </button>,
      )
      i = j - 1
      continue
    }
    if (!visible[i] && expanded.has(i)) {
      let j = i
      while (j < rows.length && !visible[j]) j++
      for (let k = i; k < j; k++) out.push(<Line key={k} row={rows[k]} />)
      i = j - 1
      continue
    }
    out.push(<Line key={i} row={rows[i]} />)
  }

  return (
    <div className="diff">
      <div className="diff-stats mono">
        <span className="add">+{added}</span> <span className="del">−{removed}</span>
        {!added && !removed && <span className="muted"> no changes</span>}
        <label className="check-inline diff-toggle">
          <input type="checkbox" checked={ignoreFormatting} onChange={(e) => setIgnoreFormatting(e.target.checked)} /> hide
          formatting-only changes
        </label>
      </div>
      <div className="diff-body mono">{added || removed ? out : null}</div>
    </div>
  )
}

function Line({ row }: { row: Row }) {
  return (
    <div className={`dl ${row.kind}`}>
      <span className="ln">{row.a ?? ''}</span>
      <span className="ln">{row.b ?? ''}</span>
      <span className="sign">{row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' '}</span>
      <span className="txt">{row.text || ' '}</span>
    </div>
  )
}
