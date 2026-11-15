// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The only place that knows file names and shapes (contract version 2, docs/DATA_CONTRACT.md).
import { monthsBetween } from './months'
import { ENTRY_STRIDE, SERIES_KEYS, type CellFile, type DetectionsFile, type DetectionsIndex, type Manifest, type RegionsFile, type ReportedFile } from './types'

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

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

const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)

/** regions.json must hold a full monthly series for every manifest region, or the app would show wrong numbers. */
export function validateRegions(raw: unknown, m: Manifest): RegionsFile {
  check(isObject(raw), 'regions.json is not a JSON object')
  const rf = raw as unknown as RegionsFile
  check(isObject(rf.series), 'regions.json has no series')
  check(isObject(rf.factors), 'regions.json has no factors')
  const n = monthsBetween(m.first_month, m.last_month) + 1
  for (const r of m.regions) {
    const s = rf.series[r.id]
    check(isObject(s), `regions.json has no series for ${r.id}`)
    for (const k of [...SERIES_KEYS, 'low', 'high'] as const) {
      check(Array.isArray(s[k]) && s[k].length === n, `regions.json: ${r.id}.${k} must have ${n} months`)
    }
  }
  check(rf.mtd === null || rf.mtd === undefined || (isObject(rf.mtd) && Array.isArray(rf.mtd.years) && isObject(rf.mtd.series)),
    'regions.json: mtd must be null or have years and series')
  return { ...rf, mtd: rf.mtd ?? null }
}

/** outlines.json is optional; a broken one is reported here and the app draws region boxes instead. */
export function validateOutlines(raw: unknown): Outlines {
  check(isObject(raw) && raw.type === 'FeatureCollection' && Array.isArray(raw.features), 'outlines.json is not a GeoJSON FeatureCollection')
  const o = raw as unknown as Outlines
  o.features.forEach((f, i) => check(
    isObject(f) && isObject(f.properties) && typeof f.properties.id === 'string' && isObject(f.geometry)
      && f.geometry.type === 'MultiPolygon' && Array.isArray(f.geometry.coordinates),
    `outlines.json feature ${i} needs properties.id and a MultiPolygon`))
  return o
}

/** reported.json is optional; anything without a list of series counts as missing. */
export function validateReported(raw: unknown): ReportedFile | null {
  return isObject(raw) && Array.isArray(raw.series) && raw.series.every((s) => isObject(s) && typeof s.preset_id === 'string')
    ? raw as unknown as ReportedFile : null
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

export interface Timeouts {
  /** Longest wait for a server to start answering. */
  answerMs: number
  /** Longest wait for a whole file once it has started (the biggest cell file is 2 MB). */
  bodyMs: number
}

/** The parallel lists of a detections file (docs/DATA_CONTRACT.md). */
const DETECTION_LISTS = ['s', 'd', 'x', 'y', 'w', 'h', 'p', 't', 'c', 'q'] as const

export const DEFAULT_TIMEOUTS: Timeouts = { answerMs: 20_000, bodyMs: 120_000 }

export function createDataSource(baseUrl: string, fetchFn: FetchFn = (u, init) => fetch(u, init), timeouts: Timeouts = DEFAULT_TIMEOUTS) {
  const cells = new Map<string, Promise<LoadedCells>>()
  const detectionFiles = new Map<string, Promise<DetectionsFile>>()
  let detectionsIndexP: Promise<DetectionsIndex | null> | null = null

  /**
   * A file that never answers must end in an error the user can retry, not in "Loading…" forever.
   * optional: a missing file (404, or the dev server's HTML fallback) resolves to null instead of failing.
   */
  async function getJson<T>(path: string, optional = false): Promise<T> {
    const abort = new AbortController()
    let timedOut = ''
    const after = (ms: number, what: string) => setTimeout(() => { timedOut = what; abort.abort() }, ms)
    let timer = after(timeouts.answerMs, `no answer after ${Math.round(timeouts.answerMs / 1000)} s`)
    try {
      const res = await fetchFn(baseUrl + path, { signal: abort.signal })
      clearTimeout(timer)
      if (optional && (res.status === 404 || (res.ok && !isJson(res)))) return null as T
      if (!res.ok || !isJson(res)) throw new DataError(`Could not load ${path} (HTTP ${res.status})`)
      timer = after(timeouts.bodyMs, `still loading after ${Math.round(timeouts.bodyMs / 1000)} s`)
      return (await res.json()) as T
    } catch (e) {
      if (e instanceof DataError) throw e
      if (timedOut) throw new DataError(`Could not load ${path} (${timedOut})`)
      throw new DataError(e instanceof SyntaxError ? `${path} is not valid JSON` : `Could not load ${path} (network error)`)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async manifest(): Promise<Manifest> {
      return validateManifest(await getJson<unknown>('manifest.json'))
    },
    /** Check the result against the manifest with validateRegions. */
    regions(): Promise<unknown> {
      return getJson<unknown>('regions.json')
    },
    async outlines(): Promise<Outlines> {
      return validateOutlines(await getJson<unknown>('outlines.json'))
    },
    cells(region: string): Promise<LoadedCells> {
      let p = cells.get(region)
      if (!p) {
        p = getJson<CellFile>(`cells/${region}.json`).then((file) => {
          check(isObject(file) && Array.isArray(file.cells) && Array.isArray(file.entries) && Array.isArray(file.mtd),
            `cells/${region}.json needs cells, entries and mtd lists`)
          return indexCells(file)
        })
        cells.set(region, p)
        p.catch(() => cells.delete(region))
      }
      return p
    },
    /**
     * Optional layer: raw detections at native pixel size. Missing (404, or the dev server's HTML fallback) resolves to
     * null: this build has no detections. A network or server error, or no answer in time, rejects and is not kept, so
     * the next call tries again.
     */
    detectionsIndex(): Promise<DetectionsIndex | null> {
      if (!detectionsIndexP) {
        const p = getJson<unknown>('detections/index.json', true).then((ix) => {
          check(ix === null || (isObject(ix) && isObject(ix.regions)), 'detections/index.json needs a regions object')
          return ix as DetectionsIndex | null
        })
        detectionsIndexP = p
        p.catch(() => { if (detectionsIndexP === p) detectionsIndexP = null })
      }
      return detectionsIndexP
    },
    detections(region: string, year: number): Promise<DetectionsFile> {
      const key = `${region}/${year}`
      let p = detectionFiles.get(key)
      if (!p) {
        p = getJson<unknown>(`detections/${key}.json`).then((f) => {
          check(isObject(f) && Array.isArray(f.s) && DETECTION_LISTS.every((k) => Array.isArray(f[k]) && (f[k] as unknown[]).length === (f.s as unknown[]).length),
            `detections/${key}.json needs lists ${DETECTION_LISTS.join(', ')} of equal length`)
          return f as unknown as DetectionsFile
        })
        detectionFiles.set(key, p)
        p.catch(() => detectionFiles.delete(key))
      }
      return p
    },
    /** Optional file. Missing (404, the dev server's HTML fallback), slow or unreadable means "no reported data". */
    async reported(): Promise<ReportedFile | null> {
      try {
        return validateReported(await getJson<unknown>('reported.json'))
      } catch {
        return null
      }
    },
  }
}

export type DataSource = ReturnType<typeof createDataSource>
