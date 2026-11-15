// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { FIX_CELLS_AA, FIX_CELLS_BB, FIX_MANIFEST } from '../test/fixtures'
import { createDataSource, DataError, indexCells, validateManifest } from './data'
import type { CellFile } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const realFile = (name: string): unknown => JSON.parse(readFileSync(resolve(HERE, '../../public/data/real', name), 'utf8'))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('validateManifest', () => {
  it('accepts the real manifest', () => {
    const m = validateManifest(realFile('manifest.json'))
    expect(m.schema_version).toBe(2)
    expect(m.regions.map((r) => r.id)).toEqual(['italy_mainland', 'sicily', 'sardinia', 'california'])
    expect(m.days.aqua).toHaveLength(293)
  })
  it('accepts a minimal v2 manifest', () => {
    expect(validateManifest(FIX_MANIFEST)).toBe(FIX_MANIFEST)
    const minimal = {
      schema_version: 2, mock: true, cell_km: 5, first_month: '2000-11', last_month: '2026-11', nrt_from: '2026-07',
      month_to_date: true, baseline_years: [2003, 2025], harmonized_coverage: ['2000-11', '2026-11'],
      sensors: [], regions: [{ id: 'r', bbox: [0, 0, 1, 1] }], groups: [], days: { aqua: [], snpp: [], noaa20: [], none: [] },
    }
    expect(validateManifest(minimal).regions[0].id).toBe('r')
  })
  it('rejects schema version 1 and says which version the app reads', () => {
    expect(() => validateManifest({ ...FIX_MANIFEST, schema_version: 1 })).toThrow(DataError)
    expect(() => validateManifest({ ...FIX_MANIFEST, schema_version: 1 })).toThrow(/schema_version 1.*version 2/)
  })
  it('rejects things that are not objects', () => {
    expect(() => validateManifest(null)).toThrow(/not a JSON object/)
    expect(() => validateManifest('x')).toThrow(/not a JSON object/)
  })
  it('names the broken field', () => {
    const bad = (patch: object) => () => validateManifest({ ...FIX_MANIFEST, ...patch })
    expect(bad({ nrt_from: '2026-7' })).toThrow(/nrt_from/)
    expect(bad({ last_month: '2026-13' })).toThrow(/last_month/)
    expect(bad({ first_month: '2027-01' })).toThrow(/first_month must not be after/)
    expect(bad({ mock: 'no' })).toThrow(/mock/)
    expect(bad({ cell_km: 0 })).toThrow(/cell_km/)
    expect(bad({ month_to_date: 1 })).toThrow(/month_to_date/)
    expect(bad({ baseline_years: [2003] })).toThrow(/baseline_years/)
    expect(bad({ harmonized_coverage: ['2000-11'] })).toThrow(/harmonized_coverage/)
    expect(bad({ harmonized_coverage: ['2000-11', 'x'] })).toThrow(/harmonized_coverage/)
    expect(bad({ sensors: [{ key: 'modis' }] })).toThrow(/sensors\[0\]/)
    expect(bad({ regions: [] })).toThrow(/regions is empty/)
    expect(bad({ regions: [{ id: 'a' }] })).toThrow(/regions\[0\]/)
    expect(bad({ groups: undefined })).toThrow(/groups/)
    expect(bad({ days: { aqua: [], snpp: [], noaa20: [] } })).toThrow(/days/)
    expect(bad({ days: undefined })).toThrow(/days/)
  })
})

describe('indexCells', () => {
  const idx = indexCells(FIX_CELLS_AA)
  it('gives each cell the start of its entries', () => {
    // c0 has 2 entries, c1 has 2, c2 has 1
    expect(Array.from(idx.start)).toEqual([0, 2, 4, 5])
    const c1 = Array.from({ length: idx.start[2] - idx.start[1] }, (_, k) => FIX_CELLS_AA.entries.slice((idx.start[1] + k) * 6, (idx.start[1] + k + 1) * 6))
    expect(c1).toEqual([[1, 0, 1, 1, 0, 0], [1, 7, 1.5, 0, 2, 0]])
  })
  it('gives each cell its month-to-date values by year', () => {
    expect(Array.from(idx.mtdStart)).toEqual([0, 2, 3, 4])
    expect(Array.from(idx.mtdYear)).toEqual([0, 1, 1, 1])
    expect(Array.from(idx.mtdValue)).toEqual([1.5, 2, 0.5, 1])
  })
  it('keeps the file and handles a cell with no entries', () => {
    const sparse: CellFile = { region: 'x', cells: [['a', 0, 0], ['b', 1, 1], ['c', 2, 2]], entries: [2, 3, 1, 1, 0, 0], mtd: [] }
    const s = indexCells(sparse)
    expect(s.file).toBe(sparse)
    expect(Array.from(s.start)).toEqual([0, 0, 0, 1])
    expect(Array.from(s.mtdStart)).toEqual([0, 0, 0, 0])
  })
  it('accepts an empty file', () => {
    const s = indexCells({ region: 'x', cells: [], entries: [], mtd: [] })
    expect(Array.from(s.start)).toEqual([0])
  })
  it('rejects entries that are not sorted by cell, then month', () => {
    const swapped: CellFile = { ...FIX_CELLS_AA, entries: [1, 0, 1, 1, 0, 0, 0, 0, 3, 3, 0, 0] }
    expect(() => indexCells(swapped)).toThrow(/sorted by cell, then month/)
    const monthsBackwards: CellFile = { ...FIX_CELLS_AA, entries: [0, 7, 1, 1, 0, 0, 0, 0, 3, 3, 0, 0] }
    expect(() => indexCells(monthsBackwards)).toThrow(/sorted/)
    const duplicate: CellFile = { ...FIX_CELLS_AA, entries: [0, 7, 1, 1, 0, 0, 0, 7, 3, 3, 0, 0] }
    expect(() => indexCells(duplicate)).toThrow(/sorted/)
  })
  it('indexes the real Sardinia file: entry and month-to-date counts add up', () => {
    const file = realFile('cells/sardinia.json') as CellFile
    const s = indexCells(file)
    expect(file.cells).toHaveLength(861)
    expect(s.start[file.cells.length]).toBe(file.entries.length / 6)
    expect(s.mtdStart[file.cells.length]).toBe(file.mtd.length / 3)
  })
})

describe('createDataSource', () => {
  it('reads the three whole-dataset files from the dataset folder', async () => {
    const fetchFn = vi.fn(async (url: string) => json(url.endsWith('manifest.json') ? FIX_MANIFEST : { url }))
    const ds = createDataSource('/data/real/', fetchFn)
    expect((await ds.manifest()).dataset_name).toBe('Fixture')
    await ds.regions()
    await ds.outlines()
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/data/real/manifest.json', '/data/real/regions.json', '/data/real/outlines.json'])
  })
  it('rejects a v1 manifest through validation', async () => {
    const ds = createDataSource('/', async () => json({ ...FIX_MANIFEST, schema_version: 1 }))
    await expect(ds.manifest()).rejects.toThrow(/schema_version/)
  })
  it('rejects HTML and error statuses as data errors', async () => {
    const html = new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    await expect(createDataSource('/', async () => html).regions()).rejects.toThrow(/Could not load regions.json/)
    await expect(createDataSource('/', async () => new Response('', { status: 404 })).outlines()).rejects.toThrow(/HTTP 404/)
  })
  it('caches cells per region, loading each region once', async () => {
    const fetchFn = vi.fn(async (url: string) => json(url.endsWith('aa.json') ? FIX_CELLS_AA : FIX_CELLS_BB))
    const ds = createDataSource('/data/x/', fetchFn)
    const [a1, a2] = await Promise.all([ds.cells('aa'), ds.cells('aa')])
    expect(a1).toBe(a2)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect((await ds.cells('bb')).file.region).toBe('bb')
    await ds.cells('aa')
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/data/x/cells/aa.json', '/data/x/cells/bb.json'])
    expect(Array.from(a1.start)).toEqual([0, 2, 4, 5])
  })
  it('retries a region after a failed fetch, and keeps the good result afterwards', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValue(json(FIX_CELLS_AA))
    const ds = createDataSource('/data/x/', fetchFn)
    await expect(ds.cells('aa')).rejects.toThrow(/HTTP 500/)
    await ds.cells('aa')
    await ds.cells('aa')
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn).toHaveBeenLastCalledWith('/data/x/cells/aa.json')
  })
  it('treats a missing detections index as absent, and keeps that answer', async () => {
    const html = new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    expect(await createDataSource('/', async () => html).detectionsIndex()).toBeNull()
    const fetchFn = vi.fn(async () => new Response('', { status: 404 }))
    const ds = createDataSource('/', fetchFn)
    expect(await ds.detectionsIndex()).toBeNull()
    expect(await ds.detectionsIndex()).toBeNull()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
  it('retries the detections index after a network or server error, then keeps it', async () => {
    const index = { schema_version: 2, last_day: '2026-11-13', satellites: ['AQUA', 'SNPP', 'NOAA20'], regions: {} }
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(json(index))
    const ds = createDataSource('/data/x/', fetchFn)
    await expect(ds.detectionsIndex()).rejects.toThrow(/Failed to fetch/)
    await expect(ds.detectionsIndex()).rejects.toThrow(/HTTP 503/)
    expect(await ds.detectionsIndex()).toEqual(index)
    expect(await ds.detectionsIndex()).toEqual(index)
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(fetchFn).toHaveBeenLastCalledWith('/data/x/detections/index.json')
  })
  it('does not cache an unsorted cell file as good', async () => {
    const bad: CellFile = { ...FIX_CELLS_AA, entries: [1, 0, 1, 1, 0, 0, 0, 0, 3, 3, 0, 0] }
    const ds = createDataSource('/', async () => json(bad))
    await expect(ds.cells('aa')).rejects.toThrow(/sorted/)
  })
  it('treats a missing or HTML reported.json as absent', async () => {
    const html = new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    expect(await createDataSource('/', async () => html).reported()).toBeNull()
    expect(await createDataSource('/', async () => new Response('', { status: 404 })).reported()).toBeNull()
  })
  it('treats an unreadable or unreachable reported.json as absent', async () => {
    const broken = new Response('{not json', { status: 200, headers: { 'content-type': 'application/json' } })
    expect(await createDataSource('/', async () => broken).reported()).toBeNull()
    expect(await createDataSource('/', async () => { throw new Error('offline') }).reported()).toBeNull()
  })
  it('returns a reported.json that is there', async () => {
    const file = { mock: false, series: [] }
    expect(await createDataSource('/', async () => json(file)).reported()).toEqual(file)
  })
})
