// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Pure helpers for import-detections.ts: turn cleaned FIRMS detections into compact per region-year files
// (docs/DATA_CONTRACT.md, "Detections at native pixel size"). No imports, so Node can run it directly.

export const SATELLITES = ['AQUA', 'SNPP', 'NOAA20'] as const
export type Satellite = (typeof SATELLITES)[number]

export interface DetectionRow {
  latitude: number
  longitude: number
  /** Pixel size along the scan (km), roughly east-west. */
  scan: number
  /** Pixel size along the track (km), roughly north-south. */
  track: number
  satellite: string
  frp: number
  /** Local solar date, YYYY-MM-DD. */
  date_local: string
  daynight: string
  region: string
}

/** One region-year. Arrays are parallel; see the data contract for units. */
export interface DetectionsFileOut {
  region: string
  year: number
  lon0: number
  lat0: number
  /** satellite index * 2 + 1 at night (AQUA 0/1, SNPP 2/3, NOAA20 4/5). */
  s: number[]
  /** Day of the year from date_local, 0 = 1 January. */
  d: number[]
  /** Offsets from lon0 / lat0 in 1e-4 degrees. */
  x: number[]
  y: number[]
  /** scan / track in units of 10 m (km x 100). */
  w: number[]
  h: number[]
  /** Fire radiative power, MW, rounded. */
  p: number[]
}

export function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000)
}

export function satelliteCode(satellite: string, daynight: string): number {
  const i = SATELLITES.indexOf(satellite as Satellite)
  if (i < 0) throw new Error(`Unknown satellite "${satellite}"`)
  return i * 2 + (daynight === 'N' ? 1 : 0)
}

/** Rows dated after lastDay (an incomplete day) are dropped, as in the harmonized record. */
export function keepRow(r: DetectionRow, lastDay: string): boolean {
  return r.date_local <= lastDay
}

/** Encode one region-year. Sorted by day, then satellite, then position, so files are stable. */
export function encodeRegionYear(region: string, year: number, rows: DetectionRow[]): DetectionsFileOut {
  // reduce, not Math.min(...rows): spreading 300,000 values overflows the stack.
  const minLon = rows.reduce((a, r) => Math.min(a, r.longitude), Infinity)
  const minLat = rows.reduce((a, r) => Math.min(a, r.latitude), Infinity)
  const lon0 = Math.floor(minLon * 100) / 100
  const lat0 = Math.floor(minLat * 100) / 100
  const enc = rows.map((r) => ({
    s: satelliteCode(r.satellite, r.daynight),
    d: dayOfYear(r.date_local),
    x: Math.round((r.longitude - lon0) * 1e4),
    y: Math.round((r.latitude - lat0) * 1e4),
    w: Math.round(r.scan * 100),
    h: Math.round(r.track * 100),
    p: Math.round(r.frp),
  }))
  enc.sort((a, b) => a.d - b.d || a.s - b.s || a.x - b.x || a.y - b.y)
  const out: DetectionsFileOut = { region, year, lon0, lat0, s: [], d: [], x: [], y: [], w: [], h: [], p: [] }
  for (const e of enc) {
    out.s.push(e.s); out.d.push(e.d); out.x.push(e.x); out.y.push(e.y); out.w.push(e.w); out.h.push(e.h); out.p.push(e.p)
  }
  return out
}

/** Counts per satellite (AQUA, SNPP, NOAA20) in an encoded file. */
export function countBySatellite(f: Pick<DetectionsFileOut, 's'>): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0]
  for (const s of f.s) c[s >> 1]++
  return c
}

/** Group rows by region, then year (from date_local). */
export function groupRows(rows: DetectionRow[]): Map<string, Map<number, DetectionRow[]>> {
  const out = new Map<string, Map<number, DetectionRow[]>>()
  for (const r of rows) {
    const year = Number(r.date_local.slice(0, 4))
    let byYear = out.get(r.region)
    if (!byYear) { byYear = new Map(); out.set(r.region, byYear) }
    let list = byYear.get(year)
    if (!list) { list = []; byYear.set(year, list) }
    list.push(r)
  }
  return out
}
