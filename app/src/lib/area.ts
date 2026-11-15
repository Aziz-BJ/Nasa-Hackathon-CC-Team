// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { area as turfArea } from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import { bboxPolygon } from '@turf/bbox-polygon'
import { circle } from '@turf/circle'
import { MAX_AREA_KM2, MIN_AREA_KM2 } from '../config'
import type { Outlines } from './data'
import { unionBbox, type Bbox } from './grid'
import type { Manifest } from './types'

export type AreaSource = 'region' | 'drawn' | 'bbox' | 'point'

/** The drawing tool a drawn shape came from. */
export type DrawnKind = 'circle' | 'rectangle' | 'polygon' | 'freehand'
export const DRAWN_KINDS: readonly DrawnKind[] = ['circle', 'rectangle', 'polygon', 'freehand']
export const DRAWN_LABEL: Record<DrawnKind, string> = {
  circle: 'Drawn circle', rectangle: 'Drawn rectangle', polygon: 'Drawn polygon', freehand: 'Drawn freehand area',
}

export interface Area {
  label: string
  source: AreaSource
  /** Whole regions: their numbers and 90% ranges come straight from the harmonized record. */
  regionIds?: string[]
  /** The region or group id, for links and region-only data (reported fires). */
  regionKey?: string
  /** Drawn shapes: the tool they were drawn with (links keep the exact outline). */
  kind?: DrawnKind
  /** Typed point areas: latitude, longitude and radius in km (links keep them exactly). */
  point?: [lat: number, lon: number, radiusKm: number]
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  bbox: Bbox
  areaKm2: number
}

const fmtKm2 = (x: number) => Math.round(x).toLocaleString('en-GB')
const fmtDeg = (x: number) => String(Math.round(x * 100) / 100)

function finish(geometry: GeoJSON.Polygon, label: string, source: AreaSource): Area {
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry }
  return { label, source, geometry, bbox: turfBbox(feature) as Bbox, areaKm2: turfArea(feature) / 1e6 }
}

/**
 * A typed coordinate or radius. Accepts a decimal comma ("38,8", usual in Italy) and the typographic minus ("−8.7", as in
 * the form's hint); an empty field is NaN, not 0.
 */
export function parseCoordinate(s: string): number {
  const t = s.trim().replace(/^[\u2212\u2013]/, '-')
  if (t === '') return NaN
  return Number(/^[-+]?\d*,\d+$/.test(t) ? t.replace(',', '.') : t)
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

/** Returns an error message when the area is too large to load quickly, or too small to measure. */
export function checkSize(a: Area): string | null {
  if (!(a.areaKm2 >= MIN_AREA_KM2)) {
    return `This area is ${a.areaKm2 >= 1 ? `${fmtKm2(a.areaKm2)} km²` : 'under 1 km²'}, smaller than one ${fmtKm2(MIN_AREA_KM2)} km² fire cell, `
      + 'so its numbers would mean little: choose a larger area.'
  }
  if (a.areaKm2 <= MAX_AREA_KM2) return null
  return `This area is ${fmtKm2(a.areaKm2)} km². The limit is ${fmtKm2(MAX_AREA_KM2)} km² so results stay fast: choose a smaller area.`
}

export function areaFromBbox(bbox: Bbox, label?: string, source: AreaSource = 'bbox'): Area {
  const [w, s, e, n] = bbox
  return finish(bboxPolygon(bbox).geometry, label ?? `Box W ${fmtDeg(w)}, S ${fmtDeg(s)}, E ${fmtDeg(e)}, N ${fmtDeg(n)}`, source)
}

export function areaFromPoint(lat: number, lon: number, radiusKm: number): Area {
  const geom = circle([lon, lat], radiusKm, { units: 'kilometers', steps: 64 }).geometry
  return { ...finish(geom, `${radiusKm} km around ${fmtDeg(lat)}, ${fmtDeg(lon)}`, 'point'), point: [lat, lon, radiusKm] }
}

export function areaFromPolygon(geometry: GeoJSON.Polygon, label = 'Drawn area'): Area {
  return finish(geometry, label, 'drawn')
}

/** Most points a drawn outline keeps, so its link stays a few kB. */
export const MAX_DRAWN_POINTS = 300
const r4 = (x: number) => Math.round(x * 1e4) / 1e4

/**
 * A shape drawn on the globe, labelled by the tool that drew it. The outline is rounded to 4 decimals (about 10 m) and long
 * freehand outlines are thinned, so the shape on screen is exactly the one its link reopens, with the same numbers.
 */
export function areaFromDrawn(geometry: GeoJSON.Polygon, kind: DrawnKind): Area {
  let ring = geometry.coordinates[0].map(([x, y]) => [r4(x), r4(y)])
  ring = ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1])
  if (ring.length > MAX_DRAWN_POINTS) {
    const step = (ring.length - 1) / (MAX_DRAWN_POINTS - 1)
    ring = Array.from({ length: MAX_DRAWN_POINTS - 1 }, (_, k) => ring[Math.round(k * step)])
    ring.push(ring[0])
  }
  return { ...finish({ type: 'Polygon', coordinates: [ring] }, DRAWN_LABEL[kind], 'drawn'), kind }
}

/** Drawn shapes follow the same rules as typed ones: no 180° crossing, and the size limit. */
export function validateDrawn(a: Area): string | null {
  if (a.geometry.type !== 'Polygon') return null
  const ring = a.geometry.coordinates[0]
  const crosses = ring.some(([lon], i) => Math.abs(lon) > 180 || (i > 0 && Math.abs(lon - ring[i - 1][0]) > 180))
  if (crosses) return 'This shape crosses the 180° line, which is not supported yet. Draw it on one side of the line.'
  return checkSize(a)
}

/** The regions a region id or group id stands for, or null when it is neither. */
export function regionIdsFor(m: Manifest, key: string): string[] | null {
  if (m.regions.some((r) => r.id === key)) return [key]
  return m.groups.find((g) => g.id === key)?.regions ?? null
}

/** A whole region, or a group of regions, as an area. Its outline is drawn exactly as the pipeline defined it. */
export function areaFromRegion(m: Manifest, outlines: Outlines | null, key: string): Area | null {
  const ids = regionIdsFor(m, key)
  if (!ids) return null
  const regions = m.regions.filter((r) => ids.includes(r.id))
  const label = m.regions.find((r) => r.id === key)?.name ?? m.groups.find((g) => g.id === key)?.name ?? key
  const bbox = unionBbox(regions.map((r) => r.bbox))
  const shapes = outlines?.features.filter((f) => ids.includes(f.properties.id)) ?? []
  const geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon = shapes.length
    ? { type: 'MultiPolygon', coordinates: shapes.flatMap((f) => f.geometry.coordinates) }
    : bboxPolygon(bbox).geometry
  return {
    label, source: 'region', regionIds: ids, regionKey: key, geometry, bbox,
    areaKm2: regions.reduce((a, r) => a + r.area_km2, 0),
  }
}
