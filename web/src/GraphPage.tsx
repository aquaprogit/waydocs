import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
  type NodeProps,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import Modal from './Modal'
import { domainColor, isIndex } from './docmodel'
import { useAsync, usePrefersDark } from './hooks'
import { go, href } from './router'
import { LINK_TYPES, MANUAL_LINK_TYPES, type DocHeader, type LinkType, type ManualLinkType } from './types'
import { PageState } from './ui'

type DocNodeData = { header: DocHeader; color: string; size: number; dim: boolean }
type RefNodeData = { label: string; refType: string; count: number; dim: boolean }
type DocNodeT = Node<DocNodeData, 'doc'>
type RefNodeT = Node<RefNodeData, 'ref'>
type AnyNode = DocNodeT | RefNodeT
type RefMode = 'off' | string

/** An Obsidian-style dot: bigger + colored for a domain hub, small (same hue) for a member doc. Label sits below,
 *  out of normal flow, so react-flow's handles still attach right at the circle's edge. */
function DocNode({ data, selected }: NodeProps<DocNodeT>) {
  const h = data.header
  const hub = isIndex(h.id)
  return (
    <div
      className={`onode ${hub ? 'hub' : ''} ${data.dim ? 'dim' : ''} ${selected ? 'sel' : ''} ${h.status === 'Deprecated' ? 'deprecated' : ''}`}
      style={{ width: data.size, height: data.size, background: data.color }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {h.openGaps > 0 && <span className="onode-badge">{h.openGaps}</span>}
      <span className="onode-label">{h.id === 'README' ? 'Home' : h.title}</span>
    </div>
  )
}

function RefNode({ data }: NodeProps<RefNodeT>) {
  return (
    <div className={`rnode ${data.dim ? 'dim' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <span className="ref-t">{data.refType}</span>
      <span className="rn-label">{data.label}</span>
      <span className="mono muted">{data.count}</span>
    </div>
  )
}

const nodeTypes = { doc: DocNode, ref: RefNode }

const EDGE_STYLE: Record<LinkType | 'ref', { color: string; dash?: string; width: number; label: string }> = {
  'part-of': { color: '#a39a83', width: 1.2, label: 'part of domain (auto, domain-colored)' },
  mentions: { color: '#8f887a', width: 1, label: 'mentions (auto, weak)' },
  related: { color: '#3a6ea5', width: 2, label: 'related' },
  'depends-on': { color: '#8a5a9e', width: 2, label: 'depends on' },
  supersedes: { color: '#c07a3a', width: 2, label: 'supersedes' },
  'conflicts-with': { color: '#c0392b', width: 2.2, label: 'conflicts with' },
  ref: { color: '#2f8a8a', dash: '2 4', width: 1, label: 'shared ref' },
}

const ROOT_SIZE = 46
const HUB_SIZE = 30
const DOC_SIZE = 13
const HUB_R = 320
const DOC_R = 150
const DOC_ARC_DEG = 150

function nodeSize(h: DocHeader) {
  if (h.id === 'README') return ROOT_SIZE
  return isIndex(h.id) ? HUB_SIZE : DOC_SIZE
}

/** Obsidian-style clustering: the home doc sits at the center, one domain hub per spoke around it, and that
 *  domain's other docs fan out in a small arc past their hub — so "related nodes under a domain" reads visually. */
function radialLayout(nodes: DocHeader[]) {
  const byDomain = new Map<string, DocHeader[]>()
  for (const n of nodes) {
    if (n.domain === 'root') continue
    byDomain.set(n.domain, [...(byDomain.get(n.domain) ?? []), n])
  }
  const domains = [...byDomain.keys()].sort()
  const pos: Record<string, XYPosition> = { README: { x: 0, y: 0 } }
  domains.forEach((d, i) => {
    const angle = (i / domains.length) * Math.PI * 2 - Math.PI / 2
    const hubId = `${d}/README`
    const hx = Math.cos(angle) * HUB_R
    const hy = Math.sin(angle) * HUB_R
    pos[hubId] = { x: hx, y: hy }
    const docs = (byDomain.get(d) ?? []).filter((n) => n.id !== hubId)
    const arc = (DOC_ARC_DEG * Math.PI) / 180
    // Crowded domains (Mammut, Order, …) get pushed out further so their doc labels don't stack on the hub.
    const r = DOC_R + Math.max(0, docs.length - 5) * 22
    docs.forEach((doc, j) => {
      const t = docs.length > 1 ? j / (docs.length - 1) - 0.5 : 0
      const da = angle + t * arc
      pos[doc.id] = { x: hx + Math.cos(da) * r, y: hy + Math.sin(da) * r }
    })
  })
  return { pos, refX: HUB_R + DOC_R + 140 }
}

export default function GraphPage({ version, focus }: { version: number; focus?: string }) {
  const graph = useAsync(() => api.graph(), [version])
  const dark = usePrefersDark()
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set())
  const [edgeTypes, setEdgeTypes] = useState<Set<LinkType>>(new Set(LINK_TYPES))
  const [refMode, setRefMode] = useState<RefMode>('off')
  const [selected, setSelected] = useState<string | null>(focus ?? null)
  const [focusMode, setFocusMode] = useState(!!focus)
  const [layoutKey, setLayoutKey] = useState(0)
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null)
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<AnyNode>([])

  const data = graph.data
  const layout = useMemo(() => (data ? radialLayout(data.nodes) : { pos: {}, refX: 0 }), [data])
  const domains = useMemo(() => (data ? [...new Set(data.nodes.map((n) => n.domain))] : []), [data])
  const refTypes = useMemo(() => (data ? [...new Set(data.nodes.flatMap((n) => n.refs.map((r) => r.type)))].sort() : []), [data])

  const computed = useMemo(() => {
    if (!data) return { nodes: [] as AnyNode[], edges: [] as Edge[] }
    const docs = data.nodes.filter((n) => !hiddenDomains.has(n.domain))
    const ids = new Set(docs.map((n) => n.id))
    const shownEdges = data.edges.filter((e) => edgeTypes.has(e.type) && ids.has(e.from) && ids.has(e.to))

    const refMap = new Map<string, string[]>()
    if (refMode !== 'off')
      for (const n of docs) for (const r of n.refs) if (r.type === refMode) refMap.set(r.value, [...(refMap.get(r.value) ?? []), n.id])
    const refs = [...refMap.entries()]
      .filter(([, xs]) => xs.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 40)

    let nb: Set<string> | null = null
    if (focusMode && selected) {
      nb = new Set([selected])
      for (const e of shownEdges) {
        if (e.from === selected) nb.add(e.to)
        if (e.to === selected) nb.add(e.from)
      }
      for (const [value, xs] of refs) {
        if (!xs.includes(selected)) continue
        nb.add(`ref:${value}`)
        for (const x of xs) nb.add(x)
      }
    }

    const nodeDomain = new Map(docs.map((n) => [n.id, n.domain]))

    const nodes: AnyNode[] = [
      ...docs.map(
        (h): DocNodeT => ({
          id: h.id,
          type: 'doc',
          position: layout.pos[h.id] ?? { x: 0, y: 0 },
          data: { header: h, color: domainColor(h.domain), size: nodeSize(h), dim: !!nb && !nb.has(h.id) },
          selected: h.id === selected,
        }),
      ),
      ...refs.map(
        ([value, xs], i): RefNodeT => ({
          id: `ref:${value}`,
          type: 'ref',
          position: { x: layout.refX, y: i * 46 },
          data: { label: value, refType: refMode, count: xs.length, dim: !!nb && !nb.has(`ref:${value}`) },
          connectable: false,
        }),
      ),
    ]

    // part-of ties a doc to its domain hub, so it's strong and colored like the doc's own domain (never the
    // domain it points into). mentions is a weak, neutral, undirected cross-reference that never recolors a node —
    // node color always comes from the node's own domain, regardless of who links to it.
    const edge = (id: string, source: string, target: string, kind: LinkType | 'ref', label?: string): Edge => {
      let color: string
      let width: number
      let opacity: number
      let dash: string | undefined
      let arrow = true
      if (kind === 'part-of') {
        color = domainColor(nodeDomain.get(source) ?? 'root')
        width = 2.2
        opacity = 0.5
        arrow = false
      } else if (kind === 'mentions') {
        color = dark ? '#5c574c' : '#b7ae9c'
        width = 1
        opacity = 0.35
        arrow = false
      } else {
        const st = EDGE_STYLE[kind]
        color = st.color
        width = st.width
        dash = st.dash
        opacity = 0.9
        arrow = kind !== 'ref'
      }
      const dim = !!nb && !(nb.has(source) && nb.has(target))
      return {
        id,
        source,
        target,
        label,
        style: { stroke: color, strokeWidth: width, strokeDasharray: dash, opacity: dim ? 0.06 : opacity },
        labelStyle: { fontSize: 10, fill: color, fontWeight: 600 },
        labelBgStyle: { fill: dark ? '#201e1a' : '#fbf9f5', opacity: 0.92 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 3,
        markerEnd: arrow ? { type: MarkerType.ArrowClosed, color, width: 12, height: 12 } : undefined,
        zIndex: dim ? 0 : 1,
      }
    }

    const edges: Edge[] = [
      ...shownEdges.map((e) => edge(`${e.type}:${e.from}->${e.to}`, e.from, e.to, e.type, e.auto ? undefined : e.type)),
      ...refs.flatMap(([value, xs]) => xs.map((x) => edge(`ref:${x}->${value}`, x, `ref:${value}`, 'ref'))),
    ]
    return { nodes, edges }
  }, [data, hiddenDomains, edgeTypes, refMode, focusMode, selected, layout, dark])

  useEffect(() => {
    setRfNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]))
      return computed.nodes.map((n) => {
        const o = old.get(n.id)
        return o && layoutKey === lastLayoutKey ? ({ ...n, position: o.position, measured: o.measured } as AnyNode) : n
      })
    })
    lastLayoutKey = layoutKey
  }, [computed, layoutKey, setRfNodes])

  const sel = data?.nodes.find((n) => n.id === selected)
  const toggleIn = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  const onConnect = (c: Connection) => {
    if (c.source && c.target && c.source !== c.target && !c.target.startsWith('ref:')) setPending({ from: c.source, to: c.target })
  }

  const onConnectEnd = (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (state.isValid || !state.fromNode) return
    const pt = 'changedTouches' in event ? event.changedTouches[0] : event
    const to = document.elementFromPoint(pt.clientX, pt.clientY)?.closest('.react-flow__node')?.getAttribute('data-id')
    if (to && to !== state.fromNode.id && !to.startsWith('ref:')) setPending({ from: state.fromNode.id, to })
  }

  if (graph.error) return <PageState status={graph.status} message={graph.error} />

  return (
    <div className="graph-page">
      <div className="graph-bar">
        <div className="gb-group">
          <span className="gb-label">Domains</span>
          {domains.map((d) => (
            <button
              key={d}
              className={`chip toggle ${hiddenDomains.has(d) ? '' : 'on'}`}
              onClick={() => setHiddenDomains((s) => toggleIn(s, d))}
            >
              <span className="dot" style={{ background: domainColor(d) }} />
              {d}
            </button>
          ))}
        </div>
        <div className="gb-group">
          <span className="gb-label">Edges</span>
          {LINK_TYPES.map((t) => (
            <button key={t} className={`chip toggle ${edgeTypes.has(t) ? 'on' : ''}`} onClick={() => setEdgeTypes((s) => toggleIn(s, t))}>
              <span className="swatch" style={{ background: EDGE_STYLE[t].color }} />
              {EDGE_STYLE[t].label}
            </button>
          ))}
        </div>
        <div className="gb-group">
          <label className="gb-label" htmlFor="refmode">
            Shared refs
          </label>
          <select id="refmode" value={refMode} onChange={(e) => setRefMode(e.target.value as RefMode)}>
            <option value="off">off</option>
            {refTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="check-inline">
            <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} /> focus selection
          </label>
          <button className="btn small ghost" onClick={() => setLayoutKey((k) => k + 1)}>
            Reset layout
          </button>
        </div>
      </div>

      <div className="graph-wrap">
        <ReactFlow<AnyNode, Edge>
          nodes={rfNodes}
          edges={computed.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, n) => n.type === 'doc' && setSelected(n.id)}
          onNodeDoubleClick={(_, n) => n.type === 'doc' && go('doc', n.id)}
          onPaneClick={() => setSelected(null)}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          connectionRadius={40}
          colorMode={dark ? 'dark' : 'light'}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.type === 'doc' ? (n.data as DocNodeData).color : '#2f8a8a')} />
        </ReactFlow>

        <div className="graph-hint">
          Click a doc to inspect · double-click to open · drag from a doc's right handle onto another doc to create a typed link
        </div>

        {sel && (
          <aside className="graph-side">
            <div className="gs-head">
              <span className="dot" style={{ background: domainColor(sel.domain) }} />
              <span className="mono muted small">{sel.id}</span>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>
            <h3>{sel.title}</h3>
            <p className="small">{sel.summary}</p>
            {sel.answers.length > 0 && (
              <>
                <h4>Answers</h4>
                <ul className="qa small">
                  {sel.answers.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="gs-stats mono small">
              <span>{sel.headerTokens} tok header</span>
              <span>{sel.tokens.toLocaleString()} tok body</span>
              <span>{data?.edges.filter((e) => e.from === sel.id || e.to === sel.id).length} edges</span>
            </div>
            <div className="gs-actions">
              <a className="btn primary small" href={href('doc', sel.id)}>
                Open
              </a>
              <a className="btn small" href={href('edit', sel.id)}>
                Edit
              </a>
              <a className="btn small" href={href('history', sel.id)}>
                History
              </a>
            </div>
          </aside>
        )}
      </div>

      {pending && data && (
        <LinkDialog
          from={data.nodes.find((n) => n.id === pending.from)!}
          to={data.nodes.find((n) => n.id === pending.to)!}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  )
}

let lastLayoutKey = 0

function LinkDialog({ from, to, onClose }: { from: DocHeader; to: DocHeader; onClose: () => void }) {
  const [type, setType] = useState<ManualLinkType>('related')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const msg = message.trim() || `Link ${from.id} ${type} ${to.id}`
  const submit = async () => {
    setBusy(true)
    try {
      await api.link(from.id, to.id, type, msg)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Create typed link"
      onClose={onClose}
      footer={
        <>
          <span className="muted small">Saved as a new revision of “{from.title}”</span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy} onClick={submit}>
            Create link
          </button>
        </>
      }
    >
      <div className="link-preview">
        <span className="chip">{from.title}</span>
        <select value={type} onChange={(e) => setType(e.target.value as ManualLinkType)} autoFocus>
          {MANUAL_LINK_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="chip">{to.title}</span>
      </div>
      {type === 'supersedes' && <p className="banner warn">“{to.title}” will be marked Deprecated.</p>}
      <label className="field full">
        <span>Change message</span>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={msg} />
      </label>
      {error && <div className="error-box">{error}</div>}
    </Modal>
  )
}
