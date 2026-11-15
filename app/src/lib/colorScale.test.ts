// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { anomalyBin, anomalyColor, buildCountScale, displayRound, NO_DATA_FILL, VERDICT_COLORS, ZERO_FILL } from './colorScale'

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
    expect(s.labels).toEqual(['5'])
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
  it('keeps every printed value inside its printed range', () => {
    const values = [1.04, 9.96, 12, 17.599, 17.6, 18.2, 36.4, 52, 53.7, 120.4, 181.6, 182.4, 999.5]
    const s = buildCountScale(values, { method: 'quantile', bins: 7, palette: 'inferno' })
    expect(s.edges.every((e) => displayRound(e) === e)).toBe(true)
    for (const v of values) {
      const i = s.binOf(v)
      expect(displayRound(v)).toBeGreaterThanOrEqual(s.edges[i])
      if (i + 1 < s.edges.length) expect(displayRound(v)).toBeLessThan(s.edges[i + 1])
    }
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

describe('converted (fractional) counts', () => {
  it('starts the lowest bin at "more than 0" when the smallest value rounds to 0', () => {
    const s = buildCountScale([0.004, 0.5, 3, 40, 200], { method: 'quantile', bins: 4, palette: 'inferno' })
    expect(s.edges[0]).toBe(0)
    expect(s.labels[0]).toMatch(/^more than 0 to </)
    expect(s.colorOf(0.004)).toBe(s.colors[0]) // positive, so not the zero colour
    expect(s.colorOf(0)).toBe(ZERO_FILL)
  })
  it('prints ordinary lower bounds otherwise', () => {
    const s = buildCountScale([1, 5, 40, 200], { method: 'quantile', bins: 3, palette: 'inferno' })
    expect(s.labels[0]).toMatch(/^1 to </)
  })
})

describe('quiet periods', () => {
  const opts = { method: 'quantile', bins: 7, palette: 'inferno' } as const
  const sane = (labels: string[]) => {
    for (const l of labels) {
      expect(l).not.toMatch(/0 to 0$/)
      const m = /^(?:more than )?([\d.,]+) to <?([\d.,]+)$/.exec(l)
      if (m && !l.startsWith('more than')) expect(Number(m[1].replace(/,/g, ''))).toBeLessThan(Number(m[2].replace(/,/g, '')))
    }
  }
  it('has no bins when everything is zero or missing', () => {
    const s = buildCountScale([0, 0, null, 0], opts)
    expect(s.edges).toEqual([])
    expect(s.labels).toEqual([])
    expect(s.colorOf(0)).toBe(ZERO_FILL)
    expect(s.colorOf(null)).toBe(NO_DATA_FILL)
    expect(buildCountScale([], opts).labels).toEqual([])
  })
  it('prints a single value once, not as an empty range', () => {
    expect(buildCountScale([0, 7, 7], opts).labels).toEqual(['7'])
  })
  it('reads "more than 0 to <0.1" when every positive value is tiny (Sardinia, December 2022)', () => {
    for (const v of [[0.0248], [0.0248, 0.0248], [0, 0.0248, 0.031, 0.04]]) {
      const s = buildCountScale(v, opts)
      expect(s.labels).toEqual(['more than 0 to <0.1'])
      expect(s.colorOf(0.0248)).toBe(s.colors[0])
      sane(s.labels)
    }
  })
  it('stays sensible when tiny values mix with large ones', () => {
    const s = buildCountScale([0, 0.0248, 0.6, 3, 40, 900], opts)
    expect(s.labels[0]).toMatch(/^more than 0 to <\d/)
    sane(s.labels)
    expect(new Set(s.labels).size).toBe(s.labels.length)
    const t = buildCountScale([0.14, 0.1], opts)
    sane(t.labels)
    expect(t.labels).toEqual(['0.1'])
  })
})

describe('VERDICT_COLORS', () => {
  it('has a distinct colour for each verdict, from blue (well below) to red (well above)', () => {
    const order = ['well-below', 'below', 'typical', 'above', 'well-above'] as const
    const colors = order.map((k) => VERDICT_COLORS[k])
    expect(new Set(colors).size).toBe(5)
    const rgb = (c: string) => (/rgb\((\d+), (\d+), (\d+)\)/.exec(c) ?? []).slice(1).map(Number)
    const [r0, , b0] = rgb(colors[0])
    const [r4, , b4] = rgb(colors[4])
    expect(b0).toBeGreaterThan(r0) // blue
    expect(r4).toBeGreaterThan(b4) // red
  })
})
