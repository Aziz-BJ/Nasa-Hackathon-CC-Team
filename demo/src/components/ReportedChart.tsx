// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// "Number of fires detected and reported": satellite detections next to fires reported on the ground,
// shown only for preset regions that have a published ground statistic. Context only; never replaces FIRMS.
import * as Plot from '@observablehq/plot'
import { useCallback } from 'react'
import { addMonths, monthRange, type YearMonth } from '../lib/months'
import type { ReportedSeries } from '../lib/types'
import { PlotFigure } from './PlotFigure'

export interface ReportedChartProps {
  reported: ReportedSeries
  months: YearMonth[]
  detected: (number | null)[]
  from: YearMonth
  to: YearMonth
}

const toDate = (ym: YearMonth) => new Date(`${ym}-01T00:00:00Z`)

export function ReportedChart({ reported, months, detected, from, to }: ReportedChartProps) {
  const make = useCallback((width: number) => {
    const rMonths = monthRange(reported.first_month, addMonths(reported.first_month, reported.values.length - 1))
    const rows: { date: Date; v: number; panel: string }[] = []
    rMonths.forEach((ym, i) => {
      const v = reported.values[i]
      if (ym >= from && ym <= to && v !== null) rows.push({ date: toDate(ym), v, panel: `Reported: ${reported.unit}` })
    })
    months.forEach((ym, i) => {
      const v = detected[i]
      if (ym >= from && ym <= to && v !== null) rows.push({ date: toDate(ym), v, panel: 'Detected: satellite fire cell-days' })
    })
    return Plot.plot({
      width, height: 380, marginLeft: 64,
      style: { background: 'transparent', color: 'rgba(235,235,245,0.85)', fontSize: '12px', fontFamily: 'inherit' },
      fy: { label: null },
      x: { type: 'utc', label: null },
      y: { grid: true, label: null },
      facet: { data: rows, y: 'panel', marginRight: 0 },
      marks: [
        Plot.lineY(rows, { x: 'date', y: 'v', fy: 'panel', stroke: (d: { panel: string }) => (d.panel.startsWith('Detected') ? '#ff9f0a' : '#409cff'), strokeWidth: 1.5 }),
        Plot.frame({ stroke: '#ffffff', strokeOpacity: 0.2 }),
      ],
    })
  }, [reported, months, detected, from, to])
  return (
    <figure className="card" id="reported">
      <header><h2>Fires detected and fires reported</h2></header>
      <PlotFigure make={make} filename={"detected-vs-reported.svg"} label="Two line charts: satellite fire cell-days and fires reported on the ground, by month." />
      <figcaption className="caption">
        Top and bottom use different units and scales. Ground reports count incidents attended; satellites count hot pixels.
        They are not expected to match, but busy seasons should line up. Source: {reported.source} ({reported.licence}). <a href={reported.url}>Data page</a>.
      </figcaption>
    </figure>
  )
}
