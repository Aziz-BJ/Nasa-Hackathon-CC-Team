// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The data contract between the pipeline and the app, version 2 (docs/DATA_CONTRACT.md).
// Written by scripts/import-data.ts from Pierre's harmonized record and Andrea's 5 km cell table.
import type { Bbox } from './grid'
import type { YearMonth } from './months'

export const SERIES_KEYS = ['harmonized', 'modis', 'viirs_snpp', 'viirs_noaa20'] as const
export type SeriesKey = (typeof SERIES_KEYS)[number]
export type SensorKey = Exclude<SeriesKey, 'harmonized'>

export const SERIES_LABELS: Record<SeriesKey, string> = {
  harmonized: 'Harmonized (Aqua MODIS scale)',
  modis: 'Aqua MODIS only (raw)',
  viirs_snpp: 'S-NPP VIIRS only (raw)',
  viirs_noaa20: 'NOAA-20 VIIRS only (raw)',
}

export interface SensorInfo {
  key: SensorKey
  label: string
  source: string
  version: string
  first_month: YearMonth
  last_month: YearMonth
}

export interface RegionInfo {
  id: string
  name: string
  bbox: Bbox
  area_km2: number
  /** Number of 5 km cells with at least one fire cell-day. */
  cells: number
}

/** Several regions shown together, e.g. All of Italy. */
export interface RegionGroup {
  id: string
  name: string
  regions: string[]
}

export interface SeamCheck {
  seam: string
  step_pct: number
  lo90_pct: number
  hi90_pct: number
  no_step: boolean
}

export interface Manifest {
  schema_version: 2
  mock: boolean
  dataset_name: string
  first_month: YearMonth
  last_month: YearMonth
  /** true when last_month is not finished yet ("month to date"). */
  month_to_date: boolean
  /** Last day with data, YYYY-MM-DD. */
  last_day: string
  /** First month that is near-real-time (provisional) rather than standard science-quality data. */
  nrt_from: YearMonth
  baseline_years: [number, number]
  harmonized_coverage: [YearMonth, YearMonth]
  unit: string
  cell_km: number
  sensors: SensorInfo[]
  /** Days of each month (aligned to first_month..last_month) by the satellite the record uses. Same for every region. */
  days: { aqua: number[]; snpp: number[]; noaa20: number[]; none: number[] }
  regions: RegionInfo[]
  groups: RegionGroup[]
  method: { name: string; version: string; reference_scale: string; fit_window: string }
  validation: {
    loyo_male_naive: number
    loyo_male: number
    loyo_r2: number
    coverage90: number
    seams: SeamCheck[]
    chain_ratio: number
  }
  generated_at: string
}

/** Monthly values for one region, aligned to manifest months. Raw sensors are null before launch. */
export interface RegionSeries {
  harmonized: number[]
  /** 90% predictive range of the count. Equal to the value in measured (Aqua) months. */
  low: number[]
  high: number[]
  modis: (number | null)[]
  viirs_snpp: (number | null)[]
  viirs_noaa20: (number | null)[]
}

export interface MonthToDate {
  /** The unfinished month and its last day with data. */
  month: YearMonth
  day: number
  years: number[]
  series: Record<string, { values: number[]; low: number[]; high: number[] }>
}

export interface FactorRow {
  model: 'snpp_to_aqua' | 'noaa20_to_snpp' | 'noaa20_to_aqua'
  season: 'fire' | 'off'
  daynight: 'D' | 'N'
  factor: number
  low: number
  high: number
}

export interface RegionsFile {
  series: Record<string, RegionSeries>
  mtd: MonthToDate | null
  factors: Record<string, FactorRow[]>
}

/**
 * The 5 km fire cells of one region. Cells and months not listed are 0.
 * entries: [cell index, month index, harmonized, aqua, snpp, noaa20] repeated, sorted by cell then month.
 * mtd: [cell index, year index (into MonthToDate.years), harmonized] repeated, for the unfinished month's days.
 */
export interface CellFile {
  region: string
  cells: [id: string, lat: number, lon: number][]
  entries: number[]
  mtd: number[]
}

export const ENTRY_STRIDE = 6

export interface ReportedSeries {
  preset_id: string
  label: string
  source: string
  licence: string
  url: string
  unit: string
  first_month: YearMonth
  values: (number | null)[]
}

export interface ReportedFile {
  mock: boolean
  series: ReportedSeries[]
}
