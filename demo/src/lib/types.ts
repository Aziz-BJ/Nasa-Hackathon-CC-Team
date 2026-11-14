// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The data contract between the pipeline (Andre, Pierre) and the app. Proposed extension of HANDOVER.md section 7:
// same fields, packed into 10-degree tiles so any drawn area on the globe loads only the files it needs.
import type { Bbox } from './grid'
import type { YearMonth } from './months'

export const SERIES_KEYS = ['harmonized', 'modis', 'viirs_snpp', 'viirs_noaa20'] as const
export type SeriesKey = (typeof SERIES_KEYS)[number]
export type SensorKey = Exclude<SeriesKey, 'harmonized'>
export type BandKey = 'harmonized_low' | 'harmonized_high'

export const SERIES_LABELS: Record<SeriesKey, string> = {
  harmonized: 'Harmonized (MODIS + VIIRS)',
  modis: 'MODIS only (raw)',
  viirs_snpp: 'VIIRS S-NPP only (raw)',
  viirs_noaa20: 'VIIRS NOAA-20 only (raw)',
}

export interface SensorInfo {
  key: SensorKey
  label: string
  source: string
  version: string
  first_month: YearMonth
  last_month: YearMonth
}

export interface Preset {
  id: string
  name: string
  bbox: Bbox
}

export interface Manifest {
  schema_version: 1
  mock: boolean
  dataset_name: string
  grid_deg: number
  tile_deg: number
  first_month: YearMonth
  last_month: YearMonth
  /** true when last_month is not finished yet ("month to date"). */
  month_to_date: boolean
  /** First month that is near-real-time (provisional) rather than standard science-quality data. */
  nrt_from: YearMonth
  baseline_years: [number, number]
  harmonized_coverage: [YearMonth, YearMonth]
  sensors: SensorInfo[]
  /** Areas the pipeline processed. Outside these, "no data" is not the same as "no hotspots". */
  coverage: Bbox[]
  filters: { type: number[]; modis_confidence_min: number; viirs_confidence: string[] }
  method: {
    name: string
    version: string
    reference_scale: string
    fit_years: [number, number] | null
    test_years: [number, number] | null
  }
  validation: { metric: string; value: number | null; notes: string }
  generated_at: string
  tiles: string[]
  presets: Preset[]
}

/**
 * One tile. Cells with no detections in any month are left out (sparse), which means 0, not "no data".
 * Each series holds one array per cell, one value per month from manifest.first_month to last_month.
 * null = that sensor was not operating that month.
 */
export interface TileFile {
  tile_id: string
  cells: string[]
  series: Record<SeriesKey, (number | null)[][]> & Partial<Record<BandKey, (number | null)[][]>>
}

export interface OverviewFile {
  grid_deg: number
  metric: string
  cells: [lat: number, lon: number, value: number][]
}

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
