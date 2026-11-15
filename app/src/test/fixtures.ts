// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// A tiny hand-built dataset in contract v2, small enough to check sums by hand.
// Months 2019-01 .. 2020-12 (index 0..23). Regions "aa" and "bb" (group "ab"), 2020-12 is a month to date.
import type { Outlines } from '../lib/data'
import { monthRange } from '../lib/months'
import type { CellFile, Manifest, RegionSeries, RegionsFile } from '../lib/types'

export const FIX_MONTHS = monthRange('2019-01', '2020-12')

const N = FIX_MONTHS.length
const daysOf = (f: (i: number) => [number, number, number, number]) => {
  const d = { aqua: [] as number[], snpp: [] as number[], noaa20: [] as number[], none: [] as number[] }
  for (let i = 0; i < N; i++) {
    const [a, s, n, x] = f(i)
    d.aqua.push(a); d.snpp.push(s); d.noaa20.push(n); d.none.push(x)
  }
  return d
}

export const FIX_MANIFEST: Manifest = {
  schema_version: 2, mock: false, dataset_name: 'Fixture', first_month: '2019-01', last_month: '2020-12',
  month_to_date: true, last_day: '2020-12-10', nrt_from: '2020-10', baseline_years: [2019, 2019],
  harmonized_coverage: ['2019-01', '2020-12'], unit: 'fire cell-days', cell_km: 5,
  sensors: [
    { key: 'modis', label: 'Aqua MODIS', source: 'FIRMS MODIS', version: '6.1', first_month: '2019-01', last_month: '2020-12' },
    { key: 'viirs_snpp', label: 'Suomi NPP VIIRS', source: 'FIRMS VIIRS', version: '2', first_month: '2019-07', last_month: '2020-12' },
    { key: 'viirs_noaa20', label: 'NOAA-20 VIIRS', source: 'FIRMS VIIRS', version: '2', first_month: '2020-06', last_month: '2020-12' },
  ],
  // Index 14 = 2020-03: Aqua + S-NPP (mixed). 16 = 2020-05: 2 days without a satellite.
  // 18 = 2020-07: S-NPP only. 19 = 2020-08: NOAA-20 only.
  days: daysOf((i) => (i === 14 ? [25, 3, 0, 0] : i === 16 ? [26, 0, 0, 2] : i === 18 ? [0, 31, 0, 0] : i === 19 ? [0, 0, 31, 0] : [28, 0, 0, 0])),
  regions: [
    { id: 'aa', name: 'Region A', bbox: [0, 0, 2, 2], area_km2: 1000, cells: 3 },
    { id: 'bb', name: 'Region B', bbox: [10, 10, 12, 12], area_km2: 500, cells: 1 },
  ],
  groups: [{ id: 'ab', name: 'A and B', regions: ['aa', 'bb'] }],
  method: { name: 'Test method', version: 'v0', reference_scale: 'Aqua MODIS', fit_window: 'none' },
  validation: { loyo_male_naive: 0.5, loyo_male: 0.25, loyo_r2: 0.9, coverage90: 0.9, seams: [], chain_ratio: 1 },
  generated_at: '2026-11-15T00:00:00Z',
}

/** Region series: harmonized = k * (i + 1), range +-1, raw sensors null before launch. */
function series(k: number): RegionSeries {
  const idx = Array.from({ length: N }, (_, i) => i)
  return {
    harmonized: idx.map((i) => k * (i + 1)),
    low: idx.map((i) => k * (i + 1) - 1),
    high: idx.map((i) => k * (i + 1) + 1),
    modis: idx.map((i) => k * i),
    viirs_snpp: idx.map((i) => (i >= 6 ? k * i * 2 : null)),
    viirs_noaa20: idx.map((i) => (i >= 17 ? k * i * 3 : null)),
  }
}

export const FIX_REGIONS: RegionsFile = {
  series: { aa: series(1), bb: series(10) },
  mtd: {
    month: '2020-12', day: 10, years: [2019, 2020],
    series: { aa: { values: [4, 5], low: [3, 4], high: [5, 6] }, bb: { values: [1, 2], low: [0, 1], high: [2, 3] } },
  },
  factors: { aa: [], bb: [] },
}

const square = (w: number, s: number, e: number, n: number): GeoJSON.MultiPolygon => ({
  type: 'MultiPolygon', coordinates: [[[[w, s], [e, s], [e, n], [w, n], [w, s]]]],
})

export const FIX_OUTLINES: Outlines = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'aa', name: 'Region A' }, geometry: square(0, 0, 2, 2) },
    { type: 'Feature', properties: { id: 'bb', name: 'Region B' }, geometry: square(10, 10, 12, 12) },
  ],
}

/** entries: [cell, month, harmonized, aqua, snpp, noaa20]. mtd: [cell, year index, value]. */
export const FIX_CELLS_AA: CellFile = {
  region: 'aa',
  cells: [['c0', 0.5, 0.5], ['c1', 1.5, 0.5], ['c2', 1.5, 1.5]],
  entries: [
    0, 0, 3, 3, 0, 0,
    0, 7, 2.5, 0, 4, 0,
    1, 0, 1, 1, 0, 0,
    1, 7, 1.5, 0, 2, 0,
    2, 20, 4, 0, 0, 5,
  ],
  mtd: [0, 0, 1.5, 0, 1, 2, 1, 1, 0.5, 2, 1, 1],
}

export const FIX_CELLS_BB: CellFile = {
  region: 'bb', cells: [['d0', 11, 11]], entries: [0, 0, 10, 10, 0, 0], mtd: [0, 1, 7],
}
