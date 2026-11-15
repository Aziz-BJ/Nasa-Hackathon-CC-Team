// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Builds the app's data files (contract version 2) from the team's pipeline outputs:
//   Pierre: harmonized_monthly.csv, current_month_to_date.csv, factors.csv, missing_days.csv, validation_*.csv
//   Andrea: cell_days.csv (one row per 5 km cell x local day x satellite x day/night) and the region outlines.
// The per-cell values follow Pierre's source rule day by day, convert with his factors, and are then scaled
// so every region-month adds up exactly to his H. See docs/DATA_CONTRACT.md.

export type Row = Record<string, string>

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(text: string): Row[] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { record.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.length > 1 || record[0] !== '') records.push(record)
      record = []
    } else field += ch
  }
  if (field !== '' || record.length > 0) { record.push(field); records.push(record) }
  const [head, ...rows] = records
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

export type Satellite = 'AQUA' | 'SNPP' | 'NOAA20'

/** Pierre's source rule (METHOD.md section 0), one day at a time. */
export const SOURCE_RULE = {
  aquaUntil: '2021-06-30',
  snppFrom: '2012-01-20',
  snppUntil: '2026-11-01',
  noaa20From: '2018-04-01',
}

export function sourceOfDay(day: string, missing: Set<string>): Satellite | null {
  const ok = (s: Satellite) => !missing.has(`${s} ${day}`)
  const r = SOURCE_RULE
  if (day <= r.aquaUntil) {
    if (ok('AQUA')) return 'AQUA'
    if (day >= r.snppFrom && ok('SNPP')) return 'SNPP'
    if (day >= r.noaa20From && ok('NOAA20')) return 'NOAA20'
    return null
  }
  if (day <= r.snppUntil) {
    if (ok('SNPP')) return 'SNPP'
    if (ok('NOAA20')) return 'NOAA20'
    return null
  }
  return ok('NOAA20') ? 'NOAA20' : null
}

/** June to September is the fire season in Pierre's calibration cells. */
export const seasonOf = (ym: string) => {
  const m = Number(ym.slice(5, 7))
  return m >= 6 && m <= 9 ? 'fire' : 'off'
}

export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = []
  let [y, m] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

/** Factor for one cell-day of the source satellite: 1 for Aqua, Pierre's effective factor otherwise. */
export function makeWeight(factors: Row[]) {
  const f = new Map<string, number>()
  for (const r of factors) f.set(`${r.model}|${r.region}|${r.season}|${r.daynight}`, Number(r.factor))
  return (sat: Satellite, region: string, ym: string, dn: string): number => {
    if (sat === 'AQUA') return 1
    const model = sat === 'SNPP' ? 'SNPP->AQUA' : 'NOAA20->AQUA (chain)'
    const w = f.get(`${model}|${region}|${seasonOf(ym)}|${dn}`)
    if (w === undefined) throw new Error(`No factor for ${model} ${region} ${seasonOf(ym)} ${dn}`)
    return w
  }
}

export interface CellAccum {
  cells: Map<string, { region: string; lat: number; lon: number }>
  /** key "cellId|monthIndex" -> [weighted source cell-days, aqua, snpp, noaa20] */
  months: Map<string, [number, number, number, number]>
  /** key "cellId|year" -> weighted source cell-days in days 1..mtdDay of the month-to-date month */
  mtd: Map<string, number>
  /** key "region|monthIndex" -> weighted total, and the same for month to date "region|year" */
  regionW: Map<string, number>
  regionMtdW: Map<string, number>
}

export interface AccumOptions {
  months: string[]
  lastDay: string
  missing: Set<string>
  weight: ReturnType<typeof makeWeight>
  /** Calendar month (1-12) and last day of the month-to-date comparison, or null. */
  mtd: { month: number; day: number } | null
}

/** One pass over Andrea's cell_days rows. */
export function accumulate(rows: Iterable<Row>, o: AccumOptions): CellAccum {
  const mi = new Map(o.months.map((ym, i) => [ym, i]))
  const acc: CellAccum = { cells: new Map(), months: new Map(), mtd: new Map(), regionW: new Map(), regionMtdW: new Map() }
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  for (const r of rows) {
    const day = r.date_local
    if (day > o.lastDay) continue
    const ym = day.slice(0, 7)
    const i = mi.get(ym)
    if (i === undefined) continue
    const sat = r.satellite as Satellite
    if (!acc.cells.has(r.cell_id)) acc.cells.set(r.cell_id, { region: r.region, lat: Number(r.cell_lat), lon: Number(r.cell_lon) })
    const key = `${r.cell_id}|${i}`
    const e = acc.months.get(key) ?? [0, 0, 0, 0]
    if (sat === 'AQUA') e[1]++
    else if (sat === 'SNPP') e[2]++
    else if (sat === 'NOAA20') e[3]++
    if (sourceOfDay(day, o.missing) === sat) {
      const w = o.weight(sat, r.region, ym, r.daynight)
      e[0] += w
      add(acc.regionW, `${r.region}|${i}`, w)
      if (o.mtd && Number(day.slice(5, 7)) === o.mtd.month && Number(day.slice(8, 10)) <= o.mtd.day) {
        add(acc.mtd, `${r.cell_id}|${day.slice(0, 4)}`, w)
        add(acc.regionMtdW, `${r.region}|${day.slice(0, 4)}`, w)
      }
    }
    acc.months.set(key, e)
  }
  return acc
}

/** Ramer-Douglas-Peucker on one ring of [lon, lat] points. */
export function simplifyRing(ring: number[][], tol: number): number[][] {
  if (ring.length <= 4) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = ring[a]
    const [bx, by] = ring[b]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    let worst = -1
    let wi = -1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i]
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
      t = Math.max(0, Math.min(1, t))
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      if (d > worst) { worst = d; wi = i }
    }
    if (worst > tol) {
      keep[wi] = 1
      stack.push([a, wi], [wi, b])
    }
  }
  const r4 = (x: number) => Math.round(x * 1e4) / 1e4
  return ring.filter((_, i) => keep[i]).map(([x, y]) => [r4(x), r4(y)])
}

/** Simplify a (Multi)Polygon; drops rings that collapse below a triangle (tiny islets). */
export function simplifyGeometry(g: GeoJSON.Polygon | GeoJSON.MultiPolygon, tol: number): GeoJSON.MultiPolygon {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const out: number[][][][] = []
  for (const [outer, ...holes] of polys) {
    const o = simplifyRing(outer, tol)
    if (o.length < 4) continue
    out.push([o, ...holes.map((h) => simplifyRing(h, tol)).filter((h) => h.length >= 4)])
  }
  return { type: 'MultiPolygon', coordinates: out }
}

export const round = (x: number, d: number) => {
  const k = 10 ** d
  return Math.round(x * k) / k
}
