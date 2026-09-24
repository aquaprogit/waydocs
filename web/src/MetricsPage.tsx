import { useState } from 'react'
import { api } from './api'
import { relTime } from './docmodel'
import { useAsync } from './hooks'
import type { ToolUsageByTool, ToolUsageDaily } from './types'

const WINDOWS: { label: string; days?: number }[] = [
  { label: 'All time' },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 7 days', days: 7 },
]

const pct = (saved: number, baseline: number) => (baseline === 0 ? 0 : Math.round((saved / baseline) * 100))
const fmt = (n: number) => n.toLocaleString()
const signed = (n: number) => `${n >= 0 ? '' : '−'}${fmt(Math.abs(n))}`

/** One row per tool: a muted bar sized to how many tokens a full-body read would have cost, with the
 * accent bar (what the call actually returned) drawn over the same 0-baseline — the muted band left
 * showing past the accent bar's edge is the saved tokens, at a glance. Both bars share one scale (the
 * largest baseline in the set) so magnitudes are comparable across rows, not just within one. */
function ByToolChart({ byTool }: { byTool: ToolUsageByTool[] }) {
  const max = Math.max(...byTool.map((t) => t.baselineTokens), 1)
  return (
    <div className="bytool-chart">
      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-swatch track" /> Would&apos;ve cost
        </span>
        <span className="chart-legend-item">
          <span className="chart-swatch fill" /> Actually returned
        </span>
      </div>
      {byTool.map((t) => (
        <div className="bytool-row" key={t.tool}>
          <span className="bytool-label mono">{t.tool}</span>
          <div className="bytool-track">
            <div
              className="bytool-baseline"
              style={{ width: `${(t.baselineTokens / max) * 100}%` }}
              title={`${fmt(t.baselineTokens)} tokens would've been read in full`}
            />
            <div
              className="bytool-fill"
              style={{ width: `${(t.actualTokens / max) * 100}%` }}
              title={`${fmt(t.actualTokens)} tokens actually returned`}
            />
          </div>
          <span className={`bytool-saved mono ${t.savedTokens >= 0 ? 'ok' : 'err'}`}>{signed(t.savedTokens)}</span>
        </div>
      ))}
    </div>
  )
}

/** Cumulative tokens saved, day by day, so a trend (or a regression) is visible instead of just a
 * point-in-time total. A single day still renders as one dot rather than failing on an empty line. */
function SavedOverTimeChart({ daily }: { daily: ToolUsageDaily[] }) {
  const points = daily.reduce<{ date: string; cumulative: number }[]>((acc, d) => {
    const cumulative = (acc.at(-1)?.cumulative ?? 0) + d.savedTokens
    return [...acc, { date: d.date, cumulative }]
  }, [])

  const w = 640
  const h = 160
  const padL = 8
  const padR = 8
  const padT = 12
  const padB = 22
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const values = points.map((p) => p.cumulative)
  const minV = Math.min(0, ...values)
  const maxV = Math.max(0, ...values)
  const span = maxV - minV || 1
  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - ((v - minV) / span) * innerH
  const zeroY = y(0)
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.cumulative).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${x(0).toFixed(1)} ${zeroY.toFixed(1)} Z`

  return (
    <svg className="saved-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Cumulative tokens saved by day">
      <line x1={padL} y1={zeroY} x2={w - padR} y2={zeroY} className="saved-axis" />
      <path d={areaPath} className="saved-area" />
      <path d={linePath} className="saved-line" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.cumulative)} r={3.5} className="saved-dot">
          <title>{`${p.date}: ${signed(p.cumulative)} tokens saved so far`}</title>
        </circle>
      ))}
      <text x={padL} y={h - 6} className="saved-tick">
        {points[0].date}
      </text>
      {points.length > 1 && (
        <text x={w - padR} y={h - 6} textAnchor="end" className="saved-tick">
          {points[points.length - 1].date}
        </text>
      )}
    </svg>
  )
}

export default function MetricsPage() {
  const [days, setDays] = useState<number | undefined>(undefined)
  const summary = useAsync(() => api.metricsSummary(days), [days])
  const s = summary.data

  return (
    <div className="page">
      <h1 className="doc-title">Metrics</h1>
      <p className="muted">
        What every MCP tool call actually returned versus what reading the full current body of each doc it touched would have cost.
        Both sides use the same rough estimate as the rest of the app (chars/4), so this is a relative savings number, not an exact
        count from a real tokenizer. Nothing here reflects edits made in this web UI, only calls made through the MCP server.
      </p>

      <div className="seg metrics-windows">
        {WINDOWS.map((w) => (
          <button key={w.label} className={days === w.days ? 'on' : ''} onClick={() => setDays(w.days)}>
            {w.label}
          </button>
        ))}
      </div>

      {summary.error && <div className="error-box">{summary.error}</div>}
      {!s && !summary.error && <p className="muted">Loading…</p>}

      {s && s.calls === 0 && (
        <p className="muted">No recorded tool calls yet for this window. Ask your agent to use one of the Waydocs tools, then check back.</p>
      )}

      {s && s.calls > 0 && (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="tile-n">{fmt(s.calls)}</span>
              <span>tool calls</span>
            </div>
            <div className="tile">
              <span className="tile-n">{fmt(s.baselineTokens)}</span>
              <span>tokens a full-file read would have cost</span>
            </div>
            <div className="tile">
              <span className="tile-n">{fmt(s.actualTokens)}</span>
              <span>tokens actually returned</span>
            </div>
            <div className="tile">
              <span className={`tile-n ${s.savedTokens >= 0 ? 'ok' : 'err'}`}>{signed(s.savedTokens)}</span>
              <span>tokens saved ({pct(s.savedTokens, s.baselineTokens)}%)</span>
            </div>
          </div>

          {s.firstCallUtc && s.lastCallUtc && (
            <p className="muted small">
              First call {relTime(s.firstCallUtc)}, most recent {relTime(s.lastCallUtc)}.
            </p>
          )}

          {s.daily.length > 0 && (
            <section className="metrics-section">
              <h3>Tokens saved over time</h3>
              <SavedOverTimeChart daily={s.daily} />
            </section>
          )}

          <section className="metrics-section">
            <h3>Tokens by tool</h3>
            <ByToolChart byTool={s.byTool} />
          </section>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th className="num">Calls</th>
                  <th className="num">Would've cost</th>
                  <th className="num">Actually returned</th>
                  <th className="num">Saved</th>
                </tr>
              </thead>
              <tbody>
                {s.byTool.map((t) => (
                  <tr key={t.tool}>
                    <td className="mono">{t.tool}</td>
                    <td className="num mono">{fmt(t.calls)}</td>
                    <td className="num mono">{fmt(t.baselineTokens)}</td>
                    <td className="num mono">{fmt(t.actualTokens)}</td>
                    <td className={`num mono ${t.savedTokens >= 0 ? '' : 'err'}`}>
                      {signed(t.savedTokens)} ({pct(t.savedTokens, t.baselineTokens)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
