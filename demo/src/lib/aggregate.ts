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
  /** true when the area is smaller than one grid cell and we used the cell containing its centre. */
  fallback: boolean
}

export interface AreaSeries {
  months: YearMonth[]
  values: Record<SeriesKey, (number | null)[]>
  low: (number | null)[] | null
  high: (number | null)[] | null
}

const KM_PER_DEG = 111.32

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
  const midLat = (s + n) / 2
  const cellKm2 = (gridDeg * KM_PER_DEG) ** 2 * Math.cos((midLat * Math.PI) / 180)
  if (cells.length > 0 || area.areaKm2 >= cellKm2) return { cells, fallback: false }
  const id = cellId(midLat, (w + e) / 2, gridDeg)
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

/** Does the area overlap the processed coverage at all, and is all of it inside? */
export function coverageOf(m: Manifest, area: Area): 'none' | 'partial' | 'full' {
  const [w, s, e, n] = area.bbox
  let any = false
  for (const [cw, cs, ce, cn] of m.coverage) {
    if (w >= cw && e <= ce && s >= cs && n <= cn) return 'full'
    if (w < ce && e > cw && s < cn && n > cs) any = true
  }
  return any ? 'partial' : 'none'
}
