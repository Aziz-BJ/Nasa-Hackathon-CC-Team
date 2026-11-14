// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { monthRange } from './months'
import {
  monthlyAnomalies, percentileOf, quantile, rankOf, relativeAnomaly,
  sameMonthBaseline, summarizeMonth, verdictFor, yearToDate,
} from './indices'

// 2003-01 .. 2006-12: every August = 10, 20, 30, 40 for 2003..2006; every other month = 1
const months = monthRange('2003-01', '2006-12')
const series = months.map((ym) => (ym.endsWith('-08') ? (Number(ym.slice(0, 4)) - 2002) * 10 : 1))

describe('indices', () => {
  it('quantile interpolates like numpy', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10, 20, 30], 0.25)).toBe(15)
  })
  it('builds a same-month baseline that excludes the focus year', () => {
    const b = sameMonthBaseline(series, months, 8, [2003, 2006], 2006)!
    expect(b.years).toEqual([2003, 2004, 2005])
    expect(b.median).toBe(20)
    expect(b.mean).toBe(20)
  })
  it('floors the anomaly denominator', () => {
    expect(relativeAnomaly(30, 20)).toBe(50)
    expect(relativeAnomaly(6, 0, 5)).toBe(120)
  })
  it('ranks and grades', () => {
    expect(percentileOf(40, [10, 20, 30])).toBe(100)
    expect(rankOf(40, [10, 20, 30])).toEqual({ rank: 1, of: 4 })
    expect(verdictFor(100)).toBe('well-above')
    expect(verdictFor(50)).toBe('typical')
    expect(verdictFor(5)).toBe('well-below')
  })
  it('summarizes a focus month', () => {
    const s = summarizeMonth(series, months, '2006-08', [2003, 2006])
    expect(s.value).toBe(40)
    expect(s.vsMedianPct).toBe(100)
    expect(s.rank).toEqual({ rank: 1, of: 4 })
    expect(s.verdict).toBe('well-above')
  })
  it('compares year to date', () => {
    // Jan-Aug 2006 = 7 + 40 = 47; baseline 2003-2005 = 17, 27, 37 -> median 27
    const y = yearToDate(series, months, '2006-08', [2003, 2006])!
    expect(y.current).toBe(47)
    expect(y.typical).toBe(27)
  })
  it('lists monthly anomalies in a range', () => {
    const i = months.indexOf('2006-08')
    const a = monthlyAnomalies(series, months, i, i, [2003, 2006])
    expect(a).toEqual([{ month: '2006-08', value: 40, reference: 20, anomalyPct: 100 }])
  })
})
