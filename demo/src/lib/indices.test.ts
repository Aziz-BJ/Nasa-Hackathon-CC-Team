// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import {
  calendarMedians, compareWith, deltaPct, monthlyAnomalies, percentileOf, quantile, rankOf, relativeAnomaly, robustZ,
  sameMonthBaseline, statsOf, summarizeMonth, summarizeMtd, verdictFor, yearToDate, zScore,
} from './indices'
import { monthRange } from './months'

// 2003-01 .. 2006-12: every August = 10, 20, 30, 40 for 2003..2006; every other month = 1
const months = monthRange('2003-01', '2006-12')
const series = months.map((ym) => (ym.endsWith('-08') ? (Number(ym.slice(0, 4)) - 2002) * 10 : 1))

describe('quantile and statsOf', () => {
  it('quantile interpolates like numpy', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10, 20, 30], 0.25)).toBe(15)
    expect(quantile([7], 0.9)).toBe(7)
    expect(quantile([], 0.5)).toBeNaN()
  })
  it('needs at least 3 baseline values', () => {
    expect(statsOf([2003, 2004], [1, 2])).toBeNull()
    const s = statsOf([2003, 2004, 2005], [30, 10, 20])!
    expect([s.median, s.mean, s.sd]).toEqual([20, 20, 10])
    expect([s.p25, s.p75]).toEqual([15, 25])
  })
})

describe('sameMonthBaseline', () => {
  it('excludes the focus year', () => {
    const b = sameMonthBaseline(series, months, 8, [2003, 2006], 2006)!
    expect(b.years).toEqual([2003, 2004, 2005])
    expect(b.median).toBe(20)
    expect(b.mean).toBe(20)
  })
  it('skips null months and years outside the baseline window', () => {
    const withGap = series.map((v, i) => (months[i] === '2004-08' ? null : v))
    expect(sameMonthBaseline(withGap, months, 8, [2003, 2006], 2006)).toBeNull() // only 2 left
    expect(sameMonthBaseline(series, months, 8, [2004, 2006])!.years).toEqual([2004, 2005, 2006])
  })
})

describe('percentile (METHOD.md section 8: share of the baseline at or below the value)', () => {
  it('counts ties as "at or below"', () => {
    expect(percentileOf(40, [10, 20, 30])).toBe(100)
    expect(percentileOf(20, [10, 20, 30])).toBeCloseTo(66.6667, 3)
    expect(percentileOf(5, [10, 20, 30])).toBe(0)
    expect(percentileOf(1, [])).toBeNaN()
  })
  it('matches a hand-checked row of calendar_anomalies.csv: 5 of 22 years at or below is 22.7272...', () => {
    const baseline = [...Array(5).fill(10), ...Array(17).fill(100)]
    expect(percentileOf(10, baseline)).toBeCloseTo(22.7272727, 6)
  })
})

describe('deltaPct, robustZ, relativeAnomaly, zScore', () => {
  it('delta % is against the median and null when the median is 0', () => {
    expect(deltaPct(30, 20)).toBe(50)
    expect(deltaPct(10, 20)).toBe(-50)
    expect(deltaPct(5, 0)).toBeNull()
  })
  it('robust z uses the median and 1.4826 * MAD', () => {
    // median 3, abs deviations 2,1,0,1,2 -> MAD 1
    expect(robustZ(5, [1, 2, 3, 4, 5])).toBeCloseTo(2 / 1.4826, 10)
    expect(robustZ(3, [1, 2, 3, 4, 5])).toBe(0)
  })
  it('robust z is null when the MAD is 0 or the sample is empty', () => {
    expect(robustZ(9, [2, 2, 2, 7])).toBeNull()
    expect(robustZ(9, [])).toBeNull()
  })
  it('floors the anomaly denominator', () => {
    expect(relativeAnomaly(30, 20)).toBe(50)
    expect(relativeAnomaly(6, 0, 5)).toBe(120)
  })
  it('z-score is null for a flat sample', () => {
    expect(zScore(5, 3, 2)).toBe(1)
    expect(zScore(5, 3, 0)).toBeNull()
  })
})

describe('ranks and verdicts', () => {
  it('ranks 1 = highest, ties share the better rank', () => {
    expect(rankOf(40, [10, 20, 30])).toEqual({ rank: 1, of: 4 })
    expect(rankOf(20, [10, 20, 30])).toEqual({ rank: 2, of: 4 })
    expect(rankOf(30, [30, 30, 10])).toEqual({ rank: 1, of: 4 })
  })
  it('grades with the verdict thresholds 10 | 25 | 75 | 90', () => {
    expect(verdictFor(100)).toBe('well-above')
    expect(verdictFor(91)).toBe('well-above')
    expect(verdictFor(90)).toBe('above')
    expect(verdictFor(75)).toBe('typical')
    expect(verdictFor(25)).toBe('typical')
    expect(verdictFor(24.9)).toBe('below')
    expect(verdictFor(9.9)).toBe('well-below')
  })
})

describe('summarizeMonth', () => {
  it('summarizes a focus month against the other years, with the median as the reference', () => {
    const s = summarizeMonth(series, months, '2006-08', [2003, 2006])
    expect(s.value).toBe(40)
    expect(s.baseline?.median).toBe(20)
    expect(s.deltaPct).toBe(100)
    expect(s.percentile).toBe(100)
    expect(s.rank).toEqual({ rank: 1, of: 4 })
    expect(s.verdict).toBe('well-above')
    expect(s.z).toBeCloseTo(20 / (1.4826 * 10), 10)
  })
  it('gives an empty summary when the month is not in the series or the baseline is too short', () => {
    const outside = summarizeMonth(series, months, '2010-08', [2003, 2006])
    expect(outside.value).toBeNull()
    expect(outside.verdict).toBeNull()
    const tooShort = summarizeMonth(series, months, '2006-08', [2005, 2006])
    expect(tooShort.value).toBe(40)
    expect(tooShort.baseline).toBeNull()
    expect(tooShort.percentile).toBeNull()
  })
  it('has no delta % when the baseline median is 0 but still a percentile', () => {
    const zeros = months.map((ym) => (ym === '2006-08' ? 3 : 0))
    const s = summarizeMonth(zeros, months, '2006-08', [2003, 2006])
    expect(s.deltaPct).toBeNull()
    expect(s.percentile).toBe(100)
    expect(s.z).toBeNull()
  })
  it('compareWith stays empty without a value', () => {
    const b = statsOf([2003, 2004, 2005], [1, 2, 3])
    expect(compareWith('2006-08', null, b).percentile).toBeNull()
  })
})

describe('summarizeMtd', () => {
  const mtd = { years: [2003, 2004, 2005, 2006, 2007], values: [10, 20, 30, 40, 50] }
  it('uses only the baseline years and never the focus year', () => {
    const s = summarizeMtd(mtd, '2007-11', [2003, 2006])
    expect(s.value).toBe(50)
    expect(s.baseline?.years).toEqual([2003, 2004, 2005, 2006])
    expect(s.baseline?.median).toBe(25)
    expect(s.deltaPct).toBe(100)
    expect(s.percentile).toBe(100)
  })
  it('is empty when the focus year is not in the month-to-date table', () => {
    expect(summarizeMtd(mtd, '2010-11', [2003, 2006]).value).toBeNull()
  })
})

describe('yearToDate', () => {
  it('compares January to the focus month with the same span in the baseline years', () => {
    // Jan-Aug 2006 = 7 + 40 = 47; baseline 2003-2005 = 17, 27, 37 -> median 27
    const y = yearToDate(series, months, '2006-08', [2003, 2006])!
    expect(y.current).toBe(47)
    expect(y.typical).toBe(27)
  })
  it('is empty when the year is missing early months', () => {
    const m2 = monthRange('2000-11', '2006-12') // the record starts in November 2000
    const flat = m2.map(() => 10)
    expect(yearToDate(flat, m2, '2000-12', [2000, 2006])).toBeNull()
    expect(yearToDate(flat, m2, '2006-12', [2000, 2006])).toEqual({ current: 120, typical: 120, anomalyPct: 0, years: 5 })
  })
})

describe('monthlyAnomalies and calendarMedians', () => {
  it('lists monthly anomalies against the median by default', () => {
    const i = months.indexOf('2006-08')
    expect(monthlyAnomalies(series, months, i, i, [2003, 2006])).toEqual([{ month: '2006-08', value: 40, reference: 20, anomalyPct: 100 }])
  })
  it('can use the mean instead, and skips months without a baseline or value', () => {
    const skewed = months.map((ym) => ({ '2003-08': 1, '2004-08': 1, '2005-08': 10, '2006-08': 40 } as Record<string, number>)[ym] ?? 1)
    const i = months.indexOf('2006-08')
    const [med] = monthlyAnomalies(skewed, months, i, i, [2003, 2006], 'median')
    const [mean] = monthlyAnomalies(skewed, months, i, i, [2003, 2006], 'mean')
    expect(med.reference).toBe(1)
    expect(mean.reference).toBe(4)
    expect(monthlyAnomalies(series.map(() => null), months, 0, 5, [2003, 2006])).toEqual([])
  })
  it('gives the typical value of each calendar month', () => {
    const med = calendarMedians(series, months, [2003, 2006])
    expect(med[7]).toBe(25) // Augusts 10, 20, 30, 40
    expect(med[0]).toBe(1)
    expect(calendarMedians(series, months, [2010, 2012]).every((v) => v === null)).toBe(true)
  })
})
