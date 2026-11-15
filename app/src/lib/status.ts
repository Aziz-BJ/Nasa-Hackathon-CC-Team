// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { monthsBetween, type YearMonth } from './months'
import type { Manifest, SensorInfo, SeriesKey } from './types'

export type MonthStatus = 'standard' | 'nrt' | 'partial' | 'incomplete' | 'no_sensor'

export const STATUS_LABELS: Record<MonthStatus, string> = {
  standard: 'Standard (science quality)',
  nrt: 'Near real-time: provisional',
  partial: 'Month to date: provisional',
  incomplete: 'Some days had no satellite data',
  no_sensor: 'No sensor operating',
}

/** YYYY-MM strings compare correctly as text. */
export function inSpan(ym: YearMonth, [first, last]: [YearMonth, YearMonth]): boolean {
  return ym >= first && ym <= last
}

/** Position of a month in the manifest's months, or -1 outside them. */
export function monthIndex(m: Manifest, ym: YearMonth): number {
  if (ym < m.first_month || ym > m.last_month) return -1
  return monthsBetween(m.first_month, ym)
}

/** Status of one month for one series: a raw sensor has no data before it launched or after it ended. */
export function monthStatus(m: Manifest, ym: YearMonth, key: SeriesKey = 'harmonized'): MonthStatus {
  const span = seriesSpan(m, key)
  if (!span || !inSpan(ym, span) || ym > m.last_month) return 'no_sensor'
  if (m.month_to_date && ym === m.last_month) return 'partial'
  if (ym >= m.nrt_from) return 'nrt'
  if (key === 'harmonized' && (m.days.none[monthIndex(m, ym)] ?? 0) > 0) return 'incomplete'
  return 'standard'
}

/** Aqua's orbit drifts later in the day from this month; the record stops using measured Aqua here (METHOD.md). */
export const AQUA_DRIFT_FROM: YearMonth = '2021-07'

export interface NoVerdict {
  /** For the headline, e.g. "incomplete month, no verdict". */
  short: string
  /** For the summary, a full sentence. */
  long: string
}

/**
 * Why a month gets no comparison even though it has a value, or null when comparing is fair: days with no satellite
 * at all (July to September 2002, in every series), or raw Aqua after its orbit drift.
 */
export function noVerdictReason(m: Manifest, key: SeriesKey, ym: YearMonth): NoVerdict | null {
  const i = monthIndex(m, ym)
  if (i >= 0 && (m.days.none[i] ?? 0) > 0 && monthStatus(m, ym, key) !== 'no_sensor') {
    return { short: 'incomplete month, no verdict', long: 'Some days of this month had no satellite data, so it is not compared with full months.' }
  }
  if (key === 'modis' && ym >= AQUA_DRIFT_FROM) {
    return { short: 'no verdict (Aqua orbit drift)', long: "Aqua's orbit has drifted later in the day since July 2021, so raw Aqua after that is not compared with earlier years." }
  }
  return null
}

/** The values a comparison may use: raw Aqua from July 2021 on is left out of every baseline (drifted orbit). */
export function comparableValues(key: SeriesKey, months: YearMonth[], values: (number | null)[]): (number | null)[] {
  return key === 'modis' ? values.map((v, i) => (months[i] >= AQUA_DRIFT_FROM ? null : v)) : values
}

export function sensorsIn(m: Manifest, ym: YearMonth): SensorInfo[] {
  return m.sensors.filter((s) => inSpan(ym, [s.first_month, s.last_month]))
}

/** Months in which a series can have a value at all. */
export function seriesSpan(m: Manifest, key: SeriesKey): [YearMonth, YearMonth] | null {
  if (key === 'harmonized') return m.harmonized_coverage
  const s = m.sensors.find((x) => x.key === key)
  return s ? [s.first_month, s.last_month] : null
}

/** Where a month of the harmonized record comes from, e.g. "measured by Aqua MODIS" or "Aqua 24 days, S-NPP 7 days". */
export function sourceOf(m: Manifest, ym: YearMonth): string {
  const i = monthIndex(m, ym)
  if (i < 0) return 'no data'
  const parts: [string, number][] = [
    ['Aqua', m.days.aqua[i]], ['S-NPP', m.days.snpp[i]], ['NOAA-20', m.days.noaa20[i]], ['no satellite', m.days.none[i]],
  ]
  const used = parts.filter(([, d]) => d > 0)
  if (used.length === 1) {
    const [name] = used[0]
    if (name === 'Aqua') return 'measured by Aqua MODIS'
    if (name === 'S-NPP') return 'converted from S-NPP VIIRS'
    if (name === 'NOAA-20') return 'converted from NOAA-20 VIIRS (via S-NPP)'
    return 'no satellite data'
  }
  return used.map(([name, d]) => `${name} ${d} day${d === 1 ? '' : 's'}`).join(', ')
}

/** Short source code for the CSV: measured, converted_snpp, converted_noaa20 or mixed. */
export function sourceCode(m: Manifest, ym: YearMonth): string {
  const i = monthIndex(m, ym)
  if (i < 0) return ''
  const used = [m.days.aqua[i] > 0, m.days.snpp[i] > 0, m.days.noaa20[i] > 0]
  if (used.filter(Boolean).length > 1) return 'mixed'
  return used[0] ? 'measured_aqua' : used[1] ? 'converted_snpp' : used[2] ? 'converted_noaa20' : 'none'
}
