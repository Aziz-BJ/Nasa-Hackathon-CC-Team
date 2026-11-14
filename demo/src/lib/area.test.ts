// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromPoint, areaFromPolygon, checkSize, validateBbox, validateDrawn, validatePoint } from './area'

describe('area', () => {
  it('validates boxes in west, south, east, north order', () => {
    expect(validateBbox([-8.7, 49.8, 1.8, 60.9])).toBeNull()
    expect(validateBbox([1, 50, -1, 60])).toMatch(/180° line/)
    expect(validateBbox([0, 60, 1, 50])).toMatch(/South must be less/)
    expect(validateBbox([0, -91, 1, 0])).toMatch(/Latitude/)
    expect(validateBbox([0, NaN, 1, 0])).toMatch(/all four/)
  })
  it('computes a box area close to the real value', () => {
    // 1 x 1 degree at the equator is about 12,300 km²
    const a = areaFromBbox([0, 0, 1, 1])
    expect(a.areaKm2).toBeGreaterThan(12_000)
    expect(a.areaKm2).toBeLessThan(12_500)
    expect(a.bbox).toEqual([0, 0, 1, 1])
  })
  it('builds a circle from a point and radius', () => {
    const a = areaFromPoint(51.5, -0.1, 50)
    expect(a.areaKm2).toBeGreaterThan(7_700) // pi * 50^2 = 7,854 (64-step polygon is slightly smaller)
    expect(a.areaKm2).toBeLessThan(7_900)
    expect(validatePoint(51.5, -0.1, 0)).toMatch(/more than 0/)
  })
  it('rejects areas over the size limit', () => {
    expect(checkSize(areaFromBbox([-180, -60, 180, 80]))).toMatch(/limit/)
  })
  it('applies the typed-coordinate rules to drawn shapes', () => {
    const ring = (lons: number[]) => areaFromPolygon({ type: 'Polygon', coordinates: [[[lons[0], 60], [lons[1], 60], [lons[1], 65], [lons[0], 65], [lons[0], 60]]] })
    expect(validateDrawn(ring([175, -175]))).toMatch(/180° line/) // wraps from +175 to -175
    expect(validateDrawn(ring([170, 190]))).toMatch(/180° line/) // longitudes past 180
    expect(validateDrawn(areaFromBbox([-60, -50, 60, 50]))).toMatch(/limit/)
    expect(validateDrawn(areaFromBbox([0, 0, 1, 1]))).toBeNull()
  })
})
