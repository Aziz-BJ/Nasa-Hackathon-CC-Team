// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The only place that knows file names and shapes (contract version 2, docs/DATA_CONTRACT.md).
import { ENTRY_STRIDE, type CellFile, type Manifest, type RegionsFile, type ReportedFile } from './types'

type FetchFn = (url: string) => Promise<Response>

export type Outlines = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, { id: string; name: string }>

export class DataError extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new DataError(msg)
}

const isYm = (x: unknown) => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x)

export function validateManifest(raw: unknown): Manifest {
  check(raw !== null && typeof raw === 'object', 'manifest.json is not a JSON object')
  const m = raw as Manifest
  check(m.schema_version === 2, `Unsupported schema_version ${String(m.schema_version)} (this app reads version 2)`)
  check(typeof m.mock === 'boolean', 'manifest.mock must be true or false')
  check(typeof m.cell_km === 'number' && m.cell_km > 0, 'manifest.cell_km must be a positive number')
  for (const k of ['first_month', 'last_month', 'nrt_from'] as const) {
    check(isYm(m[k]), `manifest.${k} must be YYYY-MM`)
  }
  check(m.first_month <= m.last_month, 'manifest.first_month must not be after manifest.last_month')
  check(typeof m.month_to_date === 'boolean', 'manifest.month_to_date must be true or false')
  check(Array.isArray(m.baseline_years) && m.baseline_years.length === 2, 'manifest.baseline_years must be [first, last]')
  check(Array.isArray(m.harmonized_coverage) && m.harmonized_coverage.length === 2 && m.harmonized_coverage.every(isYm),
    'manifest.harmonized_coverage must be [first, last] as YYYY-MM')
  for (const k of ['sensors', 'regions', 'groups'] as const) {
    check(Array.isArray(m[k]), `manifest.${k} must be a list`)
  }
  check(m.regions.length > 0, 'manifest.regions is empty')
  m.sensors.forEach((s, i) => check(s && typeof s.key === 'string' && isYm(s.first_month) && isYm(s.last_month),
    `manifest.sensors[${i}] needs key, first_month and last_month (YYYY-MM)`))
  m.regions.forEach((r, i) => check(r && typeof r.id === 'string' && Array.isArray(r.bbox) && r.bbox.length === 4,
    `manifest.regions[${i}] needs id and bbox`))
  check(!!m.days && (['aqua', 'snpp', 'noaa20', 'none'] as const).every((k) => Array.isArray(m.days[k])),
    'manifest.days needs aqua, snpp, noaa20 and none')
  return m
}

/** A cell file with an index, so one cell's months can be read without scanning the whole file. */
export interface LoadedCells {
  file: CellFile
  /** The entries of cell c are entries[start[c] * 6 .. start[c + 1] * 6). */
  start: Int32Array
  /** Month-to-date values of cell c: mtdYear / mtdValue[mtdStart[c] .. mtdStart[c + 1]). */
  mtdStart: Int32Array
  mtdYear: Int32Array
  mtdValue: Float64Array
}

export function indexCells(file: CellFile): LoadedCells {
  const n = file.cells.length
  const e = file.entries
  const start = new Int32Array(n + 1)
  for (let k = 0; k < e.length; k += ENTRY_STRIDE) {
    if (k > 0) {
      const prevCell = e[k - ENTRY_STRIDE]
      check(e[k] > prevCell || (e[k] === prevCell && e[k + 1] > e[k + 1 - ENTRY_STRIDE]),
        `cells/${file.region}.json: entries must be sorted by cell, then month`)
    }
    start[e[k] + 1]++
  }
  for (let c = 0; c < n; c++) start[c + 1] += start[c]
  const m = file.mtd
  const mtdStart = new Int32Array(n + 1)
  for (let k = 0; k < m.length; k += 3) mtdStart[m[k] + 1]++
  for (let c = 0; c < n; c++) mtdStart[c + 1] += mtdStart[c]
  const next = mtdStart.slice(0, n)
  const mtdYear = new Int32Array(m.length / 3)
  const mtdValue = new Float64Array(m.length / 3)
  for (let k = 0; k < m.length; k += 3) {
    const at = next[m[k]]++
    mtdYear[at] = m[k + 1]
    mtdValue[at] = m[k + 2]
  }
  return { file, start, mtdStart, mtdYear, mtdValue }
}

function isJson(res: Response): boolean {
  const type = res.headers.get('content-type') ?? ''
  return type.includes('json')
}

export function createDataSource(baseUrl: string, fetchFn: FetchFn = (u) => fetch(u)) {
  const cells = new Map<string, Promise<LoadedCells>>()

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchFn(baseUrl + path)
    if (!res.ok || !isJson(res)) throw new DataError(`Could not load ${path} (HTTP ${res.status})`)
    return (await res.json()) as T
  }

  return {
    async manifest(): Promise<Manifest> {
      return validateManifest(await getJson<unknown>('manifest.json'))
    },
    regions(): Promise<RegionsFile> {
      return getJson<RegionsFile>('regions.json')
    },
    outlines(): Promise<Outlines> {
      return getJson<Outlines>('outlines.json')
    },
    cells(region: string): Promise<LoadedCells> {
      let p = cells.get(region)
      if (!p) {
        p = getJson<CellFile>(`cells/${region}.json`).then(indexCells)
        cells.set(region, p)
        p.catch(() => cells.delete(region))
      }
      return p
    },
    /** Optional file. Missing (404, the dev server's HTML fallback) or unreadable means "no reported data". */
    async reported(): Promise<ReportedFile | null> {
      try {
        const res = await fetchFn(baseUrl + 'reported.json')
        if (!res.ok || !isJson(res)) return null
        return (await res.json()) as ReportedFile
      } catch {
        return null
      }
    },
  }
}

export type DataSource = ReturnType<typeof createDataSource>
