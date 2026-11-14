// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { YearMonth } from './months'
import type { Manifest, SensorInfo, SeriesKey } from './types'

export type MonthStatus = 'standard' | 'nrt' | 'partial' | 'no_sensor'

export const STATUS_LABELS: Record<MonthStatus, string> = {
  standard: 'Standard (science quality)',
  nrt: 'Near real-time: provisional',
  partial: 'Month to date: provisional',
  no_sensor: 'No sensor operating',
}

/** YYYY-MM strings compare correctly as text. */
export function inSpan(ym: YearMonth, [first, last]: [YearMonth, YearMonth]): boolean {
  return ym >= first && ym <= last
}

export function monthStatus(m: Manifest, ym: YearMonth): MonthStatus {
  if (!inSpan(ym, m.harmonized_coverage) || ym > m.last_month) return 'no_sensor'
  if (m.month_to_date && ym === m.last_month) return 'partial'
  if (ym >= m.nrt_from) return 'nrt'
  return 'standard'
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
