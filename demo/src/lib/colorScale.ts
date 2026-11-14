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
  let thresholds: number[] = []
  if (pos.length > 1) {
    for (let k = 1; k < opts.bins; k++) {
      thresholds.push(
        opts.method === 'quantile'
          ? quantile(pos, k / opts.bins)
          : nice(min * (max / min) ** (k / opts.bins)),
      )
    }
    thresholds = [...new Set(thresholds.map((t) => Math.round(t * 10) / 10))].filter((t) => t > min && t <= max)
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

/** Anomaly bins in percent. Blue = fewer hotspots than usual, red = more (never red-green). */
export const ANOMALY_EDGES = [-50, -25, -10, 10, 25, 50]
const ANOMALY_T = [0.92, 0.78, 0.64, 0.5, 0.36, 0.22, 0.08]
export const ANOMALY_COLORS = ANOMALY_T.map((t) => interpolateRdBu(t))
export const ANOMALY_LABELS = [
  '50% or more below', '25 to 50% below', '10 to 25% below', 'Within 10%',
  '10 to 25% above', '25 to 50% above', '50% or more above',
]

export function anomalyBin(pct: number): number {
  let i = 0
  while (i < ANOMALY_EDGES.length && pct >= ANOMALY_EDGES[i]) i++
  // pct exactly 10 belongs to "within 10%"; pct exactly -10 too
  if (i === 4 && pct === 10) return 3
  return i
}

export function anomalyColor(pct: number | null): string {
  return pct === null ? NO_DATA_FILL : ANOMALY_COLORS[anomalyBin(pct)]
}
