# Data contract: pipeline → Hotspot Calendar app

For Andre and Pierre. This is what the app reads (`schema_version` 1). It keeps the fields of HANDOVER section 7, packed into
10° tiles so an area drawn anywhere on the globe loads only the files it touches. A writer that produces these files from
monthly cell counts is in [`write_app_data.py`](write_app_data.py) (formatting only; it never changes a number).

## Files

```
demo/public/data/<dataset>/manifest.json              grid, months, sensors, coverage, filters, method, presets, tile list
demo/public/data/<dataset>/tiles/<row>_<col>.json     one 10° tile: cell ids + one array per cell per series (one value per month)
demo/public/data/<dataset>/overview.json              coarse global layer (mean hotspots per year) for the globe
demo/public/data/<dataset>/reported.json              optional: ground-reported fire statistics for presets
```

Run the app on it: `cd demo && VITE_DATASET=<dataset> npm run dev`. A broken field is named on screen.

## Rules

- **Grid:** `cell_id = "<row>_<col>"`, `row = floor((lat + 90) / grid_deg)`, `col = floor((lon + 180) / grid_deg)`
  (HANDOVER 7.1; e.g. lat 38.125, lon −1.875 at 0.25° is `512_712`). Tiles use the same rule with `tile_deg` (10).
- **Months:** every series array has one value per month from `first_month` to `last_month` (inclusive, UTC months).
- **null vs 0:** `null` only where that series was not operating (outside the sensor's `first_month`–`last_month`,
  or outside `harmonized_coverage` for harmonized); `0` where it operated and saw nothing. Cells that never burn are left out
  (absent = 0).
- **Uncertainty band:** `harmonized_low` and `harmonized_high` are optional, but present for every cell or for none.
- **Counts** are after the filters in `manifest.filters` (type 0 = presumed vegetation fire; confidence thresholds).
- **`month_to_date`:** true when `last_month` is not finished. The app gives no verdict for that month.
- **`nrt_from`:** the first month that is still near real-time (provisional) in the downloaded files.
- **`coverage`:** every box the pipeline processed, so the app can say "no data loaded here" rather than show a false zero.
- **`mock`:** must be `false`. A production build refuses a mock dataset.
- **Size:** if a tile is over about 2 MB gzipped, tell Aziz (the tile format can change inside `src/lib/data.ts` only).

## Checklist before handing over

- [ ] `manifest.json` has `"mock": false`, a real `generated_at`, and `sensors` with FIRMS versions and first/last months read from the files (S-NPP end and NOAA-21 start: HANDOVER 13.5).
- [ ] `nrt_from` is the first month that is still NRT in the downloaded files; `month_to_date` is right for `last_month`.
- [ ] Every tile listed in `tiles` exists; cell ids use `grid_deg`; every array has `months(first_month..last_month)` values.
- [ ] `null` only where a series was not operating; `0` where it operated and saw nothing.
- [ ] `coverage` lists every processed box; `presets` have `id`, `name`, `bbox` [west, south, east, north].
- [ ] `method` and `validation` filled by Pierre (they appear on the About page).
- [ ] `harmonized_low/high` present for every cell or absent everywhere.

## The contract in code (`demo/src/lib/types.ts`)

```ts
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
```
