// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { bboxesOverlap, cellSquare, unionBbox } from './grid'

describe('cellSquare', () => {
  it('is a closed ring in lon, lat order around the centre', () => {
    const ring = cellSquare(40, 9, 5)
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
    const lons = ring.map((p) => p[0])
    const lats = ring.map((p) => p[1])
    expect((Math.min(...lons) + Math.max(...lons)) / 2).toBeCloseTo(9, 5)
    expect((Math.min(...lats) + Math.max(...lats)) / 2).toBeCloseTo(40, 5)
  })
  it('is 5 km tall everywhere and 5 km wide after the cos(lat) correction', () => {
    for (const lat of [0, 38, 60]) {
      const ring = cellSquare(lat, 0, 5)
      const height = (ring[2][1] - ring[0][1]) * 111.32
      const width = (ring[1][0] - ring[0][0]) * 111.32 * Math.cos((lat * Math.PI) / 180)
      expect(height).toBeCloseTo(5, 3)
      expect(width).toBeCloseTo(5, 3)
    }
  })
  it('goes counter-clockwise (south-west, south-east, north-east, north-west)', () => {
    const [sw, se, ne, nw] = cellSquare(10, 10, 5)
    expect(se[0]).toBeGreaterThan(sw[0])
    expect(ne[1]).toBeGreaterThan(se[1])
    expect(nw[0]).toBeLessThan(ne[0])
  })
  it('scales with the side length', () => {
    const a = cellSquare(0, 0, 5)
    const b = cellSquare(0, 0, 10)
    expect(b[1][0] - b[0][0]).toBeCloseTo(2 * (a[1][0] - a[0][0]), 5)
  })
})

describe('bboxesOverlap', () => {
  it('detects overlap, containment and touching edges', () => {
    expect(bboxesOverlap([0, 0, 2, 2], [1, 1, 3, 3])).toBe(true)
    expect(bboxesOverlap([0, 0, 10, 10], [4, 4, 5, 5])).toBe(true)
    expect(bboxesOverlap([0, 0, 1, 1], [1, 1, 2, 2])).toBe(true) // sharing a corner counts
  })
  it('rejects boxes that are apart in longitude or latitude', () => {
    expect(bboxesOverlap([0, 0, 1, 1], [2, 0, 3, 1])).toBe(false)
    expect(bboxesOverlap([0, 0, 1, 1], [0, 2, 1, 3])).toBe(false)
  })
})

describe('unionBbox', () => {
  it('spans all the boxes', () => {
    expect(unionBbox([[6, 38, 18, 47], [12, 35, 15, 38], [8, 38, 10, 41]])).toEqual([6, 35, 18, 47])
  })
  it('returns a single box unchanged', () => {
    expect(unionBbox([[1, 2, 3, 4]])).toEqual([1, 2, 3, 4])
  })
})
