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
  /** FIRMS acquisition date and time, UTC (YYYY-MM-DD and HHMM). */
  acq_date: string
  acq_time: string
  /** FIRMS confidence: MODIS 0-100 (as text), VIIRS l / n / h. */
  confidence: string
  /** SP (standard processing) or NRT (near real-time, provisional). */
  data_version: string
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
  /** Fire radiative power in units of 0.1 MW (MW x 10), rounded: small VIIRS fires are often under 2 MW. */
  p: number[]
  /** UTC acquisition time in minutes from 00:00 UTC of the local solar date (can be negative). */
  t: number[]
  /** Confidence: MODIS 0-100; VIIRS 1 low, 2 nominal, 3 high. */
  c: number[]
  /** 1 = near real-time (provisional), 0 = standard processing. */
  q: number[]
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

const VIIRS_CONFIDENCE: Record<string, number> = { l: 1, low: 1, n: 2, nominal: 2, h: 3, high: 3 }

/** FIRMS confidence as a number: MODIS keeps its 0-100 percentage, VIIRS l/n/h becomes 1/2/3. */
export function confidenceCode(satellite: string, confidence: string): number {
  if (satellite === 'AQUA') {
    const v = Number(confidence)
    if (!Number.isFinite(v)) throw new Error(`Bad MODIS confidence "${confidence}"`)
    return Math.round(v)
  }
  const v = VIIRS_CONFIDENCE[confidence.trim().toLowerCase()]
  if (!v) throw new Error(`Bad VIIRS confidence "${confidence}"`)
  return v
}

/** Minutes from 00:00 UTC of the local date to the UTC acquisition time (acq_date may be the day before). */
export function utcMinutes(dateLocal: string, acqDate: string, acqTime: string): number {
  const day = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 60_000 }
  const hhmm = acqTime.padStart(4, '0')
  return day(acqDate) - day(dateLocal) + Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2, 4))
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
    p: Math.round(r.frp * 10),
    t: utcMinutes(r.date_local, r.acq_date, r.acq_time),
    c: confidenceCode(r.satellite, r.confidence),
    q: r.data_version === 'NRT' ? 1 : 0,
  }))
  enc.sort((a, b) => a.d - b.d || a.s - b.s || a.x - b.x || a.y - b.y)
  const out: DetectionsFileOut = { region, year, lon0, lat0, s: [], d: [], x: [], y: [], w: [], h: [], p: [], t: [], c: [], q: [] }
  for (const e of enc) {
    out.s.push(e.s); out.d.push(e.d); out.x.push(e.x); out.y.push(e.y); out.w.push(e.w); out.h.push(e.h); out.p.push(e.p)
    out.t.push(e.t); out.c.push(e.c); out.q.push(e.q)
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
