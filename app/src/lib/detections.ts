// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Raw FIRMS detections at native pixel size (docs/DATA_CONTRACT.md, "Detections at native pixel size").
// Raw data, not harmonized: VIIRS sees many more, smaller fires than MODIS, so counts are not comparable between sensors.
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { Area } from './area'
import { parseYm, type YearMonth } from './months'
import type { DetectionsFile } from './types'

export const DETECTION_SATELLITES = [
  { key: 'aqua', id: 'AQUA', label: 'Aqua MODIS (1 km pixels)', color: '#E69F00' },
  { key: 'snpp', id: 'SNPP', label: 'S-NPP VIIRS (375 m)', color: '#56B4E9' },
  { key: 'noaa20', id: 'NOAA20', label: 'NOAA-20 VIIRS (375 m)', color: '#009E73' },
] as const
export type DetectionSatKey = (typeof DETECTION_SATELLITES)[number]['key']

export interface DetectionsState {
  show: boolean
  aqua: boolean
  snpp: boolean
  noaa20: boolean
}
export const DETECTIONS_OFF: DetectionsState = { show: false, aqua: true, snpp: true, noaa20: true }

/** Most points the map is given at once; above this the selection is thinned evenly and the legend says so. */
export const MAX_DRAWN = 150_000

/** Metres per screen pixel at zoom 0 for MapLibre's 512 px tiles, at the equator. */
const M_PER_PX_Z0 = (2 * Math.PI * 6_378_137) / 512

/** Day-of-year span [first, last] of the chosen months that falls inside one calendar year. */
export function daySpan(year: number, from: YearMonth, to: YearMonth): [number, number] | null {
  const f = parseYm(from)
  const t = parseYm(to)
  if (year < f.year || year > t.year) return null
  const doy = (m: number, d: number) => Math.round((Date.UTC(year, m - 1, d) - Date.UTC(year, 0, 1)) / 86_400_000)
  const first = year === f.year ? doy(f.month, 1) : 0
  const last = year === t.year ? doy(t.month + 1, 1) - 1 : doy(13, 1) - 1
  return [first, last]
}

export interface DetectionSelection {
  features: GeoJSON.FeatureCollection<GeoJSON.Point, { s: number; k: number }>
  /** Detections in the area and months per satellite (AQUA, SNPP, NOAA20), before thinning. */
  counts: [number, number, number]
  /** How many are drawn (after the satellite switches and any thinning). */
  drawn: number
  /** Selected by the switches, before thinning. */
  selected: number
}

/**
 * The detections inside the area and the chosen months. Whole regions keep every row of their own file;
 * a drawn shape or typed box is tested point by point (pixel centres). Night and day are both kept.
 */
export function selectDetections(files: DetectionsFile[], area: Area, from: YearMonth, to: YearMonth,
  sats: DetectionsState, max = MAX_DRAWN): DetectionSelection {
  const on = [sats.aqua, sats.snpp, sats.noaa20]
  const [w, s, e, n] = area.bbox
  const shape: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  const counts: [number, number, number] = [0, 0, 0]
  const keep: { lon: number; lat: number; s: number; scanKm: number }[] = []
  for (const f of files) {
    const span = daySpan(f.year, from, to)
    if (!span) continue
    const whole = area.regionIds?.includes(f.region) ?? false
    for (let i = 0; i < f.s.length; i++) {
      const d = f.d[i]
      if (d < span[0] || d > span[1]) continue
      const lon = f.lon0 + f.x[i] / 1e4
      const lat = f.lat0 + f.y[i] / 1e4
      if (!whole) {
        if (lon < w || lon > e || lat < s || lat > n) continue
        if (!booleanPointInPolygon([lon, lat], shape)) continue
      }
      const sat = f.s[i] >> 1
      counts[sat]++
      if (on[sat]) keep.push({ lon, lat, s: sat, scanKm: f.w[i] / 100 })
    }
  }
  const step = keep.length > max ? keep.length / max : 1
  const features: GeoJSON.Feature<GeoJSON.Point, { s: number; k: number }>[] = []
  for (let j = 0; j < keep.length; j += step) {
    const p = keep[Math.floor(j)]
    // k: half the pixel width in screen pixels at zoom 0; the map multiplies by 2^zoom.
    const k = (p.scanKm * 500) / (M_PER_PX_Z0 * Math.cos((p.lat * Math.PI) / 180))
    features.push({ type: 'Feature', properties: { s: p.s, k }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })
  }
  return { features: { type: 'FeatureCollection', features }, counts, drawn: features.length, selected: keep.length }
}

/** Years of the chosen months for which a region has a detections file. */
export function yearsToLoad(available: string[], from: YearMonth, to: YearMonth): number[] {
  const y0 = parseYm(from).year
  const y1 = parseYm(to).year
  return available.map(Number).filter((y) => y >= y0 && y <= y1).sort((a, b) => a - b)
}
