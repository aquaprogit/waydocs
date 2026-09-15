import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

export interface Block {
  start: number
  end: number
  raw: string
  type: string
}

const parser = unified().use(remarkParse).use(remarkGfm)

/** Top-level markdown blocks with their exact source offsets, so untouched text is never re-serialized. */
export function splitBlocks(md: string): Block[] {
  return parser.parse(md).children.flatMap((n) => {
    const start = n.position?.start.offset
    const end = n.position?.end.offset
    return start === undefined || end === undefined ? [] : [{ start, end, raw: md.slice(start, end), type: n.type }]
  })
}
