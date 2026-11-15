// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIX_MANIFEST, FIX_OUTLINES } from '../test/fixtures'
import {
  areaFromBbox, areaFromDrawn, areaFromPoint, areaFromPolygon, areaFromRegion, checkSize, MAX_DRAWN_POINTS, parseCoordinate, regionIdsFor,
  validateBbox, validateDrawn, validatePoint,
} from './area'
import type { Outlines } from './data'
import type { Manifest } from './types'

const HERE = dirname(fileURLToPath(import.meta.url))
const realJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(HERE, '../../public/data/real', name), 'utf8')) as T

describe('typed and drawn areas', () => {
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
    expect(a.source).toBe('bbox')
    expect(a.regionIds).toBeUndefined()
  })
  it('builds a circle from a point and radius', () => {
    const a = areaFromPoint(51.5, -0.1, 50)
    expect(a.areaKm2).toBeGreaterThan(7_700) // pi * 50^2 = 7,854 (64-step polygon is slightly smaller)
    expect(a.areaKm2).toBeLessThan(7_900)
    expect(a.source).toBe('point')
    expect(validatePoint(51.5, -0.1, 0)).toMatch(/more than 0/)
    expect(validatePoint(51.5, -0.1, 2000)).toMatch(/1500 km/)
  })
  it('rejects areas over the size limit', () => {
    expect(checkSize(areaFromBbox([-180, -60, 180, 80]))).toMatch(/limit/)
  })
  it('rejects areas smaller than one fire cell (they used to get a confident verdict)', () => {
    expect(checkSize(areaFromBbox([14.2, 37.5, 14.2001, 37.5001]))).toMatch(/under 1 km².*fire cell/)
    expect(checkSize(areaFromPoint(37.5, 14.2, 2))).toMatch(/13 km², smaller than one 25 km² fire cell/)
    expect(checkSize(areaFromBbox([14, 37, 14.1, 37.1]))).toBeNull() // about 98 km²
    // A self-crossing (bow-tie) outline measures 0 km², so it is refused too.
    expect(validateDrawn(areaFromPolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] }))).toMatch(/fire cell/)
  })
  it('reads typed numbers with a decimal comma or a typographic minus', () => {
    expect(parseCoordinate('38,8')).toBe(38.8)
    expect(parseCoordinate(' -7,5 ')).toBe(-7.5)
    expect(parseCoordinate('\u22128.7')).toBe(-8.7)
    expect(parseCoordinate('41.3')).toBe(41.3)
    expect(parseCoordinate('')).toBeNaN()
    expect(parseCoordinate('1,234,5')).toBeNaN()
  })
  it('rounds drawn outlines to 4 decimals and thins long freehand outlines', () => {
    const a = areaFromDrawn({ type: 'Polygon', coordinates: [[[0.123456, 0], [1, 0], [1, 1], [0.123456, 0]]] }, 'freehand')
    expect(a.geometry.coordinates[0][0]).toEqual([0.1235, 0])
    expect(a.label).toBe('Drawn freehand area')
    const n = 2000
    const ring = Array.from({ length: n + 1 }, (_, k) => [Math.cos((2 * Math.PI * (k % n)) / n), Math.sin((2 * Math.PI * (k % n)) / n)])
    const big = areaFromDrawn({ type: 'Polygon', coordinates: [ring] }, 'freehand')
    const out = (big.geometry as GeoJSON.Polygon).coordinates[0]
    expect(out.length).toBe(MAX_DRAWN_POINTS)
    expect(out[0]).toEqual(out[out.length - 1])
  })
  it('applies the typed-coordinate rules to drawn shapes', () => {
    const ring = (lons: number[]) => areaFromPolygon({ type: 'Polygon', coordinates: [[[lons[0], 60], [lons[1], 60], [lons[1], 65], [lons[0], 65], [lons[0], 60]]] })
    expect(validateDrawn(ring([175, -175]))).toMatch(/180° line/) // wraps from +175 to -175
    expect(validateDrawn(ring([170, 190]))).toMatch(/180° line/) // longitudes past 180
    expect(validateDrawn(areaFromBbox([-60, -50, 60, 50]))).toMatch(/limit/)
    expect(validateDrawn(areaFromBbox([0, 0, 1, 1]))).toBeNull()
  })
  it('lets a MultiPolygon through validateDrawn (only regions have them, and regions are always valid)', () => {
    const a = areaFromRegion(FIX_MANIFEST, FIX_OUTLINES, 'ab')!
    expect(a.geometry.type).toBe('MultiPolygon')
    expect(validateDrawn(a)).toBeNull()
  })
})

describe('regionIdsFor', () => {
  it('maps a region id or a group id to region ids', () => {
    expect(regionIdsFor(FIX_MANIFEST, 'aa')).toEqual(['aa'])
    expect(regionIdsFor(FIX_MANIFEST, 'ab')).toEqual(['aa', 'bb'])
  })
  it('is null for anything else', () => {
    expect(regionIdsFor(FIX_MANIFEST, 'zz')).toBeNull()
    expect(regionIdsFor(FIX_MANIFEST, '')).toBeNull()
  })
})

describe('areaFromRegion', () => {
  it('describes a single region with its pipeline outline and area', () => {
    const a = areaFromRegion(FIX_MANIFEST, FIX_OUTLINES, 'aa')!
    expect(a).toMatchObject({ label: 'Region A', source: 'region', regionIds: ['aa'], regionKey: 'aa', bbox: [0, 0, 2, 2], areaKm2: 1000 })
    expect(a.geometry).toEqual(FIX_OUTLINES.features[0].geometry)
  })
  it('joins a group: union bbox, summed area, all outlines, group label', () => {
    const a = areaFromRegion(FIX_MANIFEST, FIX_OUTLINES, 'ab')!
    expect(a.label).toBe('A and B')
    expect(a.regionKey).toBe('ab')
    expect(a.regionIds).toEqual(['aa', 'bb'])
    expect(a.bbox).toEqual([0, 0, 12, 12])
    expect(a.areaKm2).toBe(1500)
    expect(a.geometry.type === 'MultiPolygon' && a.geometry.coordinates).toHaveLength(2)
  })
  it('falls back to the bounding box when the outlines are not loaded yet', () => {
    const a = areaFromRegion(FIX_MANIFEST, null, 'bb')!
    expect(a.geometry.type).toBe('Polygon')
    expect(a.bbox).toEqual([10, 10, 12, 12])
  })
  it('is null for an unknown key', () => {
    expect(areaFromRegion(FIX_MANIFEST, FIX_OUTLINES, 'nowhere')).toBeNull()
  })
  it('works on the real manifest and outlines: the Italy group is three regions', () => {
    const m = realJson<Manifest>('manifest.json')
    const outlines = realJson<Outlines>('outlines.json')
    const italy = areaFromRegion(m, outlines, 'italy')!
    expect(italy.regionIds).toEqual(['italy_mainland', 'sicily', 'sardinia'])
    expect(italy.label).toBe('All of Italy')
    expect(italy.areaKm2).toBe(251219 + 25730 + 24112)
    const box = (id: string) => m.regions.find((r) => r.id === id)!.bbox
    expect(italy.bbox[0]).toBe(box('italy_mainland')[0]) // mainland's west edge
    expect(italy.bbox[1]).toBe(box('sicily')[1]) // Sicily's south edge (its sea-margin cells included)
    const sardinia = areaFromRegion(m, outlines, 'sardinia')!
    expect(sardinia.geometry.type).toBe('MultiPolygon')
    expect(sardinia.regionKey).toBe('sardinia')
  })
})
