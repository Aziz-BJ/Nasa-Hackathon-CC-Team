// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { addMonths, labelYm, monthRange, monthsBetween, parseYm } from './months'

describe('months', () => {
  it('parses and rejects', () => {
    expect(parseYm('2012-01')).toEqual({ year: 2012, month: 1 })
    expect(() => parseYm('2012-13')).toThrow(/01-12/)
    expect(() => parseYm('2012-1')).toThrow(/YYYY-MM/)
  })
  it('does month arithmetic across years', () => {
    expect(monthsBetween('2000-11', '2001-02')).toBe(3)
    expect(addMonths('2000-11', 3)).toBe('2001-02')
    expect(addMonths('2001-01', -1)).toBe('2000-12')
  })
  it('builds inclusive ranges', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthRange('2026-02', '2025-11')).toEqual([])
  })
  it('labels months', () => {
    expect(labelYm('2026-11')).toBe('Nov 2026')
  })
})
