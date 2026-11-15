// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { FIX_MANIFEST } from '../test/fixtures'
import { inSpan, monthIndex, monthStatus, noVerdictReason, sensorsIn, seriesSpan, sourceCode, sourceOf, STATUS_LABELS } from './status'

const m = FIX_MANIFEST // 2019-01..2020-12, nrt from 2020-10, 2020-12 month to date, S-NPP from 2019-07, NOAA-20 from 2020-06

describe('monthIndex', () => {
  it('counts months from the first month and is -1 outside the record', () => {
    expect(monthIndex(m, '2019-01')).toBe(0)
    expect(monthIndex(m, '2020-12')).toBe(23)
    expect(monthIndex(m, '2018-12')).toBe(-1)
    expect(monthIndex(m, '2021-01')).toBe(-1)
  })
})

describe('monthStatus', () => {
  it('follows the chosen series and marks provisional months', () => {
    expect(monthStatus(m, '2019-02')).toBe('standard')
    expect(monthStatus(m, '2019-02', 'viirs_snpp')).toBe('no_sensor')
    expect(monthStatus(m, '2019-08', 'viirs_snpp')).toBe('standard')
    expect(monthStatus(m, '2019-08', 'viirs_noaa20')).toBe('no_sensor')
    expect(monthStatus(m, '2020-10')).toBe('nrt')
    expect(monthStatus(m, '2020-12')).toBe('partial')
    expect(monthStatus(m, '2018-12')).toBe('no_sensor')
  })
  it('says no_sensor for a series the manifest does not list', () => {
    const noNoaa = { ...m, sensors: m.sensors.filter((s) => s.key !== 'viirs_noaa20') }
    expect(monthStatus(noNoaa, '2020-08', 'viirs_noaa20')).toBe('no_sensor')
  })
  it('calls a harmonized month with days without any satellite incomplete', () => {
    expect(monthStatus(m, '2020-05')).toBe('incomplete') // 2 days with no satellite
    expect(monthStatus(m, '2020-04')).toBe('standard')
  })
  it('does not call a raw sensor month incomplete', () => {
    expect(monthStatus(m, '2020-05', 'viirs_snpp')).toBe('standard')
  })
  it('lets nrt and partial win over incomplete', () => {
    const days = { ...m.days, none: m.days.none.map((d, i) => (i >= 21 ? 1 : d)) } // 2020-10..12
    const mm = { ...m, days }
    expect(monthStatus(mm, '2020-10')).toBe('nrt')
    expect(monthStatus(mm, '2020-12')).toBe('partial')
  })
  it('has a label for every status', () => {
    for (const s of ['standard', 'nrt', 'partial', 'incomplete', 'no_sensor'] as const) expect(STATUS_LABELS[s]).toBeTruthy()
  })
  it('treats the last month as complete when the manifest says it is', () => {
    expect(monthStatus({ ...m, month_to_date: false, nrt_from: '2021-01' }, '2020-12')).toBe('standard')
  })
})

describe('spans', () => {
  it('knows when each series can have values', () => {
    expect(seriesSpan(m, 'harmonized')).toEqual(['2019-01', '2020-12'])
    expect(seriesSpan(m, 'viirs_noaa20')).toEqual(['2020-06', '2020-12'])
    expect(seriesSpan({ ...m, sensors: [] }, 'modis')).toBeNull()
  })
  it('compares months as text', () => {
    expect(inSpan('2019-07', ['2019-07', '2019-07'])).toBe(true)
    expect(inSpan('2019-06', ['2019-07', '2020-01'])).toBe(false)
  })
  it('lists the sensors operating in a month', () => {
    expect(sensorsIn(m, '2019-03').map((s) => s.key)).toEqual(['modis'])
    expect(sensorsIn(m, '2020-08').map((s) => s.key)).toEqual(['modis', 'viirs_snpp', 'viirs_noaa20'])
  })
})

describe('sourceOf and sourceCode', () => {
  it('names a single source in plain words', () => {
    expect(sourceOf(m, '2019-05')).toBe('measured by Aqua MODIS')
    expect(sourceOf(m, '2020-07')).toBe('converted from S-NPP VIIRS')
    expect(sourceOf(m, '2020-08')).toBe('converted from NOAA-20 VIIRS (via S-NPP)')
  })
  it('lists the days per satellite when several were used', () => {
    expect(sourceOf(m, '2020-03')).toBe('Aqua 25 days, S-NPP 3 days')
    expect(sourceOf(m, '2020-05')).toBe('Aqua 26 days, no satellite 2 days')
  })
  it('says "1 day" in the singular', () => {
    const days = { ...m.days, snpp: m.days.snpp.map((d, i) => (i === 0 ? 1 : d)) }
    expect(sourceOf({ ...m, days }, '2019-01')).toBe('Aqua 28 days, S-NPP 1 day')
  })
  it('handles months outside the record and months with no satellite at all', () => {
    expect(sourceOf(m, '2030-01')).toBe('no data')
    expect(sourceCode(m, '2030-01')).toBe('')
    const empty = { ...m, days: { aqua: m.days.aqua.map(() => 0), snpp: m.days.snpp.map(() => 0), noaa20: m.days.noaa20.map(() => 0), none: m.days.none.map(() => 30) } }
    expect(sourceOf(empty, '2019-01')).toBe('no satellite data')
    expect(sourceCode(empty, '2019-01')).toBe('none')
  })
  it('gives the CSV source codes', () => {
    expect(sourceCode(m, '2019-05')).toBe('measured_aqua')
    expect(sourceCode(m, '2020-07')).toBe('converted_snpp')
    expect(sourceCode(m, '2020-08')).toBe('converted_noaa20')
    expect(sourceCode(m, '2020-03')).toBe('mixed')
    expect(sourceCode(m, '2020-05')).toBe('measured_aqua') // days without a satellite do not make it mixed
  })
})

describe('noVerdictReason', () => {
  it('gives no verdict to a month with days missing every satellite, only in the harmonized record', () => {
    expect(monthStatus(m, '2020-05')).toBe('incomplete')
    expect(noVerdictReason(m, 'harmonized', '2020-05')).toMatch(/no satellite data/)
    expect(noVerdictReason(m, 'harmonized', '2020-04')).toBeNull()
  })
  it('gives no verdict to raw Aqua once its orbit has drifted (July 2021 on)', () => {
    expect(noVerdictReason(m, 'modis', '2021-06')).toBeNull()
    expect(noVerdictReason(m, 'modis', '2021-07')).toMatch(/orbit has drifted/)
    expect(noVerdictReason(m, 'viirs_snpp', '2021-07')).toBeNull()
  })
})
