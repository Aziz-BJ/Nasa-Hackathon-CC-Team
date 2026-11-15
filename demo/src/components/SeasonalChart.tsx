// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// NSIDC-style season chart: the focus year against the baseline median, middle 50% and middle 80%.
import * as Plot from '@observablehq/plot'
import { useCallback } from 'react'
import { sameMonthBaseline } from '../lib/indices'
import { MONTH_SHORT, parseYm, type YearMonth } from '../lib/months'
import { PlotFigure } from './PlotFigure'

export interface SeasonalChartProps {
  months: YearMonth[]
  values: (number | null)[]
  focusYear: number
  baselineYears: [number, number]
  seriesLabel: string
}

export function SeasonalChart({ months, values, focusYear, baselineYears, seriesLabel }: SeasonalChartProps) {
  const make = useCallback((width: number) => {
    const bands = Array.from({ length: 12 }, (_, i) => {
      const b = sameMonthBaseline(values, months, i + 1, baselineYears, focusYear)
      return b ? { m: i + 1, p10: b.p10, p25: b.p25, med: b.median, p75: b.p75, p90: b.p90 } : null
    }).filter((x) => x !== null)
    const yearLine = (year: number) =>
      months.map((ym, i) => ({ ...parseYm(ym), v: values[i] }))
        .filter((x) => x.year === year && x.v !== null)
        .map((x) => ({ m: x.month, v: x.v as number }))
    const focus = yearLine(focusYear)
    const prev = yearLine(focusYear - 1)
    return Plot.plot({
      width, height: 320, marginLeft: 56,
      style: { background: 'transparent', color: 'rgba(235,235,245,0.85)', fontSize: '12px', fontFamily: 'inherit' },
      x: { domain: [1, 12], ticks: 12, tickFormat: (m: number) => MONTH_SHORT[m - 1], label: null },
      y: { grid: true, label: 'Hotspots detected', zero: true },
      marks: [
        Plot.areaY(bands, { x: 'm', y1: 'p10', y2: 'p90', fill: '#409cff', fillOpacity: 0.18, curve: 'monotone-x' }),
        Plot.areaY(bands, { x: 'm', y1: 'p25', y2: 'p75', fill: '#409cff', fillOpacity: 0.36, curve: 'monotone-x' }),
        Plot.line(bands, { x: 'm', y: 'med', stroke: '#ffffff', strokeDasharray: '5,4', curve: 'monotone-x' }),
        Plot.line(prev, { x: 'm', y: 'v', stroke: 'rgba(235,235,245,0.55)', strokeWidth: 1, curve: 'monotone-x' }),
        Plot.line(focus, { x: 'm', y: 'v', stroke: '#ff9f0a', strokeWidth: 2.5, curve: 'monotone-x' }),
        Plot.dot(focus, { x: 'm', y: 'v', fill: '#ff9f0a', r: 3.5, tip: true, title: (d: { m: number; v: number }) => `${MONTH_SHORT[d.m - 1]} ${focusYear}: ${Math.round(d.v)}` }),
        Plot.text(focus.slice(-1), { x: 'm', y: 'v', text: () => String(focusYear), dx: 8, textAnchor: 'start', fill: '#ff9f0a', fontWeight: 700 }),
      ],
    })
  }, [months, values, focusYear, baselineYears])
  const [y0, y1] = baselineYears
  return (
    <figure className="card" id="seasons">
      <header><h2>{focusYear} against a typical year</h2></header>
      <PlotFigure make={make} label={`Line chart of monthly hotspots in ${focusYear} against the ${y0} to ${y1} median and ranges.`} />
      <figcaption className="caption">
        Orange: {focusYear}. Grey: {focusYear - 1}. Dashed white: median of {y0} to {y1} (leaving out {focusYear}).
        Dark band: middle 50% of years. Light band: middle 80% of years. {seriesLabel}.
      </figcaption>
    </figure>
  )
}
