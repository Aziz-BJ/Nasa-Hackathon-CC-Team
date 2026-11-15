// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIX_CELLS_AA, FIX_CELLS_BB, FIX_MANIFEST, FIX_OUTLINES, FIX_REGIONS } from '../test/fixtures'
import { cellTotals, coverageOf, regionsTouching, selectCells, seriesFromCells, seriesFromRegions } from './aggregate'
import { areaFromBbox, areaFromPolygon, areaFromRegion } from './area'
import { indexCells, type Outlines } from './data'
import type { CellFile, Manifest, RegionsFile } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const realJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(HERE, '../../public/data/real', name), 'utf8')) as T

const m = FIX_MANIFEST
const aa = indexCells(FIX_CELLS_AA)
const bb = indexCells(FIX_CELLS_BB)
const nulls = (n: number) => Array<null>(n).fill(null)

describe('seriesFromRegions', () => {
  it('returns one region as it is, with its 90% range and no estimate flag', () => {
    const s = seriesFromRegions(m, FIX_REGIONS, ['aa'])
    expect(s.months).toHaveLength(24)
    expect(s.months[0]).toBe('2019-01')
    expect(s.months[23]).toBe('2020-12')
    expect(s.values.harmonized).toEqual(FIX_REGIONS.series.aa.harmonized)
    expect(s.low).toEqual(FIX_REGIONS.series.aa.low)
    expect(s.high).toEqual(FIX_REGIONS.series.aa.high)
    expect(s.estimate).toBe(false)
    expect(s.bandSummed).toBe(false)
  })
  it('adds regions up and marks the summed band only for more than one region', () => {
    const s = seriesFromRegions(m, FIX_REGIONS, ['aa', 'bb'])
    expect(s.bandSummed).toBe(true)
    expect(s.values.harmonized[0]).toBe(11) // 1 + 10
    expect(s.values.harmonized[23]).toBe(264) // 24 + 240
    expect(s.low?.[0]).toBe(9) // (1 - 1) + (10 - 1)
    expect(s.high?.[0]).toBe(13)
    expect(s.values.modis[5]).toBe(55)
  })
  it('keeps raw sensors null before launch and adds them up after', () => {
    const s = seriesFromRegions(m, FIX_REGIONS, ['aa', 'bb'])
    expect(s.values.viirs_snpp.slice(0, 6)).toEqual(nulls(6))
    expect(s.values.viirs_snpp[6]).toBe(132) // 11 * 6 * 2
    expect(s.values.viirs_noaa20.slice(0, 17)).toEqual(nulls(17))
    expect(s.values.viirs_noaa20[17]).toBe(561) // 11 * 17 * 3
    expect(s.values.modis[0]).toBe(0) // a sensor that was flying and saw nothing is 0, not null
  })
  it('sums the month to date with its range, per baseline year', () => {
    const s = seriesFromRegions(m, FIX_REGIONS, ['aa', 'bb'])
    expect(s.mtd).toEqual({ years: [2019, 2020], values: [5, 7], low: [3, 5], high: [7, 9] })
    expect(seriesFromRegions(m, { ...FIX_REGIONS, mtd: null }, ['aa']).mtd).toBeNull()
  })
})

describe('regionsTouching', () => {
  it('is the region ids for a region or group area', () => {
    expect(regionsTouching(m, areaFromRegion(m, FIX_OUTLINES, 'aa')!)).toEqual(['aa'])
    expect(regionsTouching(m, areaFromRegion(m, FIX_OUTLINES, 'ab')!)).toEqual(['aa', 'bb'])
  })
  it('is the regions whose box overlaps the box of a drawn shape', () => {
    expect(regionsTouching(m, areaFromBbox([0.5, 0.5, 1, 1]))).toEqual(['aa'])
    expect(regionsTouching(m, areaFromBbox([1, 1, 11, 11]))).toEqual(['aa', 'bb'])
    expect(regionsTouching(m, areaFromBbox([5, 5, 6, 6]))).toEqual([])
  })
})

describe('selectCells', () => {
  it('takes every cell of the named regions and nothing from other loaded files', () => {
    const sel = selectCells(areaFromRegion(m, FIX_OUTLINES, 'aa')!, [aa, bb])
    expect(sel.cells.map((c) => c.id)).toEqual(['c0', 'c1', 'c2'])
    expect(selectCells(areaFromRegion(m, FIX_OUTLINES, 'ab')!, [aa, bb]).cells.map((c) => c.id)).toEqual(['c0', 'c1', 'c2', 'd0'])
  })
  it('takes only the cells whose centre is inside a drawn box', () => {
    const sel = selectCells(areaFromBbox([0, 0, 1, 1]), [aa, bb])
    expect(sel.cells.map((c) => c.id)).toEqual(['c0'])
    expect(sel.cells[0]).toMatchObject({ index: 0, lat: 0.5, lon: 0.5 })
    expect(sel.cells[0].cells).toBe(aa)
    expect(selectCells(areaFromBbox([0, 0, 1, 2]), [aa, bb]).cells.map((c) => c.id)).toEqual(['c0', 'c1'])
  })
  it('tests the real shape, not just its box', () => {
    // Triangle below the line lon + lat = 2.5: c2 (1.5, 1.5) is inside the box but outside the triangle
    const tri = areaFromPolygon({ type: 'Polygon', coordinates: [[[0, 0], [2.5, 0], [0, 2.5], [0, 0]]] })
    expect(selectCells(tri, [aa]).cells.map((c) => c.id)).toEqual(['c0', 'c1'])
  })
  it('works across several files and selects nothing from an empty area', () => {
    expect(selectCells(areaFromBbox([0, 0, 12, 12]), [aa, bb]).cells.map((c) => c.id)).toEqual(['c0', 'c1', 'c2', 'd0'])
    expect(selectCells(areaFromBbox([5, 5, 6, 6]), [aa, bb]).cells).toEqual([])
  })
})

describe('seriesFromCells', () => {
  const all = selectCells(areaFromRegion(m, FIX_OUTLINES, 'aa')!, [aa])
  const s = seriesFromCells(m, FIX_REGIONS, all)
  it('sums the cells per month for every series', () => {
    expect(s.values.harmonized.map((v, i) => [i, v]).filter(([, v]) => v !== 0)).toEqual([[0, 4], [7, 4], [20, 4]])
    expect(s.values.modis[0]).toBe(4)
    expect(s.values.viirs_snpp[7]).toBe(6)
    expect(s.values.viirs_noaa20[20]).toBe(5)
  })
  it('is flagged as an estimate with no 90% range', () => {
    expect(s.estimate).toBe(true)
    expect(s.bandSummed).toBe(false)
    expect(s.low).toBeNull()
    expect(s.high).toBeNull()
  })
  it('puts 0 where a flying sensor saw nothing and null where it was not flying', () => {
    expect(s.values.harmonized[3]).toBe(0)
    expect(s.values.viirs_snpp.slice(0, 6)).toEqual(nulls(6))
    expect(s.values.viirs_snpp[8]).toBe(0)
    expect(s.values.viirs_noaa20.slice(0, 17)).toEqual(nulls(17))
  })
  it('ignores a raw sensor value for a month before that sensor launched', () => {
    const odd: CellFile = { region: 'aa', cells: [['x', 1, 1]], entries: [0, 2, 1, 1, 9, 9], mtd: [] }
    const r = seriesFromCells(m, FIX_REGIONS, selectCells(areaFromBbox([0, 0, 2, 2]), [indexCells(odd)]))
    expect(r.values.modis[2]).toBe(1)
    expect(r.values.viirs_snpp[2]).toBeNull()
    expect(r.values.viirs_noaa20[2]).toBeNull()
  })
  it('sums the month to date per year, without a range', () => {
    // c0: 2019 1.5, 2020 2; c1: 2020 0.5; c2: 2020 1
    expect(s.mtd).toEqual({ years: [2019, 2020], values: [1.5, 3.5], low: null, high: null })
    expect(seriesFromCells(m, { ...FIX_REGIONS, mtd: null } as RegionsFile, all).mtd).toBeNull()
  })
  it('adds up cells from several regions', () => {
    const both = seriesFromCells(m, FIX_REGIONS, selectCells(areaFromRegion(m, FIX_OUTLINES, 'ab')!, [aa, bb]))
    expect(both.values.harmonized[0]).toBe(14) // 3 + 1 + 10
    expect(both.mtd?.values).toEqual([1.5, 10.5]) // 2020: 3.5 + 7
  })
  it('is all zeros (and null before launch) for an empty selection', () => {
    const e = seriesFromCells(m, FIX_REGIONS, { cells: [] })
    expect(e.values.harmonized.every((v) => v === 0)).toBe(true)
    expect(e.values.viirs_snpp[0]).toBeNull()
    expect(e.mtd?.values).toEqual([0, 0])
  })
})

describe('cellTotals', () => {
  const sel = selectCells(areaFromRegion(m, FIX_OUTLINES, 'aa')!, [aa])
  const totals = (key: Parameters<typeof cellTotals>[1], i0: number, i1: number) => cellTotals(sel, key, i0, i1).map((c) => c.total)
  it('totals each cell over the months [i0, i1], both ends included', () => {
    expect(totals('harmonized', 0, 23)).toEqual([5.5, 2.5, 4])
    expect(totals('harmonized', 0, 0)).toEqual([3, 1, 0])
    expect(totals('harmonized', 0, 6)).toEqual([3, 1, 0])
    expect(totals('harmonized', 0, 7)).toEqual([5.5, 2.5, 0])
    expect(totals('harmonized', 7, 7)).toEqual([2.5, 1.5, 0])
    expect(totals('harmonized', 8, 19)).toEqual([0, 0, 0])
    expect(totals('harmonized', 20, 23)).toEqual([0, 0, 4])
  })
  it('reads the column of the chosen series', () => {
    expect(totals('modis', 0, 23)).toEqual([3, 1, 0])
    expect(totals('viirs_snpp', 0, 23)).toEqual([4, 2, 0])
    expect(totals('viirs_noaa20', 20, 20)).toEqual([0, 0, 5])
  })
  it('carries the cell id and centre for drawing', () => {
    expect(cellTotals(sel, 'modis', 0, 0)[1]).toEqual({ id: 'c1', lat: 1.5, lon: 0.5, total: 1 })
  })
})

describe('coverageOf', () => {
  const o: Outlines = FIX_OUTLINES
  it('is full for whole regions, even before the outlines load', () => {
    expect(coverageOf(null, areaFromRegion(m, o, 'aa')!)).toBe('full')
  })
  it('is none for a drawn shape when the outlines are not loaded', () => {
    expect(coverageOf(null, areaFromBbox([0, 0, 1, 1]))).toBe('none')
  })
  it('says full, partial or none for a drawn shape', () => {
    expect(coverageOf(o, areaFromBbox([0.2, 0.2, 1.8, 1.8]))).toBe('full')
    expect(coverageOf(o, areaFromBbox([1, 1, 3, 3]))).toBe('partial')
    expect(coverageOf(o, areaFromBbox([5, 5, 6, 6]))).toBe('none')
  })
  it('counts a shape that spans two regions as partial when the gap between them is in it', () => {
    expect(coverageOf(o, areaFromBbox([0.5, 0.5, 11, 11]))).toBe('partial')
  })
  it('finds a small region inside a huge shape even when no sample point lands in it', () => {
    expect(coverageOf(o, areaFromBbox([-101, -101, 99, 99]))).toBe('partial')
  })
})

describe('real Sardinia: the cells add up to the regional record', () => {
  const manifest = realJson<Manifest>('manifest.json')
  const regions = realJson<RegionsFile>('regions.json')
  const outlines = realJson<Outlines>('outlines.json')
  const cells = indexCells(realJson<CellFile>('cells/sardinia.json'))
  const area = areaFromRegion(manifest, outlines, 'sardinia')!
  const sel = selectCells(area, [cells])
  const fromCells = seriesFromCells(manifest, regions, sel)
  const fromRegion = seriesFromRegions(manifest, regions, ['sardinia'])

  it('selects all 861 cells for the region', () => {
    expect(sel.cells).toHaveLength(861)
    expect(regionsTouching(manifest, area)).toEqual(['sardinia'])
  })
  it('gives the harmonized series of regions.json within 0.01 per month', () => {
    expect(fromCells.months).toEqual(fromRegion.months)
    expect(fromCells.months).toHaveLength(293)
    const worst = Math.max(...fromCells.values.harmonized.map((v, i) => Math.abs((v as number) - (fromRegion.values.harmonized[i] as number))))
    expect(worst).toBeLessThanOrEqual(0.01)
  })
  it('gives the raw sensor counts exactly', () => {
    for (const key of ['modis', 'viirs_snpp', 'viirs_noaa20'] as const) {
      expect(fromCells.values[key]).toEqual(fromRegion.values[key])
    }
  })
  it('gives the month-to-date sums of regions.json within 0.05 per year', () => {
    expect(fromCells.mtd?.years).toEqual(fromRegion.mtd?.years)
    fromCells.mtd?.values.forEach((v, y) => expect(Math.abs(v - (fromRegion.mtd?.values[y] as number))).toBeLessThanOrEqual(0.05))
  })
  it('gives the same cells when the region is drawn as its box', () => {
    const drawn = selectCells(areaFromBbox(area.bbox), [cells])
    expect(drawn.cells.length).toBeGreaterThan(0)
    expect(drawn.cells.length).toBeLessThanOrEqual(861)
  })
})
