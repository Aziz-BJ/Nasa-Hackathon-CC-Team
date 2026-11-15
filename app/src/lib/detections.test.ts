// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { Area } from './area'
import { daySpan, DETECTIONS_OFF, selectDetections, yearsToLoad } from './detections'
import type { DetectionsFile } from './types'

const ALL = { ...DETECTIONS_OFF, show: true }

// Region "aa" covers lon 0..2, lat 0..2. Five detections in 2020: Aqua day, Aqua night, S-NPP, S-NPP, NOAA-20.
const FILE: DetectionsFile = {
  region: 'aa', year: 2020, lon0: 0, lat0: 0,
  s: [0, 1, 2, 3, 4],
  d: [10, 45, 45, 200, 365], // 11 Jan, 15 Feb, 15 Feb, 19 Jul, 31 Dec (2020 is a leap year)
  x: [5000, 15000, 5000, 15000, 5000], // lon 0.5, 1.5, ...
  y: [5000, 5000, 15000, 15000, 5000],
  w: [100, 100, 39, 39, 39],
  h: [100, 100, 36, 36, 36],
  p: [20, 5, 3, 2, 1],
}
const square = (w: number, s: number, e: number, n: number): GeoJSON.Polygon =>
  ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] })
const REGION: Area = { label: 'Region A', source: 'region', regionIds: ['aa'], geometry: square(0, 0, 2, 2), bbox: [0, 0, 2, 2], areaKm2: 1000 }
// A drawn shape over the western half only: keeps x = 0.5.
const WEST: Area = { label: 'West', source: 'drawn', geometry: square(0, 0, 1, 2), bbox: [0, 0, 1, 2], areaKm2: 500 }

describe('daySpan', () => {
  it('gives the days of the chosen months inside one year', () => {
    expect(daySpan(2020, '2020-03', '2020-04')).toEqual([60, 120])
    expect(daySpan(2020, '2019-06', '2021-02')).toEqual([0, 365])
    expect(daySpan(2021, '2019-06', '2021-02')).toEqual([0, 58])
    expect(daySpan(2019, '2019-06', '2021-02')).toEqual([151, 364])
    expect(daySpan(2018, '2019-06', '2021-02')).toBeNull()
  })
})

describe('selectDetections', () => {
  it('keeps every detection of a whole region within the months', () => {
    const sel = selectDetections([FILE], REGION, '2020-01', '2020-12', ALL)
    expect(sel.counts).toEqual([2, 2, 1])
    expect([sel.selected, sel.drawn]).toEqual([5, 5])
    expect(selectDetections([FILE], REGION, '2020-02', '2020-02', ALL).counts).toEqual([1, 1, 0])
  })
  it('tests a drawn shape point by point', () => {
    const sel = selectDetections([FILE], WEST, '2020-01', '2020-12', ALL)
    expect(sel.counts).toEqual([1, 1, 1])
    expect(sel.features.features.every((f) => f.geometry.coordinates[0] < 1)).toBe(true)
  })
  it('counts hidden satellites but does not draw them', () => {
    const sel = selectDetections([FILE], REGION, '2020-01', '2020-12', { ...ALL, aqua: false, noaa20: false })
    expect(sel.counts).toEqual([2, 2, 1])
    expect(sel.selected).toBe(2)
    expect(sel.features.features.map((f) => f.properties.s)).toEqual([1, 1])
  })
  it('thins evenly above the limit and says how many it drew', () => {
    const sel = selectDetections([FILE], REGION, '2020-01', '2020-12', ALL, 2)
    expect([sel.selected, sel.drawn]).toEqual([5, 2])
  })
  it('sizes a dot as half the pixel width in screen pixels at zoom 0, wider away from the equator', () => {
    const [aqua] = selectDetections([FILE], REGION, '2020-01', '2020-01', ALL).features.features
    const mPerPx = (2 * Math.PI * 6_378_137) / 512
    expect(aqua.properties.k).toBeCloseTo(500 / (mPerPx * Math.cos((0.5 * Math.PI) / 180)), 6)
    // At zoom 10 a 1 km Aqua pixel is about 13 screen pixels across.
    expect(aqua.properties.k * 2 ** 10 * 2).toBeCloseTo(13.1, 0)
  })
})

describe('yearsToLoad', () => {
  it('picks the years of the chosen months that have a file', () => {
    expect(yearsToLoad(['2019', '2020', '2021', '2018'], '2019-06', '2020-02')).toEqual([2019, 2020])
    expect(yearsToLoad(['2019'], '2021-01', '2021-12')).toEqual([])
  })
})
