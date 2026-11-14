// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { aggregate, selectCells } from './aggregate'
import { areaFromBbox } from './area'
import { buildCsv, csvFilename } from './csv'
import type { Manifest, TileFile } from './types'

const manifest = {
  schema_version: 1, mock: true, dataset_name: 'Test', grid_deg: 1, tile_deg: 10,
  first_month: '2011-12', last_month: '2012-01', month_to_date: true, nrt_from: '2012-01',
  baseline_years: [2003, 2025], harmonized_coverage: ['2011-12', '2012-01'],
  sensors: [
    { key: 'modis', label: 'MODIS C6.1', source: 'NASA FIRMS', version: '6.1', first_month: '2000-11', last_month: '2026-11' },
    { key: 'viirs_snpp', label: 'VIIRS S-NPP 375 m', source: 'NASA FIRMS', version: '2', first_month: '2012-01', last_month: '2026-11' },
  ],
  coverage: [], tiles: [], presets: [],
  filters: { type: [0], modis_confidence_min: 30, viirs_confidence: ['n', 'h'] },
  method: { name: 'Mock', version: '0', reference_scale: 'VIIRS', fit_years: null, test_years: null },
  validation: { metric: '', value: null, notes: '' }, generated_at: '2026-11-14T00:00:00Z',
} as unknown as Manifest

const tile: TileFile = {
  tile_id: '9_18', cells: ['90_180'],
  series: { harmonized: [[1.25, 2]], modis: [[1, 1]], viirs_snpp: [[null, 3]], viirs_noaa20: [[null, null]] },
}

describe('buildCsv', () => {
  const area = areaFromBbox([0, 0, 2, 2], 'Test, "box"')
  const series = aggregate(manifest, selectCells(area, [tile], 1))
  const csv = buildCsv(manifest, area, series, 0, 1, new Date('2026-11-14T12:00:00Z'))
  const lines = csv.trim().split('\n')
  it('starts with provenance comments', () => {
    expect(lines[0]).toMatch(/^# /)
    expect(csv).toContain('not fires or burned area')
    expect(csv).toContain('MOCK DATA, NOT REAL')
    expect(csv).toContain('Baseline years: 2003-2025')
  })
  it('writes one row per month with blanks for no sensor', () => {
    const rows = lines.filter((l) => !l.startsWith('#'))
    expect(rows[0]).toBe('year,month,hotspots_harmonized,harmonized_low,harmonized_high,modis,viirs_snpp,viirs_noaa20,data_status,sensors')
    expect(rows[1]).toBe('2011,12,1.3,,,1,,,standard,MODIS C6.1')
    expect(rows[2]).toBe('2012,1,2,,,1,3,,partial,MODIS C6.1 + VIIRS S-NPP 375 m')
  })
  it('makes a safe filename', () => {
    expect(csvFilename(area, '2011-12', '2012-01')).toBe('hotspots_test-box_2011-12_2012-01.csv')
  })
})
