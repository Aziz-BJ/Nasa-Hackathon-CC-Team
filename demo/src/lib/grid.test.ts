// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { cellCentre, cellId, cellRing, tilesForBbox } from './grid'

describe('grid', () => {
  it('matches the contract example (0.25 deg)', () => {
    // HANDOVER 7.2 example: lat 38.125, lon -1.875 -> "512_712"
    expect(cellId(38.125, -1.875, 0.25)).toBe('512_712')
    expect(cellCentre('512_712', 0.25)).toEqual({ lat: 38.125, lon: -1.875 })
  })
  it('clamps the north pole and the antimeridian into the last cell', () => {
    expect(cellId(90, 180, 1)).toBe('179_359')
  })
  it('builds a closed ring', () => {
    const ring = cellRing('90_180', 1)
    expect(ring[0]).toEqual([0, 0])
    expect(ring[2]).toEqual([1, 1])
    expect(ring[4]).toEqual(ring[0])
  })
  it('finds overlapping tiles without spilling over exact edges', () => {
    expect(tilesForBbox([0, 0, 10, 10], 10)).toEqual(['9_18'])
    expect(tilesForBbox([-5, -5, 5, 5], 10)).toEqual(['8_17', '8_18', '9_17', '9_18'])
  })
})
