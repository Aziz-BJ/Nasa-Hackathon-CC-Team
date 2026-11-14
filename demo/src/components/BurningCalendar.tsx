// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Years x months. An HTML table, not a canvas, so screen readers and keyboards get the same numbers.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { fmtCount, type CountScale } from '../lib/colorScale'
import { textClass } from '../lib/contrast'
import { formatYm, labelYm, MONTH_SHORT, parseYm, type YearMonth } from '../lib/months'
import { STATUS_LABELS, type MonthStatus } from '../lib/status'

export interface BurningCalendarProps {
  months: YearMonth[]
  values: (number | null)[]
  from: YearMonth
  to: YearMonth
  scale: CountScale
  /** Typical value of each calendar month (Jan..Dec) over the baseline years. Include these in the scale. */
  medians: (number | null)[]
  statusOf: (ym: YearMonth) => MonthStatus
  baselineYears: [number, number]
  seriesLabel: string
  legendId: string
  onFocusMonth?: (ym: YearMonth) => void
}

/** Months outside the chosen range are shown dimmed and neutral: they are not part of the colour bins. */
const OUTSIDE_FILL = '#3a3a40'

function toHex(color: string): string {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color)
  return m ? '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('') : color
}

export function BurningCalendar(p: BurningCalendarProps) {
  const index = useMemo(() => new Map(p.months.map((ym, i) => [ym, i])), [p.months])
  const y0 = parseYm(p.from).year
  const y1 = parseYm(p.to).year
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
  const [showNumbers, setShowNumbers] = useState(false)
  const [active, setActive] = useState<YearMonth>(p.to)
  const tableRef = useRef<HTMLTableElement>(null)

  const valueOf = (ym: YearMonth) => {
    const i = index.get(ym)
    return i === undefined ? null : p.values[i]
  }
  const inRange = (ym: YearMonth) => ym >= p.from && ym <= p.to

  // Totals over the chosen months only. A year with fewer counted months says so, so it isn't read as a full year.
  const yearTotals = years.map((y) => {
    let total: number | null = null
    let counted = 0
    for (let m = 1; m <= 12; m++) {
      const ym = formatYm(y, m)
      const v = valueOf(ym)
      if (inRange(ym) && v !== null) { total = (total ?? 0) + v; counted++ }
    }
    return { total, counted }
  })
  const maxTotal = Math.max(1, ...yearTotals.map((t) => t.total ?? 0))

  function describe(ym: YearMonth): string {
    const v = valueOf(ym)
    const status = p.statusOf(ym)
    if (v === null) return `${labelYm(ym)}: no data (${STATUS_LABELS[status]}).`
    return `${labelYm(ym)}: ${fmtCount(v)} hotspots detected, ${p.seriesLabel}. ${STATUS_LABELS[status]}.${inRange(ym) ? '' : ' Outside the chosen months.'}`
  }

  function move(ev: KeyboardEvent<HTMLTableElement>) {
    const { year, month } = parseYm(active)
    const delta: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    let next: YearMonth | null = null
    if (delta[ev.key]) {
      const [dy, dm] = delta[ev.key]
      const ny = year + dy
      const nm = month + dm
      if (ny >= y0 && ny <= y1 && nm >= 1 && nm <= 12) next = formatYm(ny, nm)
    } else if (ev.key === 'Home') next = formatYm(year, 1)
    else if (ev.key === 'End') next = formatYm(year, 12)
    if (!next) return
    ev.preventDefault()
    setActive(next)
    p.onFocusMonth?.(next)
    tableRef.current?.querySelector<HTMLElement>(`[data-ym="${next}"]`)?.focus()
  }

  const activeInView = parseYm(active).year >= y0 && parseYm(active).year <= y1 ? active : p.to

  return (
    <div>
      <label className="small"><input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} /> Show numbers in cells (table view)</label>
      <div className="calendar-wrap">
        <table className="calendar" ref={tableRef} onKeyDown={move} aria-describedby={p.legendId}>
          <caption className="sr-only">
            Burning calendar: hotspots detected per month, {p.from} to {p.to}, {p.seriesLabel}. Use arrow keys to move between months.
          </caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Year</span></th>
              {MONTH_SHORT.map((m) => <th key={m} scope="col">{m}</th>)}
              <th scope="col">Year total</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y, yi) => (
              <tr key={y}>
                <th scope="row">{y}</th>
                {MONTH_SHORT.map((_, mi) => {
                  const ym = formatYm(y, mi + 1)
                  const v = valueOf(ym)
                  const status = p.statusOf(ym)
                  const fill = inRange(ym) ? p.scale.colorOf(v) : OUTSIDE_FILL
                  const cls = ['c',
                    v === null ? 'nodata' : v === 0 ? 'zero' : '',
                    inRange(ym) ? '' : 'outside',
                    status === 'nrt' ? 'nrt' : '', status === 'partial' ? 'partial' : '',
                    v !== null ? textClass(toHex(fill)) : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td key={ym} data-ym={ym} className={cls} style={{ background: fill }}
                      tabIndex={ym === activeInView ? 0 : -1} aria-label={describe(ym)}
                      onFocus={() => { setActive(ym); p.onFocusMonth?.(ym) }}
                      onMouseEnter={() => p.onFocusMonth?.(ym)}>
                      {showNumbers && v !== null ? fmtCount(v) : ''}
                    </td>
                  )
                })}
                <td className="total">
                  <span className={`bar${yearTotals[yi].counted < 12 ? ' part' : ''}`} style={{ width: `${((yearTotals[yi].total ?? 0) / maxTotal) * 4}rem` }} aria-hidden />
                  {yearTotals[yi].total === null ? '' : fmtCount(yearTotals[yi].total as number)}
                  {yearTotals[yi].total !== null && yearTotals[yi].counted < 12 && <span className="muted"> ({yearTotals[yi].counted} of 12 months)</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Median {p.baselineYears[0]}–{p.baselineYears[1]}</th>
              {p.medians.map((v, i) => {
                const fill = p.scale.colorOf(v)
                return (
                  <td key={i} className={`c ${v === null ? 'nodata' : textClass(toHex(fill))}`} style={{ background: fill }}>
                    {v === null ? '' : fmtCount(v)}
                  </td>
                )
              })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
