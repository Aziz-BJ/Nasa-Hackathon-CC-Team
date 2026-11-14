// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it, vi } from 'vitest'
import { createDataSource, DataError, validateManifest } from './data'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const minimal = {
  schema_version: 1, mock: true, dataset_name: 'x', grid_deg: 1, tile_deg: 10,
  first_month: '2000-11', last_month: '2026-11', month_to_date: true, nrt_from: '2026-07',
  baseline_years: [2003, 2025], harmonized_coverage: ['2000-11', '2026-11'],
  sensors: [], coverage: [], tiles: [], presets: [],
}

describe('validateManifest', () => {
  it('accepts a minimal manifest', () => {
    expect(validateManifest(minimal).grid_deg).toBe(1)
  })
  it('names the broken field', () => {
    expect(() => validateManifest({ ...minimal, nrt_from: '2026-7' })).toThrow(/nrt_from/)
    expect(() => validateManifest({ ...minimal, schema_version: 2 })).toThrow(DataError)
  })
})

describe('createDataSource', () => {
  it('caches tiles and retries after a failure', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValue(json({ tile_id: '1_1', cells: [], series: {} }))
    const ds = createDataSource('/data/x/', fetchFn)
    await expect(ds.tile('1_1')).rejects.toThrow(/HTTP 500/)
    await ds.tile('1_1')
    await ds.tile('1_1')
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn).toHaveBeenLastCalledWith('/data/x/tiles/1_1.json')
  })
  it('treats a missing or HTML reported.json as absent', async () => {
    const html = new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    expect(await createDataSource('/', async () => html).reported()).toBeNull()
    expect(await createDataSource('/', async () => new Response('', { status: 404 })).reported()).toBeNull()
  })
})
