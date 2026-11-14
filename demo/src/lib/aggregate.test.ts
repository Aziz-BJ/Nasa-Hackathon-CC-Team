// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { aggregate, cellTotals, coverageOf, selectCells } from './aggregate'
import { areaFromBbox, areaFromPoint } from './area'
import type { Manifest, TileFile } from './types'

const manifest = {
  schema_version: 1, mock: true, dataset_name: 't', grid_deg: 1, tile_deg: 10,
  first_month: '2011-12', last_month: '2012-02', month_to_date: false, nrt_from: '2012-02',
  baseline_years: [2003, 2025], harmonized_coverage: ['2011-12', '2012-02'],
  sensors: [
    { key: 'modis', label: 'MODIS', source: 'FIRMS', version: '6.1', first_month: '2000-11', last_month: '2026-11' },
    { key: 'viirs_snpp', label: 'S-NPP', source: 'FIRMS', version: '2', first_month: '2012-01', last_month: '2026-11' },
  ],
  coverage: [[0, 0, 10, 10]], tiles: ['9_18'], presets: [],
} as unknown as Manifest

// Cells "90_180" (centre 0.5, 0.5) and "92_182" (centre 2.5, 2.5)
const tile: TileFile = {
  tile_id: '9_18',
  cells: ['90_180', '92_182'],
  series: {
    harmonized: [[1, 2, 3], [10, 20, 30]],
    modis: [[1, 1, 1], [5, 5, 5]],
    viirs_snpp: [[null, 4, 4], [null, 9, 9]],
    viirs_noaa20: [[null, null, null], [null, null, null]],
    harmonized_low: [[0, 1, 2], [8, 16, 24]],
    harmonized_high: [[2, 3, 4], [12, 24, 36]],
  },
}

describe('aggregate', () => {
  it('sums only cells whose centre is inside the area', () => {
    const sel = selectCells(areaFromBbox([0, 0, 2, 2]), [tile], 1)
    expect(sel.cells.map((c) => c.id)).toEqual(['90_180'])
    const s = aggregate(manifest, sel)
    expect(s.months).toEqual(['2011-12', '2012-01', '2012-02'])
    expect(s.values.harmonized).toEqual([1, 2, 3])
    expect(s.low).toEqual([0, 1, 2])
  })
  it('keeps null (no sensor) separate from 0 (no hotspots)', () => {
    const empty = aggregate(manifest, selectCells(areaFromBbox([5, 5, 9, 9]), [tile], 1))
    expect(empty.values.modis).toEqual([0, 0, 0])
    expect(empty.values.viirs_snpp).toEqual([null, 0, 0])
    expect(empty.values.viirs_noaa20).toEqual([null, null, null])
  })
  it('falls back to the containing cell for areas smaller than a cell', () => {
    const sel = selectCells(areaFromPoint(2.4, 2.6, 5), [tile], 1)
    expect(sel.fallback).toBe(true)
    expect(sel.cells.map((c) => c.id)).toEqual(['92_182'])
  })
  it('totals each cell over a month range', () => {
    const sel = selectCells(areaFromBbox([0, 0, 3, 3]), [tile], 1)
    expect(cellTotals(sel, 'viirs_snpp', 0, 2).map((c) => c.total)).toEqual([8, 18])
    expect(cellTotals(sel, 'viirs_snpp', 0, 0).map((c) => c.total)).toEqual([null, null])
  })
  it('reports coverage', () => {
    expect(coverageOf(manifest, areaFromBbox([1, 1, 2, 2]))).toBe('full')
    expect(coverageOf(manifest, areaFromBbox([8, 8, 12, 12]))).toBe('partial')
    expect(coverageOf(manifest, areaFromBbox([20, 20, 22, 22]))).toBe('none')
  })
})
