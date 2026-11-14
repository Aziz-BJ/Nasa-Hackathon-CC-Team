// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { anomalyBin, anomalyColor, buildCountScale, NO_DATA_FILL, ZERO_FILL } from './colorScale'

describe('buildCountScale', () => {
  const values = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]
  it('separates no data, zero and positive counts', () => {
    const s = buildCountScale(values, { method: 'quantile', bins: 4, palette: 'inferno' })
    expect(s.colorOf(null)).toBe(NO_DATA_FILL)
    expect(s.colorOf(0)).toBe(ZERO_FILL)
    expect(s.colorOf(1)).toBe(s.colors[0])
    expect(s.colorOf(100)).toBe(s.colors[s.colors.length - 1])
  })
  it('is relative to the values it was built from', () => {
    const narrow = buildCountScale([1, 2, 3, 4], { method: 'quantile', bins: 4, palette: 'inferno' })
    const wide = buildCountScale([1, 20, 300, 4000], { method: 'quantile', bins: 4, palette: 'inferno' })
    expect(narrow.binOf(4)).toBe(narrow.colors.length - 1)
    expect(wide.binOf(4)).toBe(0)
  })
  it('collapses to one bin when all values are equal', () => {
    const s = buildCountScale([5, 5, 5], { method: 'quantile', bins: 7, palette: 'cividis' })
    expect(s.edges).toEqual([5])
    expect(s.labels).toEqual(['5 to 5'])
  })
  it('falls back to log bins when ties collapse the quantile bins', () => {
    const skewed = [...Array(99).fill(1), 1000]
    const s = buildCountScale(skewed, { method: 'quantile', bins: 7, palette: 'inferno' })
    expect(s.edges.length).toBeGreaterThan(2)
    expect(s.colorOf(1)).not.toBe(s.colorOf(1000))
    // A narrow range keeps its quantile bins: log bins would merge 10 and 19
    const narrow = buildCountScale([...Array(40).fill(10), 11, 12, 13, 14, 15, 16, 17, 18, 19], { method: 'quantile', bins: 7, palette: 'inferno' })
    expect(narrow.colorOf(10)).not.toBe(narrow.colorOf(19))
  })
  it('makes log bins with round numbers', () => {
    const s = buildCountScale([1, 1000], { method: 'log', bins: 3, palette: 'inferno' })
    expect(s.edges).toEqual([1, 10, 100])
  })
})

describe('anomaly colours', () => {
  it('bins symmetric percentages', () => {
    expect(anomalyBin(-80)).toBe(0)
    expect(anomalyBin(0)).toBe(3)
    expect([anomalyBin(-10), anomalyBin(10)]).toEqual([3, 3])
    expect([anomalyBin(-25), anomalyBin(25)]).toEqual([2, 4])
    expect([anomalyBin(-50), anomalyBin(50)]).toEqual([1, 5])
    expect([anomalyBin(-51), anomalyBin(51)]).toEqual([0, 6])
    expect(anomalyBin(300)).toBe(6)
    expect(anomalyColor(null)).toBe(NO_DATA_FILL)
  })
})
