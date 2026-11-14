// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The only place that knows file names and shapes. If Andre renames a field, fix it here.
import type { Manifest, OverviewFile, ReportedFile, TileFile } from './types'

type FetchFn = (url: string) => Promise<Response>

export class DataError extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new DataError(msg)
}

const isYm = (x: unknown) => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x)

export function validateManifest(raw: unknown): Manifest {
  check(raw !== null && typeof raw === 'object', 'manifest.json is not a JSON object')
  const m = raw as Manifest
  check(m.schema_version === 1, `Unsupported schema_version ${String(m.schema_version)} (this app reads version 1)`)
  check(typeof m.mock === 'boolean', 'manifest.mock must be true or false')
  for (const k of ['grid_deg', 'tile_deg'] as const) {
    check(typeof m[k] === 'number' && m[k] > 0, `manifest.${k} must be a positive number`)
  }
  for (const k of ['first_month', 'last_month', 'nrt_from'] as const) {
    check(isYm(m[k]), `manifest.${k} must be YYYY-MM`)
  }
  check(m.first_month <= m.last_month, 'manifest.first_month must not be after manifest.last_month')
  check(typeof m.month_to_date === 'boolean', 'manifest.month_to_date must be true or false')
  check(Array.isArray(m.baseline_years) && m.baseline_years.length === 2, 'manifest.baseline_years must be [first, last]')
  check(Array.isArray(m.harmonized_coverage) && m.harmonized_coverage.length === 2 && m.harmonized_coverage.every(isYm),
    'manifest.harmonized_coverage must be [first, last] as YYYY-MM')
  for (const k of ['sensors', 'coverage', 'tiles', 'presets'] as const) {
    check(Array.isArray(m[k]), `manifest.${k} must be a list`)
  }
  m.sensors.forEach((s, i) => check(s && typeof s.key === 'string' && isYm(s.first_month) && isYm(s.last_month),
    `manifest.sensors[${i}] needs key, first_month and last_month (YYYY-MM)`))
  return m
}

function isJson(res: Response): boolean {
  return (res.headers.get('content-type') ?? '').includes('json')
}

export function createDataSource(baseUrl: string, fetchFn: FetchFn = (u) => fetch(u)) {
  const tiles = new Map<string, Promise<TileFile>>()

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchFn(baseUrl + path)
    if (!res.ok || !isJson(res)) throw new DataError(`Could not load ${path} (HTTP ${res.status})`)
    return (await res.json()) as T
  }

  return {
    async manifest(): Promise<Manifest> {
      return validateManifest(await getJson<unknown>('manifest.json'))
    },
    tile(id: string): Promise<TileFile> {
      let p = tiles.get(id)
      if (!p) {
        p = getJson<TileFile>(`tiles/${id}.json`)
        tiles.set(id, p)
        p.catch(() => tiles.delete(id))
      }
      return p
    },
    overview(): Promise<OverviewFile> {
      return getJson<OverviewFile>('overview.json')
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
