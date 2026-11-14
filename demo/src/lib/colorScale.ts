// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Colour ramps. Count bins are rebuilt from the values inside the selected months, so the
// colours are relative to the time range (RAMP in config.ts sets the method; tune with real data).
import { interpolateCividis, interpolateInferno, interpolateRdBu } from 'd3-scale-chromatic'
import { quantile } from './indices'

export type PaletteId = 'inferno' | 'cividis'
export type RampMethod = 'quantile' | 'log'

export const PALETTES: Record<PaletteId, { label: string; interpolate: (t: number) => string }> = {
  inferno: { label: 'Fire (inferno)', interpolate: interpolateInferno },
  cividis: { label: 'Colour-vision optimised (cividis)', interpolate: interpolateCividis },
}

export const ZERO_FILL = '#16285a'
export const NO_DATA_FILL = '#5c6680'

export interface CountScale {
  /** Lower bound of each bin. Bin i covers [edges[i], edges[i+1]) and the last bin goes up to max. */
  edges: number[]
  max: number
  colors: string[]
  colorOf(v: number | null): string
  binOf(v: number): number
  labels: string[]
}

export function fmtCount(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) < 10) return (Math.round(v * 10) / 10).toLocaleString('en-GB')
  return Math.round(v).toLocaleString('en-GB')
}

function nice(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x))
  const f = x / p
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p
}

export function buildCountScale(
  values: (number | null)[],
  opts: { method: RampMethod; bins: number; palette: PaletteId },
): CountScale {
  const pos = values.filter((v): v is number => v !== null && v > 0).sort((a, b) => a - b)
  const min = pos[0] ?? 1
  const max = pos[pos.length - 1] ?? 1
  const make = (method: RampMethod) => {
    const t: number[] = []
    for (let k = 1; k < opts.bins; k++) {
      t.push(method === 'quantile' ? quantile(pos, k / opts.bins) : nice(min * (max / min) ** (k / opts.bins)))
    }
    return [...new Set(t.map((x) => Math.round(x * 10) / 10))].filter((x) => x > min && x <= max)
  }
  let thresholds: number[] = []
  if (pos.length > 1) {
    thresholds = make(opts.method)
    // Many tied low counts (lots of 1s and 2s) collapse quantile bins, so 2 and 1000 would share a colour.
    // Then log bins keep the high values apart.
    const distinct = new Set(pos).size
    if (opts.method === 'quantile' && thresholds.length + 1 < Math.min(opts.bins, distinct)) thresholds = make('log')
  }
  const edges = [min, ...thresholds]
  const interp = PALETTES[opts.palette].interpolate
  const n = edges.length
  const colors = edges.map((_, i) => interp(0.2 + 0.78 * (n === 1 ? 1 : i / (n - 1))))
  const binOf = (v: number) => {
    let i = 0
    while (i + 1 < n && v >= edges[i + 1]) i++
    return i
  }
  const labels = edges.map((lo, i) => (i + 1 < n ? `${fmtCount(lo)} to <${fmtCount(edges[i + 1])}` : `${fmtCount(lo)} to ${fmtCount(max)}`))
  return {
    edges, max, colors, labels, binOf,
    colorOf: (v) => (v === null ? NO_DATA_FILL : v <= 0 ? ZERO_FILL : colors[binOf(v)]),
  }
}

/** Anomaly bins in percent, symmetric around 0. Blue = fewer hotspots than usual, red = more (never red-green). */
const ANOMALY_T = [0.92, 0.78, 0.64, 0.5, 0.36, 0.22, 0.08]
export const ANOMALY_COLORS = ANOMALY_T.map((t) => interpolateRdBu(t))
export const ANOMALY_LABELS = [
  'More than 50% below', '25 to 50% below', '10 to 25% below', 'Within 10%',
  '10 to 25% above', '25 to 50% above', 'More than 50% above',
]

/** 0..6: |pct| up to 10 is bin 3; up to 25, up to 50, and beyond step outwards on each side. */
export function anomalyBin(pct: number): number {
  const a = Math.abs(pct)
  const step = a <= 10 ? 0 : a <= 25 ? 1 : a <= 50 ? 2 : 3
  return pct < 0 ? 3 - step : 3 + step
}

export function anomalyColor(pct: number | null): string {
  return pct === null ? NO_DATA_FILL : ANOMALY_COLORS[anomalyBin(pct)]
}
