// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromPreset } from '../lib/area'
import type { Manifest } from '../lib/types'
import { initialState } from './appState'
import { applyUrl, parseHash, toHash } from './urlState'

const m = {
  harmonized_coverage: ['2000-11', '2026-11'], last_month: '2026-11', month_to_date: true,
  presets: [{ id: 'uk', name: 'UK', bbox: [-8, 50, 2, 59] }],
} as unknown as Manifest

describe('urlState', () => {
  it('round-trips a preset view', () => {
    const s = { ...initialState(m), area: areaFromPreset({ id: 'uk', name: 'UK', bbox: [-8, 50, 2, 59] }), from: '2022-01', to: '2026-10' }
    const h = toHash(s)
    expect(h).toBe('#area=preset:uk&from=2022-01&to=2026-10&src=harmonized')
    expect(parseHash(h)).toEqual({ presetId: 'uk', from: '2022-01', to: '2026-10', source: 'harmonized' })
  })
  it('shares other areas as a box', () => {
    const s = { ...initialState(m), area: areaFromBbox([1.123456, 2, 3, 4]) }
    expect(parseHash(toHash(s)).bbox).toEqual([1.1235, 2, 3, 4])
  })
  it('ignores junk', () => {
    expect(parseHash('#area=box:9,9,1,1&from=2020-13&src=nope&view=x')).toEqual({})
  })
  it('applies a link on top of the current state and drops months outside the data', () => {
    const s = applyUrl(m, parseHash('#area=preset:uk&from=1990-01&to=2024-12&src=modis'), initialState(m))
    expect(s.area?.presetId).toBe('uk')
    expect([s.from, s.to, s.source]).toEqual(['2000-11', '2024-12', 'modis'])
  })
})
