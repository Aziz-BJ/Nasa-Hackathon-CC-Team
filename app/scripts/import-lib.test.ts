// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  accumulate, makeWeight, monthsBetween, parseCsv, seasonOf, simplifyGeometry, simplifyRing, sourceOfDay, type Row,
} from './import-lib'

const HERE = dirname(fileURLToPath(import.meta.url))
const real = (name: string) => readFileSync(resolve(HERE, '../../pipeline/harmonized_outputs_REAL', name), 'utf8')

describe('parseCsv', () => {
  it('reads plain rows by header name', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }])
  })
  it('keeps commas, doubled quotes and newlines inside quoted fields', () => {
    const rows = parseCsv('k,note\n1,"a, b"\n2,"say ""hi"""\n3,"line one\nline two"\n')
    expect(rows.map((r) => r.note)).toEqual(['a, b', 'say "hi"', 'line one\nline two'])
  })
  it('handles CRLF, a missing final newline, blank lines and empty fields', () => {
    expect(parseCsv('a,b,c\r\n1,,3\r\n\r\n4,5,6')).toEqual([{ a: '1', b: '', c: '3' }, { a: '4', b: '5', c: '6' }])
  })
  it('pads short rows with empty strings', () => {
    expect(parseCsv('a,b\n1\n')).toEqual([{ a: '1', b: '' }])
  })
  it("reads the real missing_days.csv, whose quoted notes contain commas", () => {
    const rows = parseCsv(real('missing_days.csv'))
    expect(rows).toHaveLength(128)
    for (const r of rows) {
      expect(Object.keys(r)).toEqual(['satellite', 'date', 'source'])
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    const aug = rows.find((r) => r.satellite === 'AQUA' && r.date === '2020-08-16')
    expect(aug?.source).toBe('data: no Aqua points all day (S-NPP 805, Terra 131)')
  })
})

describe('sourceOfDay (METHOD.md section 0)', () => {
  const none = new Set<string>()
  const miss = (...x: string[]) => new Set(x)
  it('uses Aqua until 2021-06-30', () => {
    expect(sourceOfDay('2005-07-01', none)).toBe('AQUA')
    expect(sourceOfDay('2021-06-30', none)).toBe('AQUA')
  })
  it('replaces a missing Aqua day by S-NPP from 2012-01-20, never before', () => {
    expect(sourceOfDay('2012-01-19', miss('AQUA 2012-01-19'))).toBeNull()
    expect(sourceOfDay('2012-01-20', miss('AQUA 2012-01-20'))).toBe('SNPP')
  })
  it('falls back to NOAA-20 from 2018-04-01 when Aqua and S-NPP are both missing', () => {
    expect(sourceOfDay('2018-03-31', miss('AQUA 2018-03-31', 'SNPP 2018-03-31'))).toBeNull()
    expect(sourceOfDay('2018-04-01', miss('AQUA 2018-04-01', 'SNPP 2018-04-01'))).toBe('NOAA20')
    expect(sourceOfDay('2013-05-01', miss('AQUA 2013-05-01', 'SNPP 2013-05-01'))).toBeNull()
  })
  it('uses S-NPP from 2021-07-01 to 2026-11-01, then NOAA-20', () => {
    expect(sourceOfDay('2021-07-01', none)).toBe('SNPP')
    expect(sourceOfDay('2026-11-01', none)).toBe('SNPP')
    expect(sourceOfDay('2026-11-02', none)).toBe('NOAA20')
  })
  it('replaces a missing S-NPP day by NOAA-20, and gives null when both are missing', () => {
    expect(sourceOfDay('2023-07-06', miss('SNPP 2023-07-06'))).toBe('NOAA20')
    expect(sourceOfDay('2023-07-06', miss('SNPP 2023-07-06', 'NOAA20 2023-07-06'))).toBeNull()
  })
  it('never goes back to S-NPP after 2026-11-01, and a missing NOAA-20 day has no source', () => {
    expect(sourceOfDay('2026-11-05', miss('NOAA20 2026-11-05'))).toBeNull()
  })
  it('ignores missing days of other satellites or other dates', () => {
    expect(sourceOfDay('2010-01-01', miss('SNPP 2010-01-01', 'AQUA 2010-01-02'))).toBe('AQUA')
  })
})

describe('seasonOf and monthsBetween', () => {
  it('calls June to September the fire season', () => {
    expect(['2020-05', '2020-06', '2020-09', '2020-10'].map(seasonOf)).toEqual(['off', 'fire', 'fire', 'off'])
  })
  it('lists months inclusively across a year end', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsBetween('2026-03', '2026-03')).toEqual(['2026-03'])
    expect(monthsBetween('2026-04', '2026-03')).toEqual([])
  })
})

describe('makeWeight', () => {
  const factors: Row[] = [
    { model: 'SNPP->AQUA', region: 'r1', season: 'fire', daynight: 'D', factor: '0.2' },
    { model: 'SNPP->AQUA', region: 'r1', season: 'off', daynight: 'N', factor: '0.1' },
    { model: 'NOAA20->AQUA (chain)', region: 'r1', season: 'fire', daynight: 'D', factor: '0.3' },
  ]
  const w = makeWeight(factors)
  it('is 1 for Aqua and Pierre factor for VIIRS by region, season and day/night', () => {
    expect(w('AQUA', 'anywhere', '2020-07', 'D')).toBe(1)
    expect(w('SNPP', 'r1', '2020-07', 'D')).toBe(0.2)
    expect(w('SNPP', 'r1', '2020-12', 'N')).toBe(0.1)
    expect(w('NOAA20', 'r1', '2020-08', 'D')).toBe(0.3)
  })
  it('fails loudly when a factor is missing', () => {
    expect(() => w('SNPP', 'r1', '2020-07', 'N')).toThrow(/No factor/)
  })
  it("reads Pierre's real factors.csv", () => {
    const rw = makeWeight(parseCsv(real('factors.csv')))
    expect(rw('SNPP', 'italy_mainland', '2020-07', 'D')).toBeCloseTo(0.188812371771255, 12)
    expect(rw('SNPP', 'italy_mainland', '2020-07', 'N')).toBeCloseTo(0.058753862908054955, 12)
  })
})

describe('accumulate', () => {
  const months = monthsBetween('2025-10', '2026-11') // 2025-11 is 1, 2026-10 is 12, 2026-11 is 13
  const weight = (sat: string) => (sat === 'AQUA' ? 1 : sat === 'SNPP' ? 0.5 : 0.25)
  const row = (cell: string, date: string, satellite: string, daynight = 'D'): Row => ({
    cell_id: cell, region: 'r1', cell_lat: cell === 'c1' ? '40.5' : '41.5', cell_lon: '9', date_local: date, satellite, daynight,
  })
  const rows = [
    row('c1', '2026-10-15', 'SNPP'), // source: weight 0.5
    row('c1', '2026-10-15', 'NOAA20'), // seen, but not the source that day: raw count only
    row('c1', '2026-10-16', 'SNPP', 'N'), // weight 0.5
    row('c2', '2026-11-02', 'SNPP'), // after 2026-11-01 S-NPP is no longer the source: raw count only
    row('c2', '2026-11-02', 'NOAA20'), // source, weight 0.25, inside days 1..3
    row('c2', '2026-11-04', 'NOAA20', 'N'), // source, weight 0.25, after the month-to-date day
    row('c2', '2026-11-06', 'NOAA20'), // after lastDay: ignored
    row('c2', '2025-11-01', 'SNPP'), // last year's same days: weight 0.5, counts for month to date
    row('c3', '2024-01-01', 'AQUA'), // before the first month: ignored
  ]
  const acc = accumulate(rows, {
    months, lastDay: '2026-11-05', missing: new Set(), weight, mtd: { month: 11, day: 3 },
  })

  it('records each cell once with its centre and region, ignoring rows outside the months', () => {
    expect([...acc.cells.keys()].sort()).toEqual(['c1', 'c2'])
    expect(acc.cells.get('c1')).toEqual({ region: 'r1', lat: 40.5, lon: 9 })
  })
  it('sums weighted source cell-days and raw counts per cell and month', () => {
    // [weighted, aqua, snpp, noaa20]
    expect(acc.months.get('c1|12')).toEqual([1, 0, 2, 1])
    expect(acc.months.get('c2|13')).toEqual([0.5, 0, 1, 2])
    expect(acc.months.get('c2|1')).toEqual([0.5, 0, 1, 0])
    expect(acc.months.size).toBe(3)
  })
  it('adds the weights up per region and month', () => {
    expect(Object.fromEntries(acc.regionW)).toEqual({ 'r1|12': 1, 'r1|13': 0.5, 'r1|1': 0.5 })
  })
  it('sums the month to date over days 1..N of that calendar month, in every year', () => {
    expect(Object.fromEntries(acc.mtd)).toEqual({ 'c2|2026': 0.25, 'c2|2025': 0.5 })
    expect(Object.fromEntries(acc.regionMtdW)).toEqual({ 'r1|2026': 0.25, 'r1|2025': 0.5 })
  })
  it('skips the month-to-date sums when there is no unfinished month', () => {
    const none = accumulate(rows, { months, lastDay: '2026-11-05', missing: new Set(), weight, mtd: null })
    expect(none.mtd.size).toBe(0)
    expect(none.regionMtdW.size).toBe(0)
  })
  it('follows a missing-days list: a missing S-NPP day is filled by NOAA-20', () => {
    const r = [row('c1', '2026-10-15', 'SNPP'), row('c1', '2026-10-15', 'NOAA20')]
    const a = accumulate(r, { months, lastDay: '2026-11-05', missing: new Set(['SNPP 2026-10-15']), weight, mtd: null })
    expect(a.months.get('c1|12')).toEqual([0.25, 0, 1, 1])
  })
})

describe('simplifyRing and simplifyGeometry', () => {
  const ring = [[0, 0], [1, 0.00001], [2, 0], [3, 0], [3, 3], [0, 3], [0, 0]]
  it('keeps the endpoints and the corners, and drops near-collinear points', () => {
    const out = simplifyRing(ring, 0.001)
    expect(out).toEqual([[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]])
    expect(out[0]).toEqual(out[out.length - 1])
  })
  it('keeps every point when the tolerance is tiny, and rounds to 4 decimals', () => {
    const r = [[0, 0], [1.123456, 0.5], [2, 0], [2, 2], [0, 2], [0, 0]]
    const out = simplifyRing(r, 1e-9)
    expect(out).toHaveLength(6)
    expect(out[1]).toEqual([1.1235, 0.5])
  })
  it('returns tiny rings unchanged', () => {
    const tri = [[0, 0], [1, 0], [0, 1], [0, 0]]
    expect(simplifyRing(tri, 100)).toBe(tri)
  })
  it('turns a Polygon into a MultiPolygon, drops collapsed islets and keeps real holes', () => {
    const islet = [[5, 5], [5.001, 5], [5.001, 5.001], [5, 5.001], [5, 5]]
    const big = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const hole = [[2, 2], [2, 4], [4, 4], [4, 2], [2, 2]]
    const out = simplifyGeometry({ type: 'MultiPolygon', coordinates: [[big, hole], [islet]] }, 0.01)
    expect(out.type).toBe('MultiPolygon')
    expect(out.coordinates).toHaveLength(1)
    expect(out.coordinates[0]).toHaveLength(2)
    const single = simplifyGeometry({ type: 'Polygon', coordinates: [big] }, 0.01)
    expect(single.coordinates).toEqual([[big]])
  })
})
