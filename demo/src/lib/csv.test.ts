// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIX_CELLS_AA, FIX_MANIFEST, FIX_OUTLINES, FIX_REGIONS } from '../test/fixtures'
import { selectCells, seriesFromCells, seriesFromRegions } from './aggregate'
import { areaFromBbox, areaFromRegion } from './area'
import { buildCsv, CSV_COLUMNS, csvFilename } from './csv'
import { indexCells, type Outlines } from './data'
import type { Manifest, RegionsFile } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const realJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(HERE, '../../public/data/real', name), 'utf8')) as T
const NOW = new Date('2026-11-15T12:00:00Z')

const dataRows = (csv: string) => csv.trim().split('\n').filter((l) => !l.startsWith('#'))
const comments = (csv: string) => csv.trim().split('\n').filter((l) => l.startsWith('#'))

describe('buildCsv with the small fixture', () => {
  const m = FIX_MANIFEST
  const regionArea = areaFromRegion(m, FIX_OUTLINES, 'aa')!
  const groupArea = areaFromRegion(m, FIX_OUTLINES, 'ab')!
  const drawn = areaFromBbox([0, 0, 1, 1], 'Test, "box"')
  const regionCsv = buildCsv(m, regionArea, seriesFromRegions(m, FIX_REGIONS, ['aa']), 0, 23, NOW)
  const groupCsv = buildCsv(m, groupArea, seriesFromRegions(m, FIX_REGIONS, ['aa', 'bb']), 0, 23, NOW)
  const drawnCsv = buildCsv(m, drawn, seriesFromCells(m, FIX_REGIONS, selectCells(drawn, [indexCells(FIX_CELLS_AA)])), 0, 23, NOW)

  it('starts with provenance comments: unit, method, validation, baseline, caveat', () => {
    const text = comments(regionCsv).join('\n')
    expect(regionCsv.startsWith('# ')).toBe(true)
    expect(text).toMatch(/Unit: fire cell-days = 5 km cells/)
    expect(text).toMatch(/Method: Test method \(v0\)/)
    expect(text).toMatch(/Validation .*R² 0\.9, 90% inside the 90% range/)
    expect(text).toMatch(/same calendar month in 2019-2019, leaving out the month's own year/)
    expect(text).toMatch(/not fires or burned area/)
    expect(text).toMatch(/Area: Region A \(1,000 km²; bbox W 0, S 0, E 2, N 2\)/)
    expect(text).not.toMatch(/MOCK/)
  })
  it('says a region uses the harmonized record, and a group adds ranges up', () => {
    expect(regionCsv).toMatch(/harmonized record for this region\./)
    expect(regionCsv).not.toMatch(/estimate/i)
    expect(groupCsv).toMatch(/for these regions, added together/)
    expect(groupCsv).toMatch(/wider than the true range/)
    expect(regionCsv).not.toMatch(/wider than the true range/)
  })
  it('calls the harmonized column of a drawn shape an estimate with no 90% range', () => {
    expect(drawnCsv).toMatch(/is an estimate/)
    expect(drawnCsv).toMatch(/has no 90% range/)
    expect(drawnCsv).toMatch(/Raw sensor columns are exact/)
  })
  it('flags mock datasets', () => {
    const mock = buildCsv({ ...m, mock: true }, regionArea, seriesFromRegions(m, FIX_REGIONS, ['aa']), 0, 1, NOW)
    expect(mock).toContain('MOCK DATA, NOT REAL')
  })
  it('writes the column list of CSV_COLUMNS and one row per month with the same number of fields', () => {
    const rows = dataRows(regionCsv)
    expect(rows[0]).toBe(CSV_COLUMNS.join(','))
    expect(rows).toHaveLength(25)
    for (const r of rows) expect(r.split(',')).toHaveLength(CSV_COLUMNS.length)
    expect(CSV_COLUMNS.slice(0, 6)).toEqual(['year', 'month', 'fire_cell_days_harmonized', 'low_90', 'high_90', 'source'])
  })
  it('writes a region row with its range, source, raw sensors and status', () => {
    // 2019-01: H = 1, range 0..2, Aqua measured, raw Aqua 0, S-NPP and NOAA-20 not flying yet
    expect(dataRows(regionCsv)[1]).toBe('2019,1,1,0,2,measured_aqua,0,,,0,standard,,,,')
    // 2020-03 (index 14): H = 15, mixed Aqua + S-NPP, raw 14 / 28
    expect(dataRows(regionCsv)[15]).toBe('2020,3,15,14,16,mixed,14,28,,0,standard,,,,')
    // 2020-05: two days without a satellite
    expect(dataRows(regionCsv)[17].split(',').slice(9, 11)).toEqual(['2', 'incomplete'])
  })
  it('writes the sum of the cells for a drawn shape, with low_90 and high_90 empty', () => {
    // box [0,0,1,1] contains only c0: month 0 = 3, month 7 = 2.5
    const rows = dataRows(drawnCsv)
    expect(rows[1].split(',').slice(2, 5)).toEqual(['3', '', ''])
    expect(rows[8].split(',').slice(2, 4)).toEqual(['2.5', ''])
  })
  it('explains the unfinished last month and leaves its full-month comparisons empty', () => {
    const note = comments(regionCsv).find((l) => l.includes('is not finished'))
    expect(note).toMatch(/2020-12 is not finished \(data to 2020-12-10\)/)
    expect(note).toMatch(/Days 1-10 against the same days in 2019-2019/)
    const last = dataRows(regionCsv).at(-1)!.split(',')
    expect(last.slice(10)).toEqual(['partial', '', '', '', ''])
  })
  it('does not mention an unfinished month when the range stops before it', () => {
    const csv = buildCsv(m, regionArea, seriesFromRegions(m, FIX_REGIONS, ['aa']), 0, 22, NOW)
    expect(csv).not.toMatch(/is not finished/)
  })
  it('makes a safe filename', () => {
    expect(csvFilename(drawn, '2019-01', '2020-12')).toBe('fire-cell-days_test-box_2019-01_2020-12.csv')
    expect(csvFilename(regionArea, '2019-01', '2020-12')).toBe('fire-cell-days_region-a_2019-01_2020-12.csv')
  })
})

describe('buildCsv with the real regional record', () => {
  const m = realJson<Manifest>('manifest.json')
  const rf = realJson<RegionsFile>('regions.json')
  const outlines = realJson<Outlines>('outlines.json')
  const row = (region: string, ym: string) => {
    const area = areaFromRegion(m, outlines, region)!
    const s = seriesFromRegions(m, rf, [region])
    const i = s.months.indexOf(ym)
    return dataRows(buildCsv(m, area, s, i, i, NOW))[1]
  }

  it("writes Sicily July 2023: Pierre's value, range, S-NPP source, raw counts and statistics", () => {
    // harmonized_monthly.csv: H 165.16, H_pred 116..224; calendar_anomalies.csv: median 101.59, +62.6 %, z 1.48, percentile 81.8
    expect(row('sicily', '2023-07')).toBe('2023,7,165.16,116,224,converted_snpp,207,725,627,0,standard,101.59,62.6,1.48,81.8')
  })
  it('writes California August 2020 (the August Complex): mixed Aqua and S-NPP days, a very high percentile', () => {
    // calendar_anomalies.csv: median 445.93, +358.6 %, z 3.81, percentile 95.45
    expect(row('california', '2020-08')).toBe('2020,8,2045.23,1779.85,2348.05,mixed,1383,4518,4500,0,standard,445.93,358.6,3.81,95.5')
  })
  it('writes California July 2021 as converted from S-NPP, the first month after Aqua', () => {
    const r = row('california', '2021-07').split(',')
    expect(r[2]).toBe('768.68')
    expect(r[5]).toBe('converted_snpp')
    expect(r[7]).toBe('1495')
  })
  it('writes the whole record with the unfinished month last and without full-month comparisons', () => {
    const area = areaFromRegion(m, outlines, 'sardinia')!
    const s = seriesFromRegions(m, rf, ['sardinia'])
    const csv = buildCsv(m, area, s, 0, s.months.length - 1, NOW)
    const rows = dataRows(csv)
    expect(rows).toHaveLength(294)
    const last = rows.at(-1)!.split(',')
    expect(last.slice(0, 2)).toEqual(['2026', '11'])
    expect(last.slice(10)).toEqual(['partial', '', '', '', ''])
    expect(csv).toMatch(/2026-11 is not finished \(data to 2026-11-13\)\. Days 1-13 against the same days in 2003-2025/)
  })
})
