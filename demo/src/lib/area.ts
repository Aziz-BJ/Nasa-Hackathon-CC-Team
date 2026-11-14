// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { area as turfArea } from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import { bboxPolygon } from '@turf/bbox-polygon'
import { circle } from '@turf/circle'
import { MAX_AREA_KM2 } from '../config'
import type { Bbox } from './grid'

export type AreaSource = 'preset' | 'drawn' | 'bbox' | 'point'

export interface Area {
  label: string
  source: AreaSource
  /** Set when the area is a preset, so preset-only data (reported fires) can be matched. */
  presetId?: string
  geometry: GeoJSON.Polygon
  bbox: Bbox
  areaKm2: number
}

const fmtKm2 = (x: number) => Math.round(x).toLocaleString('en-GB')
const fmtDeg = (x: number) => String(Math.round(x * 100) / 100)

function finish(geometry: GeoJSON.Polygon, label: string, source: AreaSource): Area {
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry }
  return { label, source, geometry, bbox: turfBbox(feature) as Bbox, areaKm2: turfArea(feature) / 1e6 }
}

/** Returns an error message, or null when the box is valid. Order is west, south, east, north (FIRMS area API order). */
export function validateBbox([w, s, e, n]: Bbox): string | null {
  if ([w, s, e, n].some((v) => !Number.isFinite(v))) return 'Enter all four numbers.'
  if (s < -90 || n > 90) return 'Latitude must be between -90 and 90.'
  if (w < -180 || e > 180) return 'Longitude must be between -180 and 180.'
  if (s >= n) return 'South must be less than north.'
  if (w >= e) return 'West must be less than east. Boxes that cross the 180° line are not supported yet: draw two boxes instead.'
  return null
}

export function validatePoint(lat: number, lon: number, radiusKm: number): string | null {
  if (![lat, lon, radiusKm].every(Number.isFinite)) return 'Enter latitude, longitude and radius.'
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.'
  if (lon < -180 || lon > 180) return 'Longitude must be between -180 and 180.'
  if (radiusKm <= 0) return 'Radius must be more than 0 km.'
  if (radiusKm > 1500) return 'Radius must be 1500 km or less.'
  return null
}

/** Returns an error message when the area is too large to load quickly. */
export function checkSize(a: Area): string | null {
  if (a.areaKm2 <= MAX_AREA_KM2) return null
  return `This area is ${fmtKm2(a.areaKm2)} km². The limit is ${fmtKm2(MAX_AREA_KM2)} km² so results stay fast: choose a smaller area.`
}

export function areaFromBbox(bbox: Bbox, label?: string, source: AreaSource = 'bbox'): Area {
  const [w, s, e, n] = bbox
  return finish(bboxPolygon(bbox).geometry, label ?? `Box W ${fmtDeg(w)}, S ${fmtDeg(s)}, E ${fmtDeg(e)}, N ${fmtDeg(n)}`, source)
}

export function areaFromPoint(lat: number, lon: number, radiusKm: number): Area {
  const geom = circle([lon, lat], radiusKm, { units: 'kilometers', steps: 64 }).geometry
  return finish(geom, `${radiusKm} km around ${fmtDeg(lat)}, ${fmtDeg(lon)}`, 'point')
}

export function areaFromPolygon(geometry: GeoJSON.Polygon, label = 'Drawn area'): Area {
  return finish(geometry, label, 'drawn')
}

export function areaFromPreset(p: { id: string; name: string; bbox: Bbox }): Area {
  return { ...areaFromBbox(p.bbox, p.name, 'preset'), presetId: p.id }
}
