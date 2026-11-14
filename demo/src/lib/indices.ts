// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Key indices (HANDOVER.md F4). These are display statistics on already-harmonized counts;
// they are not the harmonization method, which belongs to Pierre.
import { MIN_BASELINE_YEARS, MIN_DENOMINATOR, VERDICT_THRESHOLDS } from '../config'
import { parseYm, type YearMonth } from './months'

type Series = (number | null)[]

/** Linear-interpolation quantile (same as numpy's default and R type 7). Input must be sorted. */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const h = (sorted.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

export interface BaselineStats {
  years: number[]
  values: number[]
  median: number
  mean: number
  sd: number
  p10: number
  p25: number
  p75: number
  p90: number
}

export function statsOf(years: number[], values: number[]): BaselineStats | null {
  if (values.length < MIN_BASELINE_YEARS) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1))
  return {
    years, values, mean, sd,
    median: quantile(sorted, 0.5),
    p10: quantile(sorted, 0.1), p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75), p90: quantile(sorted, 0.9),
  }
}

/** The same calendar month across the baseline years, leaving out excludeYear (a month is never its own baseline). */
export function sameMonthBaseline(
  series: Series, months: YearMonth[], calMonth: number,
  [y0, y1]: [number, number], excludeYear?: number,
): BaselineStats | null {
  const years: number[] = []
  const values: number[] = []
  months.forEach((ym, i) => {
    const { year, month } = parseYm(ym)
    const v = series[i]
    if (month === calMonth && year >= y0 && year <= y1 && year !== excludeYear && v !== null) {
      years.push(year)
      values.push(v)
    }
  })
  return statsOf(years, values)
}

/** (value - reference) / max(reference, floor) as a percentage. */
export function relativeAnomaly(value: number, reference: number, floor = MIN_DENOMINATOR): number {
  return ((value - reference) / Math.max(reference, floor)) * 100
}

/** Share of the sample below the value (ties count half), 0-100. */
export function percentileOf(value: number, sample: number[]): number {
  if (sample.length === 0) return NaN
  const below = sample.filter((v) => v < value).length
  const equal = sample.filter((v) => v === value).length
  return ((below + equal / 2) / sample.length) * 100
}

/** 1 = highest. Ties share the better rank. "of" counts the value itself plus the sample. */
export function rankOf(value: number, sample: number[]): { rank: number; of: number } {
  return { rank: sample.filter((v) => v > value).length + 1, of: sample.length + 1 }
}

export type VerdictLevel = 'well-below' | 'below' | 'typical' | 'above' | 'well-above'

export const VERDICT_LABELS: Record<VerdictLevel, string> = {
  'well-below': 'Well below typical',
  below: 'Below typical',
  typical: 'Near typical',
  above: 'Above typical',
  'well-above': 'Well above typical',
}

export function verdictFor(percentile: number, [a, b, c, d] = VERDICT_THRESHOLDS): VerdictLevel {
  if (percentile < a) return 'well-below'
  if (percentile < b) return 'below'
  if (percentile <= c) return 'typical'
  if (percentile <= d) return 'above'
  return 'well-above'
}

export function zScore(value: number, mean: number, sd: number): number | null {
  return sd > 0 ? (value - mean) / sd : null
}

export interface MonthSummary {
  month: YearMonth
  value: number | null
  baseline: BaselineStats | null
  vsMeanPct: number | null
  vsMedianPct: number | null
  percentile: number | null
  rank: { rank: number; of: number } | null
  verdict: VerdictLevel | null
  z: number | null
}

export function summarizeMonth(series: Series, months: YearMonth[], focus: YearMonth, baselineYears: [number, number]): MonthSummary {
  const i = months.indexOf(focus)
  const value = i >= 0 ? series[i] : null
  const { year, month } = parseYm(focus)
  const baseline = sameMonthBaseline(series, months, month, baselineYears, year)
  if (value === null || baseline === null) {
    return { month: focus, value, baseline, vsMeanPct: null, vsMedianPct: null, percentile: null, rank: null, verdict: null, z: null }
  }
  const percentile = percentileOf(value, baseline.values)
  return {
    month: focus, value, baseline,
    vsMeanPct: relativeAnomaly(value, baseline.mean),
    vsMedianPct: relativeAnomaly(value, baseline.median),
    percentile,
    rank: rankOf(value, baseline.values),
    verdict: verdictFor(percentile),
    z: zScore(value, baseline.mean, baseline.sd),
  }
}

export interface YearToDate {
  current: number
  typical: number
  anomalyPct: number
  years: number
}

/**
 * January to the focus month of the focus year, against the median of the same span in baseline years.
 * A year counts only when every month from January to the focus month exists and has a value,
 * so a record that starts in November is never compared with full years.
 */
export function yearToDate(series: Series, months: YearMonth[], focus: YearMonth, [y0, y1]: [number, number]): YearToDate | null {
  const { year: fy, month: fm } = parseYm(focus)
  const acc = new Map<number, { sum: number; n: number; gap: boolean }>()
  months.forEach((ym, i) => {
    const { year, month } = parseYm(ym)
    if (month > fm) return
    const a = acc.get(year) ?? { sum: 0, n: 0, gap: false }
    const v = series[i]
    if (v === null) a.gap = true
    else a.sum += v
    a.n++
    acc.set(year, a)
  })
  const complete = (y: number): number | null => {
    const a = acc.get(y)
    return a && !a.gap && a.n === fm ? a.sum : null
  }
  const current = complete(fy)
  if (current === null) return null
  const base = [...acc.keys()]
    .filter((y) => y >= y0 && y <= y1 && y !== fy)
    .map(complete)
    .filter((v): v is number => v !== null)
  if (base.length < MIN_BASELINE_YEARS) return null
  const typical = quantile([...base].sort((a, b) => a - b), 0.5)
  return { current, typical, anomalyPct: relativeAnomaly(current, typical), years: base.length }
}

export interface MonthlyAnomaly {
  month: YearMonth
  value: number
  reference: number
  anomalyPct: number
}

/** Anomaly of every month in [i0, i1] against its calendar month's multi-year average (or median), excluding its own year. */
export function monthlyAnomalies(
  series: Series, months: YearMonth[], i0: number, i1: number,
  baselineYears: [number, number], reference: 'mean' | 'median' = 'mean',
): MonthlyAnomaly[] {
  const out: MonthlyAnomaly[] = []
  for (let i = i0; i <= i1; i++) {
    const v = series[i]
    if (v === null) continue
    const { year, month } = parseYm(months[i])
    const b = sameMonthBaseline(series, months, month, baselineYears, year)
    if (!b) continue
    const ref = reference === 'mean' ? b.mean : b.median
    out.push({ month: months[i], value: v, reference: ref, anomalyPct: relativeAnomaly(v, ref) })
  }
  return out
}
