// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Raw FIRMS detections at native pixel size (docs/DATA_CONTRACT.md, "Detections at native pixel size").
// Raw data, not harmonized: VIIRS sees many more, smaller fires than MODIS, so counts are not comparable between sensors.
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { Area } from './area'
import { parseYm, type YearMonth } from './months'
import type { DetectionsFile, Manifest } from './types'

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
 * Calls visit for every detection inside the area and the chosen months. Whole regions keep every row of their own
 * file; a drawn shape or typed box is tested point by point (pixel centres). Night and day are both kept.
 */
function eachDetection(files: DetectionsFile[], area: Area, from: YearMonth, to: YearMonth,
  visit: (f: DetectionsFile, i: number, lon: number, lat: number) => void) {
  const [w, s, e, n] = area.bbox
  const shape: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
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
      visit(f, i, lon, lat)
    }
  }
}

/** The detections to draw for the area and months, with counts per satellite (see eachDetection). */
export function selectDetections(files: DetectionsFile[], area: Area, from: YearMonth, to: YearMonth,
  sats: DetectionsState, max = MAX_DRAWN): DetectionSelection {
  const on = [sats.aqua, sats.snpp, sats.noaa20]
  const counts: [number, number, number] = [0, 0, 0]
  const keep: { lon: number; lat: number; s: number; scanKm: number }[] = []
  eachDetection(files, area, from, to, (f, i, lon, lat) => {
    const sat = f.s[i] >> 1
    counts[sat]++
    if (on[sat]) keep.push({ lon, lat, s: sat, scanKm: f.w[i] / 100 })
  })
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

const SAT_NAMES = ['Aqua', 'Suomi NPP', 'NOAA-20'] as const
const PRODUCTS = ['MODIS Collection 6.1 active fire (1 km)', 'VIIRS 375 m active fire (Collection 2)', 'VIIRS 375 m active fire (Collection 2)'] as const
const VIIRS_CONF = ['', 'l', 'n', 'h'] as const
/** DOI of each satellite's product: [standard, near real-time]. Each resolves to its NASA Earthdata page (checked 15 Nov 2026). */
const DOIS = [
  ['10.5067/MODIS/MYD14.061', '10.5067/FIRMS/MODIS/MCD14DL.NRT.0061'],
  ['10.5067/VIIRS/VNP14IMG.002', '10.5067/FIRMS/VIIRS/VNP14IMGT_NRT.002'],
  ['10.5067/VIIRS/VJ114IMG.002', '10.5067/FIRMS/VIIRS/VJ114IMGT_NRT.002'],
] as const

export const HOTSPOT_COLUMNS = [
  'latitude', 'longitude', 'acq_date_utc', 'acq_time_utc', 'local_solar_date', 'satellite', 'instrument', 'daynight',
  'confidence', 'frp_mw', 'scan_km', 'track_km', 'data_version', 'product', 'doi', 'region',
] as const

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * CSV of every cleaned FIRMS detection (hotspot) in the area and months, for the Download panel. Raw, not
 * harmonized; the header says how the rows were cleaned and that counts, FRP and confidence differ between sensors.
 */
export function hotspotsCsv(m: Manifest, files: DetectionsFile[], area: Area, from: YearMonth, to: YearMonth,
  generatedAt = new Date()): { csv: string; rows: number; counts: [number, number, number] } {
  const counts: [number, number, number] = [0, 0, 0]
  const lines: string[] = []
  eachDetection(files, area, from, to, (f, i, lon, lat) => {
    const sat = f.s[i] >> 1
    counts[sat]++
    const local = Date.UTC(f.year, 0, 1) + f.d[i] * 86_400_000
    const utc = local + f.t[i] * 60_000
    const time = new Date(utc)
    lines.push([
      lat.toFixed(4), lon.toFixed(4), isoDay(utc), pad(time.getUTCHours()) + pad(time.getUTCMinutes()), isoDay(local),
      SAT_NAMES[sat], sat === 0 ? 'MODIS' : 'VIIRS', f.s[i] & 1 ? 'N' : 'D',
      sat === 0 ? String(f.c[i]) : VIIRS_CONF[f.c[i]] ?? '', (f.p[i] / 10).toFixed(1), (f.w[i] / 100).toFixed(2), (f.h[i] / 100).toFixed(2),
      f.q[i] ? 'NRT' : 'SP', PRODUCTS[sat], DOIS[sat][f.q[i] ? 1 : 0], f.region,
    ].join(','))
  })
  const [w, s, e, n] = area.bbox.map((x) => Math.round(x * 1000) / 1000)
  const total = counts[0] + counts[1] + counts[2]
  const fmt = (x: number) => x.toLocaleString('en-GB')
  const header = [
    '# NASA FIRMS fire detections (hotspots) for this search, after the team\'s cleaning. Raw detections, NOT harmonized.',
    `# Area: ${area.label} (bbox W ${w}, S ${s}, E ${e}, N ${n}). ${area.regionIds ? 'Whole region: every detection assigned to it.' : 'Pixel centres inside the shape.'}`,
    `# Months: ${from} to ${to}, by local solar day; data to ${m.last_day}. Exported ${generatedAt.toISOString()}.`,
    `# Detections: ${fmt(total)} (Aqua MODIS ${fmt(counts[0])}, Suomi NPP VIIRS ${fmt(counts[1])}, NOAA-20 VIIRS ${fmt(counts[2])}).`,
    '# Counts are not comparable between sensors: VIIRS (375 m pixels) sees many more, smaller fires than MODIS (1 km). The harmonized record in the app corrects for this; these rows do not.',
    '# FRP and confidence are not comparable between sensors either. confidence: MODIS 0-100 (%); VIIRS l (low), n (nominal), h (high).',
    '# acq_date_utc, acq_time_utc: satellite overpass in UTC (FIRMS acq_date, acq_time, HHMM). local_solar_date: the day the record counts the detection on.',
    '# data_version: SP = standard processing; NRT = near real-time, provisional (may change when standard data replace it).',
    '# doi: the product each row comes from. Standard: MYD14 C6.1, VNP14IMG v2, VJ114IMG v2 (swath products behind the FIRMS archive); near real-time: MCD14DL C6.1, VNP14IMGT, VJ114IMGT (FIRMS NRT).',
    '# Cleaning (pipeline v1.1): duplicates removed; detections FIRMS flags as volcanoes, static land sources or offshore removed, plus Etna and Stromboli and everything within 1 km of 1,311 recurring heat sources;'
      + ' MODIS confidence below 30% and VIIRS low confidence removed; repeat detections of the same fire from overlapping pixels or orbits removed.',
    '# Positions are rounded to 0.0001 degrees (about 10 m), FRP to 0.1 MW, scan and track (pixel size along scan and track, km) to 10 m.',
    '# A hotspot is a thermal anomaly in a satellite pixel, not a confirmed fire, and not burned area. Zero detections is not "no fire" (cloud, smoke, gaps between passes). Not for tactical decisions during a fire.',
    "# We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth Science Data and Information System (ESDIS).",
    '# FIRMS data are provided "as is", without warranty of any kind.',
    `# Dataset: ${m.dataset_name}${m.mock ? ' (MOCK DATA, NOT REAL)' : ''}; generated ${m.generated_at}.`,
  ]
  return { csv: [...header, HOTSPOT_COLUMNS.join(','), ...lines].join('\n') + '\n', rows: total, counts }
}

export function hotspotsFilename(area: Area, from: YearMonth, to: YearMonth): string {
  const slug = area.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `hotspots_${slug}_${from}_${to}.csv`
}
