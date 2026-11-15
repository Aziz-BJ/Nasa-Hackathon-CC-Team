// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// NSIDC-style season chart: the focus year against the baseline median, middle 50% and middle 80%.
import * as Plot from '@observablehq/plot'
import { useCallback, useMemo } from 'react'
import { sameMonthBaseline } from '../lib/indices'
import { MONTH_SHORT, parseYm, type YearMonth } from '../lib/months'
import { chartFilename, type SvgMeta } from '../lib/download'
import { PlotFigure } from './PlotFigure'

export interface SeasonalChartProps {
  months: YearMonth[]
  values: (number | null)[]
  focusYear: number
  baselineYears: [number, number]
  seriesLabel: string
  unit: string
  /** 90% range of each month, drawn on the focus year when the record has one. */
  low?: (number | null)[] | null
  high?: (number | null)[] | null
  /** The unfinished month, left out of the year's line (it is not comparable with whole months). */
  skip?: YearMonth | null
  /** The selected area's name, written into the downloaded image and its filename. */
  areaLabel?: string
}

export function SeasonalChart({ months, values, focusYear, baselineYears, seriesLabel, unit, low, high, skip = null, areaLabel }: SeasonalChartProps) {
  const make = useCallback((width: number) => {
    const bands = Array.from({ length: 12 }, (_, i) => {
      const b = sameMonthBaseline(values, months, i + 1, baselineYears, focusYear)
      return b ? { m: i + 1, p10: b.p10, p25: b.p25, med: b.median, p75: b.p75, p90: b.p90 } : null
    }).filter((x) => x !== null)
    const yearLine = (year: number) =>
      months.map((ym, i) => ({ ...parseYm(ym), ym, v: values[i] }))
        .filter((x) => x.year === year && x.v !== null && x.ym !== skip)
        .map((x) => ({ m: x.month, v: x.v as number }))
    const focus = yearLine(focusYear)
    const prev = yearLine(focusYear - 1)
    const ranges = low && high
      ? months.map((ym, i) => ({ ...parseYm(ym), ym, lo: low[i], hi: high[i], v: values[i] }))
        .filter((x) => x.year === focusYear && x.ym !== skip && x.lo !== null && x.hi !== null && x.hi > x.lo)
        .map((x) => ({ m: x.month, lo: x.lo as number, hi: x.hi as number }))
      : []
    return Plot.plot({
      width, height: 320, marginLeft: 56,
      style: { background: 'transparent', color: 'rgba(235,235,245,0.85)', fontSize: '12px', fontFamily: 'inherit' },
      x: { domain: [1, 12], ticks: 12, tickFormat: (m: number) => MONTH_SHORT[m - 1], label: null },
      y: { grid: true, label: unit.charAt(0).toUpperCase() + unit.slice(1), zero: true },
      marks: [
        Plot.areaY(bands, { x: 'm', y1: 'p10', y2: 'p90', fill: '#409cff', fillOpacity: 0.18, curve: 'monotone-x' }),
        Plot.areaY(bands, { x: 'm', y1: 'p25', y2: 'p75', fill: '#409cff', fillOpacity: 0.36, curve: 'monotone-x' }),
        Plot.line(bands, { x: 'm', y: 'med', stroke: '#ffffff', strokeDasharray: '5,4', curve: 'monotone-x' }),
        Plot.line(prev, { x: 'm', y: 'v', stroke: 'rgba(235,235,245,0.55)', strokeWidth: 1, curve: 'monotone-x' }),
        Plot.ruleX(ranges, { x: 'm', y1: 'lo', y2: 'hi', stroke: '#ff9f0a', strokeOpacity: 0.6, strokeWidth: 6, strokeLinecap: 'round' }),
        Plot.line(focus, { x: 'm', y: 'v', stroke: '#ff9f0a', strokeWidth: 2.5, curve: 'monotone-x' }),
        Plot.dot(focus, { x: 'm', y: 'v', fill: '#ff9f0a', r: 3.5, tip: true, title: (d: { m: number; v: number }) => `${MONTH_SHORT[d.m - 1]} ${focusYear}: ${Math.round(d.v)}` }),
        Plot.text(focus.slice(-1), { x: 'm', y: 'v', text: () => String(focusYear), dx: 8, textAnchor: 'start', fill: '#ff9f0a', fontWeight: 700 }),
      ],
    })
  }, [months, values, focusYear, baselineYears, unit, low, high, skip])
  const [y0, y1] = baselineYears
  const meta = useMemo<SvgMeta>(() => ({
    title: `${focusYear} against a typical year`,
    area: areaLabel,
    unit: `${unit} per month`,
    legend: [
      { label: String(focusYear), color: '#ff9f0a' },
      ...(low && high ? [{ label: `${focusYear} 90% range (converted months)`, color: '#ff9f0a', kind: 'swatch' as const, opacity: 0.6 }] : []),
      { label: String(focusYear - 1), color: 'rgba(235,235,245,0.55)' },
      { label: `Median ${y0} to ${y1}`, color: '#ffffff', dash: '5,4' },
      { label: 'Middle 50% of years', color: '#409cff', kind: 'swatch' as const, opacity: 0.36 },
      { label: 'Middle 80% of years', color: '#409cff', kind: 'swatch' as const, opacity: 0.18 },
    ],
  }), [focusYear, areaLabel, unit, low, high, y0, y1])
  return (
    <figure className="card" id="seasons">
      <header><h2>{focusYear} against a typical year</h2></header>
      <PlotFigure make={make} filename={chartFilename(`fire-season-${focusYear}`, areaLabel)} meta={meta} label={`Line chart of monthly ${unit} in ${focusYear} against the ${y0} to ${y1} median and ranges.`} />
      <figcaption className="caption">
        Orange: {focusYear}{low && high ? ', with its 90% range where the month is converted from VIIRS' : ''}. Grey: {focusYear - 1}. Dashed white: median of {y0} to {y1} (leaving out {focusYear}).
        Dark band: middle 50% of years. Light band: middle 80% of years. {seriesLabel}.
        {skip && parseYm(skip).year === focusYear && <> {MONTH_SHORT[parseYm(skip).month - 1]} {focusYear} is not finished and is left out.</>}
      </figcaption>
    </figure>
  )
}
