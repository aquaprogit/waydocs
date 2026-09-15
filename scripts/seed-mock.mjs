#!/usr/bin/env node
// Builds web/src/mock/seed.json from the markdown docs in SD-Backend/docs. Read-only on the source.
// Usage: node scripts/seed-mock.mjs [--if-missing]      source override: SD_DOCS_SOURCE=<path to docs folder>
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.env.SD_DOCS_SOURCE || join(repo, '..', 'SD', 'SD-Backend', 'docs'))
const out = join(repo, 'web', 'src', 'mock', 'seed.json')

if (process.argv.includes('--if-missing') && existsSync(out)) process.exit(0)
if (!existsSync(source)) {
  console.error(`seed-mock: source docs folder not found: ${source} (set SD_DOCS_SOURCE)`)
  process.exit(1)
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  )

function pathToId(rel) {
  const p = rel.replace(/\\/g, '/')
  if (p === 'README.md') return 'README'
  const m = /^domains\/(.+)\.md$/.exec(p)
  return m ? m[1] : null
}

function kindOf(id) {
  if (id === 'README' || id.endsWith('/README')) return 'DomainIndex'
  if (/qa-log/.test(id)) return 'QaLog'
  if (/active-tickets/.test(id)) return 'Backlog'
  if (/implementation-plan/.test(id)) return 'Plan'
  if (/(column-mapping|terminology|front-system-codes|vat-code-mapping|sort-pad-columns)/.test(id)) return 'Reference'
  return 'Feature'
}

const stripInline = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)\*([^*]+)\*/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()

function summaryOf(body) {
  const lines = body.split('\n')
  const purpose = lines.findIndex((l) => /^##\s+purpose\b/i.test(l))
  const para = []
  for (let j = purpose >= 0 ? purpose + 1 : 0; j < lines.length; j++) {
    const l = lines[j].trim()
    if (/^#{1,6}\s/.test(l)) {
      if (para.length || purpose >= 0) break
      continue
    }
    if (l === '') {
      if (para.length) break
      continue
    }
    if (!para.length && /^(\||```|>|- |\* |\d+\. )/.test(l)) continue
    para.push(l)
  }
  let s = stripInline(para.join(' '))
  if (s.length > 400) {
    const cut = s.slice(0, 397)
    const dot = cut.lastIndexOf('. ')
    s = dot > 200 ? cut.slice(0, dot + 1) : `${cut}…`
  }
  return s
}

function refsOf(body) {
  const refs = new Map()
  const add = (type, value) => refs.set(`${type}:${value}`, { type, value })
  for (const m of body.matchAll(/(?:#|\btickets?\s+\**#?)(\d{4})\b(?!-\d)/gi)) add('ticket', m[1])
  for (const m of body.matchAll(/`(I?[A-Z][A-Za-z0-9]*(?:Service|Handler|Job|Controller|Client))(?:\.[A-Za-z]+)?`/g))
    add('service', m[1])
  for (const m of body.matchAll(/`(GET|POST|PUT|DELETE|PATCH)\s+(\/api\/[^`?\s]*)/g)) add('endpoint', `${m[1]} ${m[2]}`)
  for (const m of body.matchAll(/`(dbo\.[A-Za-z_]+|SDW_[A-Za-z_]+)`/g)) add('dbObject', m[1])
  const order = ['ticket', 'service', 'endpoint', 'dbObject', 'd365Entity']
  return [...refs.values()].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.value.localeCompare(b.value),
  )
}

const now = new Date().toISOString()
const docs = []

for (const file of walk(source)) {
  const id = pathToId(relative(source, file))
  if (!id) continue
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const h1 = /^#\s+(.+)$/m.exec(raw)
  const title = h1 ? stripInline(h1[1]) : id.split('/').pop()
  const content = (h1 ? raw.replace(h1[0], '') : raw).replace(/^\s*\n/, '').trimEnd() + '\n'
  docs.push({
    id,
    domain: id === 'README' ? 'root' : id.split('/')[0],
    createdUtc: statSync(file).mtime.toISOString(),
    revisions: [
      {
        number: 1,
        parent: null,
        header: {
          title,
          summary: summaryOf(content),
          kind: kindOf(id),
          status: 'Current',
          answers: [],
          notCovered: [],
          refs: refsOf(content),
          links: [],
        },
        content,
        message: 'Imported from SD-Backend/docs',
        ticket: null,
        author: 'Vladyslav',
        source: 'import',
        createdUtc: statSync(file).mtime.toISOString(),
      },
    ],
  })
}

// One worked example of the header an agent writes in build step 4, so the prototype shows a complete header + r2.
const example = docs.find((d) => d.id === 'order/discount-reference')
if (example) {
  const r1 = example.revisions[0]
  const has = (id) => docs.some((d) => d.id === id)
  example.revisions.push({
    ...r1,
    number: 2,
    parent: 1,
    header: {
      ...r1.header,
      summary:
        'Optional campaign code (DiscountReference, max 10 chars) that users with role ORDREKAMPANJEKODE put on a publisher order line to explain an overridden discount or price. Sent to D365 SDItemOwnerRef only when the line was actually overridden.',
      answers: [
        'Who can set DiscountReference on an order line?',
        'When is DiscountReference sent to D365 (SDItemOwnerRef)?',
        'Where does the prefilled campaign code (discountTag) come from?',
        'Why is the max length 10 characters?',
        'How do I verify DiscountReference after submit in a local E2E?',
      ],
      notCovered: [
        'Line Reference / SDExternalReference (ShowExternalReferenceOnSalesLine)',
        'Publisher withdrawal order type → order/publisher-withdrawal',
        'Report Generator search on DiscountReference (planned, out of scope)',
      ],
      refs: [
        ...r1.header.refs,
        { type: 'endpoint', value: 'GET /api/registered-order' },
        { type: 'dbObject', value: 'SalesLine.internalreference' },
        { type: 'd365Entity', value: 'SalesOrderLines.SDItemOwnerRef' },
      ].filter((r, i, all) => all.findIndex((x) => x.type === r.type && x.value === r.value) === i),
      links: [
        has('order/publisher-withdrawal') && { to: 'order/publisher-withdrawal', type: 'related' },
        has('mammut/mammut-order-processing') && { to: 'mammut/mammut-order-processing', type: 'related' },
        has('product/product-creation') && { to: 'product/product-creation', type: 'depends-on' },
      ].filter(Boolean),
    },
    message: 'Write agent header: summary, answers, not-covered, extra refs, typed links',
    author: 'Claude',
    source: 'mcp',
    createdUtc: now,
  })
}

docs.sort((a, b) => a.id.localeCompare(b.id))
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ source, generatedUtc: now, docs }, null, 1))
const refCount = docs.reduce((n, d) => n + d.revisions.at(-1).header.refs.length, 0)
console.log(`seed-mock: ${docs.length} docs, ${refCount} refs -> ${relative(repo, out)}`)
