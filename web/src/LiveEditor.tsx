import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import Markdown from './Markdown'
import { splitBlocks } from './blocks'
import { GAP_BLOCK } from './docmodel'

type Caret = number | 'end'

interface Props {
  markdown: string
  docId: string
  ids: Set<string>
  onChange: (md: string) => void
}

/** Maps a click on rendered text to a caret offset in the block's raw markdown (best effort). */
function caretFromPoint(x: number, y: number, raw: string): Caret {
  const range = document.caretRangeFromPoint?.(x, y)
  const node = range?.startContainer
  if (!range || !node || node.nodeType !== Node.TEXT_NODE) return 'end'
  const t = node.textContent ?? ''
  const at = range.startOffset
  const after = t.slice(at, at + 16)
  if (after.trim().length >= 3) {
    const i = raw.indexOf(after)
    if (i >= 0) return i
  }
  const before = t.slice(Math.max(0, at - 16), at)
  if (before.trim().length >= 3) {
    const i = raw.indexOf(before)
    if (i >= 0) return i + before.length
  }
  return 'end'
}

export default function LiveEditor({ markdown, docId, ids, onChange }: Props) {
  const [text, setText] = useState(markdown)
  const [active, setActive] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState<Caret>('end')
  const [seq, setSeq] = useState(0)
  const [mode, setMode] = useState<'live' | 'source'>('live')
  const blocks = useMemo(() => splitBlocks(text), [text])
  const box = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const src = useRef<HTMLTextAreaElement>(null)

  /** Full text with block i replaced by raw; i === blocks.length appends a new block; empty raw deletes the block. */
  const assemble = (i: number, raw: string): string => {
    if (i >= blocks.length) return raw.trim() ? `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${raw.trimEnd()}\n` : text
    const b = blocks[i]
    if (!raw.trim()) {
      if (i > 0) return text.slice(0, blocks[i - 1].end) + text.slice(b.end)
      return text.slice(0, b.start) + text.slice(i + 1 < blocks.length ? blocks[i + 1].start : text.length)
    }
    return text.slice(0, b.start) + raw + text.slice(b.end)
  }

  const commitText = (next: string) => {
    if (next === text) return
    setText(next)
    onChange(next)
  }

  /** Commits the active draft (as nextText) and opens the block that contains offset in it. */
  const openAt = (nextText: string, offset: number, pos: Caret) => {
    const nb = splitBlocks(nextText)
    let i = nb.findIndex((b) => offset >= b.start && offset <= b.end)
    if (i < 0) i = nb.findIndex((b) => b.start >= offset)
    if (i < 0) i = nb.length
    commitText(nextText)
    setActive(i)
    setDraft(i < nb.length ? nb[i].raw : '')
    setCaret(pos)
    setSeq((s) => s + 1)
  }

  const close = () => {
    if (active === null) return
    const next = assemble(active, draft)
    setActive(null)
    commitText(next)
  }

  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (active === null) return
    const onDown = (e: globalThis.MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) closeRef.current()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [active])

  useLayoutEffect(() => {
    const el = ta.current
    if (!el || active === null) return
    el.focus()
    const pos = caret === 'end' ? el.value.length : Math.min(caret, el.value.length)
    el.setSelectionRange(pos, pos)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- seq bumps on every block open; caret/active are read at that moment
  }, [seq])

  useLayoutEffect(() => {
    for (const el of [ta.current, src.current]) {
      if (!el) continue
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight + 2}px`
    }
  }, [draft, active, text, mode])

  /** Offset in the committed text where old block j will start. */
  const offsetOf = (j: number) => {
    if (j >= blocks.length) return Number.MAX_SAFE_INTEGER
    if (active === null || j < active) return blocks[j].start
    return blocks[j].start + assemble(active, draft).length - text.length
  }

  const onBlockMouseDown = (e: MouseEvent, j: number, raw: string) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('a') && (e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const pos = raw ? caretFromPoint(e.clientX, e.clientY, raw) : 'end'
    if (active === null) {
      setActive(j)
      setDraft(raw)
      setCaret(pos)
      setSeq((s) => s + 1)
    } else openAt(assemble(active, draft), offsetOf(j), pos)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (active === null) return
    const el = e.currentTarget
    const collapsed = el.selectionStart === el.selectionEnd
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowUp' && collapsed && el.selectionStart === 0 && active > 0) {
      e.preventDefault()
      openAt(assemble(active, draft), blocks[active - 1].start, 'end')
    } else if (e.key === 'ArrowDown' && collapsed && el.selectionEnd === el.value.length && active < blocks.length) {
      e.preventDefault()
      openAt(assemble(active, draft), offsetOf(active + 1), 0)
    }
  }

  const insertGap = () => {
    const base = active === null ? text : assemble(active, draft)
    let at = base.trimEnd().length
    if (active !== null && active < blocks.length && draft.trim()) at = blocks[active].start + draft.trimEnd().length
    const next = `${base.slice(0, at)}\n\n${GAP_BLOCK}${base.slice(at) || '\n'}`
    setMode('live')
    openAt(next, at + 2, GAP_BLOCK.indexOf('What is unknown?'))
  }

  const editor = (i: number) => (
    <div key={`edit-${i}`} className="lv-block lv-active">
      <textarea
        ref={ta}
        className="lv-raw"
        value={draft}
        rows={1}
        spellCheck={false}
        placeholder="Type markdown…"
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(assemble(i, e.target.value))
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  )

  return (
    <div className="live-editor">
      <div className="lv-head">
        <b>Body</b>
        <div className="seg small">
          <button className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>
            Live
          </button>
          <button
            className={mode === 'source' ? 'on' : ''}
            onClick={() => {
              close()
              setMode('source')
            }}
          >
            Source
          </button>
        </div>
        <span className="muted small lv-help">
          {mode === 'live'
            ? 'click a block to edit its markdown · Esc to finish · ↑/↓ at the edges move between blocks · Ctrl+click follows a link'
            : 'raw markdown of the whole body'}
        </span>
        <span className="spacer" />
        <button className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={insertGap} title="Insert a [DOC GAP] block">
          + DOC GAP
        </button>
      </div>

      {mode === 'source' ? (
        <textarea
          ref={src}
          className="source-area"
          value={text}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value)
            onChange(e.target.value)
          }}
        />
      ) : (
        <div
          ref={box}
          className="live md"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest('a') && !(e.ctrlKey || e.metaKey)) e.preventDefault()
          }}
        >
          {blocks.map((b, i) =>
            i === active ? (
              editor(i)
            ) : (
              <div key={`view-${i}`} className={`lv-block lv-${b.type}`} onMouseDown={(e) => onBlockMouseDown(e, i, b.raw)}>
                <Markdown content={b.raw} docId={docId} ids={ids} />
              </div>
            ),
          )}
          {active === blocks.length ? (
            editor(blocks.length)
          ) : (
            <div className="lv-add" onMouseDown={(e) => onBlockMouseDown(e, blocks.length, '')}>
              + click to add a block
            </div>
          )}
        </div>
      )}
    </div>
  )
}
