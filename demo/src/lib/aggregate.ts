// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Sums grid cells inside the user's area. A cell is "inside" when its centre is inside,
// so edges are approximate to one grid cell (said in the UI).
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { Area } from './area'
import { cellCentre, cellId } from './grid'
import { monthRange, type YearMonth } from './months'
import { inSpan, seriesSpan } from './status'
import { SERIES_KEYS, type Manifest, type SeriesKey, type TileFile } from './types'

export interface CellRef {
  tile: TileFile
  index: number
  id: string
  lat: number
  lon: number
}

export interface Selection {
  cells: CellRef[]
  /** true when no grid-cell centre lies inside the area, so we used the cell containing its centre. */
  fallback: boolean
}

export interface AreaSeries {
  months: YearMonth[]
  values: Record<SeriesKey, (number | null)[]>
  low: (number | null)[] | null
  high: (number | null)[] | null
}

/** Does any grid-cell centre lie inside the area? (Sparse tiles can't tell us: absent cells are zeros.) */
function containsCellCentre(area: Area, feature: GeoJSON.Feature<GeoJSON.Polygon>, gridDeg: number): boolean {
  const [w, s, e, n] = area.bbox
  const r0 = Math.ceil((s + 90) / gridDeg - 0.5)
  const r1 = Math.floor((n + 90) / gridDeg - 0.5)
  const c0 = Math.ceil((w + 180) / gridDeg - 0.5)
  const c1 = Math.floor((e + 180) / gridDeg - 0.5)
  if (r1 < r0 || c1 < c0) return false
  if ((r1 - r0 + 1) * (c1 - c0 + 1) > 20_000) return true // very large areas always contain one
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (booleanPointInPolygon([(c + 0.5) * gridDeg - 180, (r + 0.5) * gridDeg - 90], feature)) return true
    }
  }
  return false
}

export function selectCells(area: Area, tiles: TileFile[], gridDeg: number): Selection {
  const [w, s, e, n] = area.bbox
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  const cells: CellRef[] = []
  for (const tile of tiles) {
    tile.cells.forEach((id, index) => {
      const c = cellCentre(id, gridDeg)
      if (c.lon < w || c.lon > e || c.lat < s || c.lat > n) return
      if (booleanPointInPolygon([c.lon, c.lat], feature)) cells.push({ tile, index, id, ...c })
    })
  }
  if (cells.length > 0 || containsCellCentre(area, feature, gridDeg)) return { cells, fallback: false }
  // Small or thin areas: use the cell that contains the area's centre.
  const id = cellId((s + n) / 2, (w + e) / 2, gridDeg)
  for (const tile of tiles) {
    const index = tile.cells.indexOf(id)
    if (index >= 0) return { cells: [{ tile, index, id, ...cellCentre(id, gridDeg) }], fallback: true }
  }
  return { cells: [], fallback: true }
}

/** 0 where the series could have data, null where it could not (sensor not operating). */
function baseArray(m: Manifest, months: YearMonth[], key: SeriesKey): (number | null)[] {
  const span = seriesSpan(m, key)
  return months.map((ym) => (span && inSpan(ym, span) ? 0 : null))
}

function addInto(out: (number | null)[], values: (number | null)[] | undefined) {
  if (!values) return
  for (let i = 0; i < out.length; i++) {
    const v = values[i]
    if (out[i] !== null && v !== null && v !== undefined) out[i] = (out[i] as number) + v
  }
}

export function aggregate(m: Manifest, sel: Selection): AreaSeries {
  const months = monthRange(m.first_month, m.last_month)
  const values = Object.fromEntries(SERIES_KEYS.map((k) => [k, baseArray(m, months, k)])) as AreaSeries['values']
  const hasBand = sel.cells.length > 0 && sel.cells.every((c) => c.tile.series.harmonized_low && c.tile.series.harmonized_high)
  // Band = sum of cell bands (conservative). Replace if Pierre supplies region-level uncertainty.
  const low = hasBand ? baseArray(m, months, 'harmonized') : null
  const high = hasBand ? baseArray(m, months, 'harmonized') : null
  for (const c of sel.cells) {
    for (const k of SERIES_KEYS) addInto(values[k], c.tile.series[k][c.index])
    if (low && high) {
      addInto(low, c.tile.series.harmonized_low?.[c.index])
      addInto(high, c.tile.series.harmonized_high?.[c.index])
    }
  }
  return { months, values, low, high }
}

/** Per-cell totals over months [i0, i1] (indices into AreaSeries.months), for colouring the map. */
export function cellTotals(sel: Selection, key: SeriesKey, i0: number, i1: number) {
  return sel.cells.map((c) => {
    const arr = c.tile.series[key][c.index]
    let total: number | null = null
    for (let i = i0; i <= i1; i++) {
      const v = arr[i]
      if (v !== null && v !== undefined) total = (total ?? 0) + v
    }
    return { id: c.id, lat: c.lat, lon: c.lon, total }
  })
}

/**
 * Is the area inside the processed coverage? Checks the area's corners and a grid of points inside it,
 * so an area spanning two adjacent coverage boxes counts as fully covered.
 */
export function coverageOf(m: Manifest, area: Area): 'none' | 'partial' | 'full' {
  const [w, s, e, n] = area.bbox
  const covered = ([lon, lat]: number[]) => m.coverage.some(([cw, cs, ce, cn]) => lon >= cw && lon <= ce && lat >= cs && lat <= cn)
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  const points: number[][] = [...area.geometry.coordinates[0]]
  const N = 10
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = [w + ((e - w) * i) / N, s + ((n - s) * j) / N]
      if (booleanPointInPolygon(p, feature)) points.push(p)
    }
  }
  const hits = points.filter(covered).length
  if (hits === points.length) return 'full'
  if (hits > 0) return 'partial'
  // A small coverage box can sit between sample points.
  return m.coverage.some(([cw, cs, ce, cn]) => w < ce && e > cw && s < cn && n > cs) ? 'partial' : 'none'
}
