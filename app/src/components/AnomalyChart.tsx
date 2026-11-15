// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Historical comparison: each month's anomaly against the multi-year average for that calendar month.
import * as Plot from '@observablehq/plot'
import { useCallback, useMemo, useState } from 'react'
import { ANOMALY_COLORS, ANOMALY_LABELS, anomalyColor, fmtCount } from '../lib/colorScale'
import { monthlyAnomalies } from '../lib/indices'
import { addMonths, labelYm, type YearMonth } from '../lib/months'
import { chartFilename, type SvgMeta } from '../lib/download'
import { PlotFigure } from './PlotFigure'

export interface AnomalyChartProps {
  months: YearMonth[]
  values: (number | null)[]
  i0: number
  i1: number
  baselineYears: [number, number]
  seriesLabel: string
  unit: string
  /** The unfinished month, left out: it is only comparable with the same days of earlier years (More info). */
  skip?: YearMonth | null
  /** The selected area's name, written into the downloaded image and its filename. */
  areaLabel?: string
}

const CLIP = 200
const toDate = (ym: YearMonth) => new Date(`${ym}-01T00:00:00Z`)

export function AnomalyChart({ months, values, i0, i1, baselineYears, seriesLabel, unit, skip = null, areaLabel }: AnomalyChartProps) {
  const [reference, setReference] = useState<'mean' | 'median'>('median')
  const make = useCallback((width: number) => {
    const data = monthlyAnomalies(values, months, i0, i1, baselineYears, reference).filter((a) => a.month !== skip).map((a) => ({
      ...a,
      start: toDate(a.month),
      end: toDate(addMonths(a.month, 1)),
      y: Math.max(-CLIP, Math.min(CLIP, a.anomalyPct)),
      color: anomalyColor(a.anomalyPct),
    }))
    return Plot.plot({
      width, height: 300, marginLeft: 56,
      style: { background: 'transparent', color: 'rgba(235,235,245,0.85)', fontSize: '12px', fontFamily: 'inherit' },
      x: { type: 'utc', label: null },
      y: { label: `% vs ${reference === 'mean' ? 'average' : 'median'}`, grid: true, domain: [-100, CLIP] },
      marks: [
        Plot.rectY(data, {
          x1: 'start', x2: 'end', y: 'y', fill: 'color', inset: 0.5, tip: true,
          title: (d: (typeof data)[number]) => `${labelYm(d.month)}: ${fmtCount(d.value)} ${unit}, ${Math.round(d.anomalyPct)}% vs ${fmtCount(d.reference)}`,
        }),
        Plot.ruleY([0], { stroke: '#ffffff' }),
      ],
    })
  }, [months, values, i0, i1, baselineYears, reference, unit, skip])
  const [y0, y1] = baselineYears
  const meta = useMemo<SvgMeta>(() => ({
    title: `Anomalies against the multi-year ${reference === 'mean' ? 'average' : 'median'}`,
    area: areaLabel,
    unit: `% difference of monthly ${unit} from the ${reference === 'mean' ? 'average' : 'median'} of the same month in ${y0} to ${y1}`,
    legend: ANOMALY_COLORS.map((color, i) => ({ label: ANOMALY_LABELS[i], color, kind: 'swatch' as const })),
  }), [reference, areaLabel, unit, y0, y1])
  return (
    <figure className="card" id="anomalies">
      <header>
        <h2>Anomalies against the multi-year {reference === 'mean' ? 'average' : 'median'}</h2>
        <label className="small">Compare with{' '}
          <select value={reference} onChange={(e) => setReference(e.target.value as 'mean' | 'median')}>
            <option value="median">median (robust to extreme years)</option>
            <option value="mean">average (mean)</option>
          </select>
        </label>
      </header>
      <PlotFigure make={make} filename={chartFilename('fire-anomalies', areaLabel)} meta={meta} label={`Bar chart of monthly anomalies from ${months[i0]} to ${months[i1]}.`} />
      <div className="legend" aria-label="Anomaly colours">
        {ANOMALY_COLORS.map((c, i) => <span key={c}><span className="swatch" style={{ background: c }} />{ANOMALY_LABELS[i]}</span>)}
      </div>
      <figcaption className="caption">
        Each bar is one month compared with the same calendar month in {y0} to {y1}, leaving out its own year. Blue: less fire activity than usual. Red: more.
        Bars are cut at +{CLIP}%; hover for the exact value. Months with a typical value below 5 {unit} use 5 as the divisor, so quiet winter months don't swing wildly. {seriesLabel}.
        {skip && months[i1] === skip && <> {labelYm(skip)} is not finished and is left out; More info compares it with the same days of earlier years.</>}
      </figcaption>
    </figure>
  )
}
