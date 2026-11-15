// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The core evidence: raw MODIS and raw VIIRS disagree; a record spliced from the raw counts jumps where the source
// switches (July 2021, as in the harmonized record); the harmonized line does not.
import * as Plot from '@observablehq/plot'
import { useCallback, useMemo } from 'react'
import type { AreaSeries } from '../lib/aggregate'
import { parseYm } from '../lib/months'
import { SERIES_KEYS } from '../lib/types'
import { chartFilename, type SvgMeta } from '../lib/download'
import { PlotFigure } from './PlotFigure'

// Okabe-Ito colours (safe for colour-vision deficiency) plus a dash pattern and a symbol per line.
const STYLE: Record<string, { label: string; color: string; dash: string; symbol: string }> = {
  harmonized: { label: 'Harmonized (Aqua MODIS scale)', color: '#ffffff', dash: '', symbol: 'circle' },
  modis: { label: 'Aqua MODIS raw', color: '#E69F00', dash: '6,3', symbol: 'square' },
  viirs_snpp: { label: 'S-NPP VIIRS raw', color: '#56B4E9', dash: '2,3', symbol: 'triangle' },
  viirs_noaa20: { label: 'NOAA-20 VIIRS raw', color: '#009E73', dash: '8,3,2,3', symbol: 'diamond' },
  stitched: { label: 'Naive splice (raw Aqua, then raw S-NPP from July 2021)', color: '#CC79A7', dash: '1,0', symbol: 'cross' },
}

interface Row { key: string; year: number; v: number }

/** Yearly totals per series. A year counts only when all 12 months exist for that series. */
export const SWITCH_MONTH = '2021-07'

export function yearlyTotals(s: AreaSeries): Row[] {
  const rows: Row[] = []
  const acc = new Map<string, { sum: number; n: number }>()
  const add = (key: string, year: number, v: number | null) => {
    if (v === null) return
    const k = `${key}|${year}`
    const a = acc.get(k) ?? { sum: 0, n: 0 }
    acc.set(k, { sum: a.sum + v, n: a.n + 1 })
  }
  s.months.forEach((ym, i) => {
    const { year } = parseYm(ym)
    for (const key of SERIES_KEYS) add(key, year, s.values[key][i])
    add('stitched', year, ym < SWITCH_MONTH ? s.values.modis[i] : s.values.viirs_snpp[i] ?? s.values.viirs_noaa20[i])
  })
  for (const [k, a] of acc) {
    const [key, year] = k.split('|')
    if (a.n === 12) rows.push({ key, year: Number(year), v: a.sum })
  }
  return rows.sort((a, b) => a.year - b.year)
}

export function OverlapChart({ series, unit, areaLabel }: {
  series: AreaSeries; unit: string
  /** The selected area's name, written into the downloaded image and its filename. */
  areaLabel?: string
}) {
  const make = useCallback((width: number) => {
    const rows = yearlyTotals(series)
    const keys = Object.keys(STYLE).filter((k) => rows.some((r) => r.key === k))
    return Plot.plot({
      width, height: 360, marginLeft: 64, marginRight: 20,
      style: { background: 'transparent', color: 'rgba(235,235,245,0.85)', fontSize: '12px', fontFamily: 'inherit' },
      x: { label: null, tickFormat: 'd' },
      y: { label: `${unit.charAt(0).toUpperCase() + unit.slice(1)} per year`, grid: true, zero: true },
      marks: [
        Plot.ruleX([2012, 2021.5], { stroke: 'rgba(235,235,245,0.55)', strokeDasharray: '3,3' }),
        Plot.text([2012], { x: (d: number) => d, frameAnchor: 'top', dy: 6, dx: 4, textAnchor: 'start', text: () => 'S-NPP starts', fill: 'rgba(235,235,245,0.7)' }),
        Plot.text([2021.5], { x: (d: number) => d, frameAnchor: 'top', dy: 22, dx: -4, textAnchor: 'end', text: () => 'record switches to converted VIIRS', fill: 'rgba(235,235,245,0.7)' }),
        ...keys.flatMap((k) => {
          const d = rows.filter((r) => r.key === k)
          const st = STYLE[k]
          return [
            Plot.line(d, { x: 'year', y: 'v', stroke: st.color, strokeWidth: k === 'harmonized' ? 3 : 1.75, strokeDasharray: st.dash }),
            Plot.dot(d, { x: 'year', y: 'v', stroke: st.color, fill: k === 'harmonized' ? st.color : 'none', symbol: () => st.symbol, r: 3,
              tip: true, title: (r: Row) => `${st.label}, ${r.year}: ${Math.round(r.v).toLocaleString('en-GB')}` }),
          ]
        }),
      ],
    })
  }, [series, unit])
  const meta = useMemo<SvgMeta>(() => {
    const rows = yearlyTotals(series)
    return {
      title: 'Why harmonize: one record, two instruments',
      area: areaLabel,
      unit: `${unit} per year (full calendar years only)`,
      legend: Object.entries(STYLE).filter(([k]) => rows.some((r) => r.key === k))
        .map(([, st]) => ({ label: st.label, color: st.color, dash: st.dash && st.dash !== '1,0' ? st.dash : undefined })),
    }
  }, [series, unit, areaLabel])
  return (
    <figure className="card" id="sensors">
      <header><h2>Why harmonize: one record, two instruments</h2></header>
      <PlotFigure make={make} filename={chartFilename('modis-vs-viirs', areaLabel)} meta={meta} label={`Line chart of yearly ${unit} for raw Aqua MODIS, raw S-NPP and NOAA-20 VIIRS, a naive splice of the raw counts, and the harmonized record.`} />
      <div className="legend" aria-label="Lines">
        {Object.entries(STYLE).map(([k, st]) => (
          <span key={k}><span className="swatch" style={{ background: 'none', borderTop: `3px ${st.dash ? 'dashed' : 'solid'} ${st.color}`, height: 0 }} />{st.label}</span>
        ))}
      </div>
      <figcaption className="caption">
        Whole record for this area, full calendar years only. VIIRS sees much smaller fires than MODIS (375 m pixels against 1 km), so it counts several times more fire cell-days.
        Splicing the raw counts where the record changes source (pink) makes a false jump. The harmonized line converts VIIRS to the Aqua MODIS scale, so every year is comparable.
        Aqua's own line after 2021 drifts with its orbit and is not used in the record.
      </figcaption>
    </figure>
  )
}
