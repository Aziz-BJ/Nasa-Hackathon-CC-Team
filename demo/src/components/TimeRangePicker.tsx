// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { PencilSimple } from '@phosphor-icons/react'
import { useId, useMemo, useState } from 'react'
import { RAMP } from '../config'
import { buildCountScale, type PaletteId } from '../lib/colorScale'
import { formatYm, labelYm, MONTH_LONG, monthsBetween, parseYm, type YearMonth } from '../lib/months'
import type { QuickRange } from '../state/appState'
import { MonthRangeSlider } from './MonthRangeSlider'

export interface TimeRangePickerProps {
  first: YearMonth
  last: YearMonth
  from: YearMonth
  to: YearMonth
  quick: QuickRange[]
  onChange: (from: YearMonth, to: YearMonth) => void
  /** Hotspots per month for the chosen area, from \`first\` to \`last\`, drawn as the bar's colours. */
  activity?: (number | null)[]
  palette?: PaletteId
}

function MonthSelect({ label, value, first, last, onChange }: {
  label: string; value: YearMonth; first: YearMonth; last: YearMonth; onChange: (ym: YearMonth) => void
}) {
  const id = useId()
  const { year, month } = parseYm(value)
  const y0 = parseYm(first).year
  const y1 = parseYm(last).year
  const clamp = (ym: YearMonth) => (ym < first ? first : ym > last ? last : ym)
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="small">{label}</span>
      <div className="row">
        <label className="sr-only" htmlFor={`${id}-m`}>{label} month</label>
        <select id={`${id}-m`} value={month} onChange={(e) => onChange(clamp(formatYm(year, Number(e.target.value))))}>
          {MONTH_LONG.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        <label className="sr-only" htmlFor={`${id}-y`}>{label} year</label>
        <select id={`${id}-y`} value={year} onChange={(e) => onChange(clamp(formatYm(Number(e.target.value), month)))}>
          {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  )
}

export function TimeRangePicker({ first, last, from, to, quick, onChange, activity, palette = 'inferno' }: TimeRangePickerProps) {
  const [manual, setManual] = useState(false)
  const colors = useMemo(() => {
    if (!activity) return undefined
    const scale = buildCountScale(activity, { ...RAMP, palette })
    return activity.map((v) => scale.colorOf(v))
  }, [activity, palette])
  const count = monthsBetween(from, to) + 1
  return (
    <div className="range-picker">
      <div className="range-head">
        <div>
          <div className="range-value">{labelYm(from)} – {labelYm(to)}</div>
          <div className="small muted">{count} {count === 1 ? 'month' : 'months'}</div>
        </div>
        <button type="button" className="round-btn small-round" aria-expanded={manual} aria-controls={manual ? 'manual-dates' : undefined}
          aria-label="Enter dates manually" title="Enter dates manually" onClick={() => setManual((x) => !x)}>
          <PencilSimple weight="bold" aria-hidden />
        </button>
      </div>
      <MonthRangeSlider first={first} last={last} from={from} to={to} colors={colors} onChange={onChange} />
      {manual && (
        <div className="row" id="manual-dates">
          <MonthSelect label="From" value={from} first={first} last={last} onChange={(ym) => onChange(ym, to)} />
          <MonthSelect label="To" value={to} first={first} last={last} onChange={(ym) => onChange(from, ym)} />
        </div>
      )}
      <div className="chips" aria-label="Quick ranges">
        {quick.map((q) => (
          <button key={q.label} type="button" className="btn" aria-pressed={q.from === from && q.to === to} onClick={() => onChange(q.from, q.to)}>
            {q.label}
          </button>
        ))}
      </div>
      <p className="small muted">Drag the handles or use the arrow keys. The bar shows hotspots per month for this area. All months are UTC; colours rescale to the months you choose.</p>
    </div>
  )
}
