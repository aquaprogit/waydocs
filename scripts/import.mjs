#!/usr/bin/env node
// Imports markdown docs from a source folder into the running Waydocs API as r1 revisions, using the same
// heuristics as the mock seed (web/scripts is now scripts/seed-mock.mjs).
// Not run automatically — invoke deliberately: node scripts/import.mjs [--if-empty]
//   source override: WAYDOCS_SOURCE=<path to docs folder>   (required)
//   API override:    WAYDOCS_API_URL=<url> (default http://localhost:5180)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

if (!process.env.WAYDOCS_SOURCE) {
  console.error('import: set WAYDOCS_SOURCE=<path to the docs folder to import>')
  process.exit(1)
}
const source = resolve(process.env.WAYDOCS_SOURCE)
const apiBase = (process.env.WAYDOCS_API_URL || 'http://localhost:5180').replace(/\/+$/, '')

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
  for (const m of body.matchAll(/`(dbo\.[A-Za-z_]+)`/g)) add('dbObject', m[1])
  const order = ['ticket', 'service', 'endpoint', 'dbObject']
  return [...refs.values()].sort(
    (a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.value.localeCompare(b.value),
  )
}

async function apiSave(id, header, content) {
  const res = await fetch(`${apiBase}/api/doc?author=Human&source=import`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, header, content, message: `Imported from ${source}`, ticket: null, baseRevision: null }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${id}: ${res.status} ${text}`)
  return JSON.parse(text)
}

async function main() {
  if (!existsSync(source)) {
    console.error(`import: source docs folder not found: ${source} (set WAYDOCS_SOURCE)`)
    process.exit(1)
  }
  if (process.argv.includes('--if-empty')) {
    const existing = await fetch(`${apiBase}/api/docs`).then((r) => r.json())
    if (existing.length > 0) {
      console.log(`import: API already has ${existing.length} docs, skipping (--if-empty)`)
      return
    }
  }

  let imported = 0
  let failed = 0
  for (const file of walk(source)) {
    const id = pathToId(relative(source, file))
    if (!id) continue
    const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const h1 = /^#\s+(.+)$/m.exec(raw)
    const title = h1 ? stripInline(h1[1]) : id.split('/').pop()
    const content = (h1 ? raw.replace(h1[0], '') : raw).replace(/^\s*\n/, '').trimEnd() + '\n'
    const header = {
      title,
      summary: summaryOf(content),
      status: 'Current',
      answers: [],
      refs: refsOf(content),
    }
    try {
      const r = await apiSave(id, header, content)
      console.log(`${id} -> r${r.revision}`)
      imported++
    } catch (e) {
      console.error(`${id} FAILED: ${e.message}`)
      failed++
    }
  }
  console.log(`import: ${imported} imported, ${failed} failed (source: ${statSync(source) && source})`)
}

await main()
