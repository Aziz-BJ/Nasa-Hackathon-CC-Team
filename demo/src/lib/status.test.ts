// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { monthStatus } from './status'
import type { Manifest } from './types'

const m = {
  last_month: '2026-11', month_to_date: true, nrt_from: '2026-07', harmonized_coverage: ['2000-11', '2026-11'],
  sensors: [{ key: 'viirs_snpp', first_month: '2012-01', last_month: '2026-11' }],
} as unknown as Manifest

describe('monthStatus', () => {
  it('follows the chosen series and marks provisional months', () => {
    expect(monthStatus(m, '2005-06')).toBe('standard')
    expect(monthStatus(m, '2005-06', 'viirs_snpp')).toBe('no_sensor')
    expect(monthStatus(m, '2005-06', 'viirs_noaa20')).toBe('no_sensor') // not in this manifest
    expect(monthStatus(m, '2026-08', 'viirs_snpp')).toBe('nrt')
    expect(monthStatus(m, '2026-11')).toBe('partial')
    expect(monthStatus(m, '2000-10')).toBe('no_sensor')
  })
})
