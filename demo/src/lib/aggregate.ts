// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Two ways to get an area's monthly numbers:
//  - whole regions: straight from Pierre's harmonized record (with its 90% range);
//  - a drawn shape: the sum of the 5 km fire cells whose centre is inside it (an estimate for the harmonized line;
//    raw sensor counts are exact).
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { Area } from './area'
import type { LoadedCells, Outlines } from './data'
import { bboxesOverlap } from './grid'
import { monthRange, type YearMonth } from './months'
import { inSpan, seriesSpan } from './status'
import { ENTRY_STRIDE, SERIES_KEYS, type Manifest, type RegionsFile, type SeriesKey } from './types'

export interface CellRef {
  cells: LoadedCells
  index: number
  id: string
  lat: number
  lon: number
}

export interface Selection {
  cells: CellRef[]
}

export interface MtdSeries {
  years: number[]
  values: number[]
  low: number[] | null
  high: number[] | null
}

export interface AreaSeries {
  months: YearMonth[]
  values: Record<SeriesKey, (number | null)[]>
  /** 90% range of the harmonized count, for whole regions only. */
  low: (number | null)[] | null
  high: (number | null)[] | null
  /** The harmonized line is the region's conversion applied to part of it (drawn shapes). */
  estimate: boolean
  /** low/high add up several regions' ranges, so they are wider than the true range. */
  bandSummed: boolean
  /** The unfinished month, days 1..N, in every year (harmonized only). */
  mtd: MtdSeries | null
}

/** 0 where the series could have data, null where it could not (sensor not operating). */
function baseArray(m: Manifest, months: YearMonth[], key: SeriesKey): (number | null)[] {
  const span = seriesSpan(m, key)
  return months.map((ym) => (span && inSpan(ym, span) ? 0 : null))
}

function addInto(out: (number | null)[], values: readonly (number | null)[]) {
  for (let i = 0; i < out.length; i++) {
    const v = values[i]
    if (out[i] !== null && v !== null && v !== undefined) out[i] = (out[i] as number) + v
  }
}

/** Whole regions, added together. */
export function seriesFromRegions(m: Manifest, rf: RegionsFile, ids: string[]): AreaSeries {
  const months = monthRange(m.first_month, m.last_month)
  const values = Object.fromEntries(SERIES_KEYS.map((k) => [k, baseArray(m, months, k)])) as AreaSeries['values']
  const low = baseArray(m, months, 'harmonized')
  const high = baseArray(m, months, 'harmonized')
  for (const id of ids) {
    const s = rf.series[id]
    for (const k of SERIES_KEYS) addInto(values[k], s[k])
    addInto(low, s.low)
    addInto(high, s.high)
  }
  let mtd: MtdSeries | null = null
  if (rf.mtd) {
    const n = rf.mtd.years.length
    const sum = (pick: 'values' | 'low' | 'high') =>
      Array.from({ length: n }, (_, y) => ids.reduce((a, id) => a + rf.mtd!.series[id][pick][y], 0))
    mtd = { years: rf.mtd.years, values: sum('values'), low: sum('low'), high: sum('high') }
  }
  return { months, values, low, high, estimate: false, bandSummed: ids.length > 1, mtd }
}

/** Regions whose cells could lie inside the area. */
export function regionsTouching(m: Manifest, area: Area): string[] {
  if (area.regionIds) return area.regionIds
  return m.regions.filter((r) => bboxesOverlap(r.bbox, area.bbox)).map((r) => r.id)
}

export function selectCells(area: Area, files: LoadedCells[]): Selection {
  const cells: CellRef[] = []
  const whole = area.regionIds
  const [w, s, e, n] = area.bbox
  const feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  for (const f of files) {
    f.file.cells.forEach(([id, lat, lon], index) => {
      if (whole) {
        if (whole.includes(f.file.region)) cells.push({ cells: f, index, id, lat, lon })
        return
      }
      if (lon < w || lon > e || lat < s || lat > n) return
      if (booleanPointInPolygon([lon, lat], feature)) cells.push({ cells: f, index, id, lat, lon })
    })
  }
  return { cells }
}

/** The sum of the selected cells. */
export function seriesFromCells(m: Manifest, rf: RegionsFile, sel: Selection): AreaSeries {
  const months = monthRange(m.first_month, m.last_month)
  const values = Object.fromEntries(SERIES_KEYS.map((k) => [k, baseArray(m, months, k)])) as AreaSeries['values']
  const add = (key: SeriesKey, i: number, v: number) => {
    const arr = values[key]
    if (arr[i] !== null && v !== 0) arr[i] = (arr[i] as number) + v
  }
  const mtdValues = rf.mtd ? rf.mtd.years.map(() => 0) : null
  for (const c of sel.cells) {
    const { file, start, mtdStart, mtdYear, mtdValue } = c.cells
    const e = file.entries
    for (let k = start[c.index]; k < start[c.index + 1]; k++) {
      const at = k * ENTRY_STRIDE
      const i = e[at + 1]
      add('harmonized', i, e[at + 2])
      add('modis', i, e[at + 3])
      add('viirs_snpp', i, e[at + 4])
      add('viirs_noaa20', i, e[at + 5])
    }
    if (mtdValues) for (let k = mtdStart[c.index]; k < mtdStart[c.index + 1]; k++) mtdValues[mtdYear[k]] += mtdValue[k]
  }
  return {
    months, values, low: null, high: null, estimate: true, bandSummed: false,
    mtd: rf.mtd && mtdValues ? { years: rf.mtd.years, values: mtdValues, low: null, high: null } : null,
  }
}

const ENTRY_OFFSET: Record<SeriesKey, number> = { harmonized: 2, modis: 3, viirs_snpp: 4, viirs_noaa20: 5 }

/** Per-cell totals over months [i0, i1] (indices into the manifest months), for colouring the map. */
export function cellTotals(sel: Selection, key: SeriesKey, i0: number, i1: number) {
  const off = ENTRY_OFFSET[key]
  return sel.cells.map((c) => {
    const { file, start } = c.cells
    const e = file.entries
    let total = 0
    for (let k = start[c.index]; k < start[c.index + 1]; k++) {
      const i = e[k * ENTRY_STRIDE + 1]
      if (i >= i0 && i <= i1) total += e[k * ENTRY_STRIDE + off]
    }
    return { id: c.id, lat: c.lat, lon: c.lon, total }
  })
}

/**
 * How much of the area lies inside the study regions. Checks the shape's corners and a grid of points inside it.
 * Whole regions are always "full".
 */
export function coverageOf(outlines: Outlines | null, area: Area): 'none' | 'partial' | 'full' {
  if (area.regionIds) return 'full'
  if (!outlines) return 'none'
  const [w, s, e, n] = area.bbox
  const shape: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  const ring = area.geometry.type === 'Polygon' ? area.geometry.coordinates[0] : area.geometry.coordinates[0][0]
  const points: number[][] = [...ring]
  const N = 12
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = [w + ((e - w) * i) / N, s + ((n - s) * j) / N]
      if (booleanPointInPolygon(p, shape)) points.push(p)
    }
  }
  const inside = (p: number[]) => outlines.features.some((f) => booleanPointInPolygon(p, f))
  const hits = points.filter(inside).length
  if (hits === points.length) return 'full'
  if (hits > 0) return 'partial'
  // A small region (or a corner of one) can sit between the sample points: test the region's own points too.
  const touches = outlines.features.some((f) =>
    f.geometry.coordinates.some((poly) => poly[0].some((p) => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n && booleanPointInPolygon(p, shape))))
  return touches ? 'partial' : 'none'
}
