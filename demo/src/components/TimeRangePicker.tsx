// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useId } from 'react'
import { formatYm, MONTH_LONG, parseYm, type YearMonth } from '../lib/months'
import type { QuickRange } from '../state/appState'

export interface TimeRangePickerProps {
  first: YearMonth
  last: YearMonth
  from: YearMonth
  to: YearMonth
  quick: QuickRange[]
  onChange: (from: YearMonth, to: YearMonth) => void
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

export function TimeRangePicker({ first, last, from, to, quick, onChange }: TimeRangePickerProps) {
  return (
    <div>
      <div className="row">
        <MonthSelect label="From" value={from} first={first} last={last} onChange={(ym) => onChange(ym, to)} />
        <MonthSelect label="To" value={to} first={first} last={last} onChange={(ym) => onChange(from, ym)} />
      </div>
      <div className="chips" aria-label="Quick ranges">
        {quick.map((q) => (
          <button key={q.label} type="button" className="btn" aria-pressed={q.from === from && q.to === to} onClick={() => onChange(q.from, q.to)}>
            {q.label}
          </button>
        ))}
      </div>
      <p className="small muted">All months are UTC. Colours rescale to the months you choose.</p>
    </div>
  )
}
