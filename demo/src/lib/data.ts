// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The only place that knows file names and shapes. If Andre renames a field, fix it here.
import type { Manifest, OverviewFile, ReportedFile, TileFile } from './types'

type FetchFn = (url: string) => Promise<Response>

export class DataError extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new DataError(msg)
}

const YM = /^\d{4}-\d{2}$/

export function validateManifest(raw: unknown): Manifest {
  check(raw !== null && typeof raw === 'object', 'manifest.json is not a JSON object')
  const m = raw as Manifest
  check(m.schema_version === 1, `Unsupported schema_version ${String(m.schema_version)} (this app reads version 1)`)
  check(typeof m.mock === 'boolean', 'manifest.mock must be true or false')
  for (const k of ['grid_deg', 'tile_deg'] as const) {
    check(typeof m[k] === 'number' && m[k] > 0, `manifest.${k} must be a positive number`)
  }
  for (const k of ['first_month', 'last_month', 'nrt_from'] as const) {
    check(YM.test(String(m[k])), `manifest.${k} must be YYYY-MM`)
  }
  check(Array.isArray(m.baseline_years) && m.baseline_years.length === 2, 'manifest.baseline_years must be [first, last]')
  check(Array.isArray(m.harmonized_coverage) && m.harmonized_coverage.length === 2, 'manifest.harmonized_coverage must be [first, last]')
  for (const k of ['sensors', 'coverage', 'tiles', 'presets'] as const) {
    check(Array.isArray(m[k]), `manifest.${k} must be a list`)
  }
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
    /** Optional file. Missing (404, or the dev server's HTML fallback) means "no reported data". */
    async reported(): Promise<ReportedFile | null> {
      const res = await fetchFn(baseUrl + 'reported.json')
      if (!res.ok || !isJson(res)) return null
      return (await res.json()) as ReportedFile
    },
  }
}

export type DataSource = ReturnType<typeof createDataSource>
