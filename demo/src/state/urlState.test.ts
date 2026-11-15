// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromPolygon, areaFromPoint, areaFromRegion } from '../lib/area'
import type { Outlines } from '../lib/data'
import type { Manifest } from '../lib/types'
import { FIX_MANIFEST, FIX_OUTLINES } from '../test/fixtures'
import { initialState } from './appState'
import { applyUrl, parseHash, toHash } from './urlState'

const m = FIX_MANIFEST // 2019-01..2020-12, last complete month 2020-11, regions aa and bb, group ab
const base = initialState(m)
const HERE = dirname(fileURLToPath(import.meta.url))
const realJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(HERE, '../../public/data/real', name), 'utf8')) as T

describe('toHash and parseHash', () => {
  it('round-trips a region view', () => {
    const s = { ...base, area: areaFromRegion(m, FIX_OUTLINES, 'aa'), from: '2019-03', to: '2020-10' }
    const h = toHash(s)
    expect(h).toBe('#area=region:aa&from=2019-03&to=2020-10&src=harmonized')
    expect(parseHash(h)).toEqual({ regionKey: 'aa', from: '2019-03', to: '2020-10', source: 'harmonized' })
  })
  it('round-trips a group by its group id, not its regions', () => {
    const s = { ...base, area: areaFromRegion(m, FIX_OUTLINES, 'ab') }
    expect(toHash(s)).toContain('area=region:ab&')
    expect(parseHash(toHash(s)).regionKey).toBe('ab')
  })
  it('shares boxes as west, south, east, north, rounded to 4 decimals', () => {
    const s = { ...base, area: areaFromBbox([1.123456, 2, 3, 4]) }
    expect(toHash(s)).toContain('area=box:1.1235,2,3,4')
    expect(parseHash(toHash(s)).bbox).toEqual([1.1235, 2, 3, 4])
  })
  it('shares drawn shapes and circles as their bounding box', () => {
    const poly = areaFromPolygon({ type: 'Polygon', coordinates: [[[0, 0], [2, 0], [0, 3], [0, 0]]] })
    expect(parseHash(toHash({ ...base, area: poly })).bbox).toEqual([0, 0, 2, 3])
    const circle = areaFromPoint(40, 9, 10)
    const bbox = parseHash(toHash({ ...base, area: circle })).bbox!
    expect(bbox[0]).toBeLessThan(9)
    expect(bbox[2]).toBeGreaterThan(9)
  })
  it('leaves the area out when none is chosen, and keeps the source and the About view', () => {
    const h = toHash({ ...base, source: 'viirs_snpp', view: 'about' })
    expect(h).toBe('#from=2019-01&to=2020-11&src=viirs_snpp&view=about')
    expect(parseHash(h)).toMatchObject({ source: 'viirs_snpp', view: 'about' })
  })
  it('ignores junk', () => {
    expect(parseHash('#area=box:9,9,1,1&from=2020-13&src=nope&view=x')).toEqual({})
    expect(parseHash('')).toEqual({})
    expect(parseHash('#area=box:1,2,3&to=2020-1')).toEqual({})
    expect(parseHash('#area=planet:mars')).toEqual({})
  })
})

describe('applyUrl', () => {
  it('opens a region, drawn from the pipeline outline', () => {
    const s = applyUrl(m, FIX_OUTLINES, parseHash('#area=region:ab&from=2019-02&to=2020-06&src=modis'), base)
    expect(s.area?.regionIds).toEqual(['aa', 'bb'])
    expect(s.area?.geometry.type).toBe('MultiPolygon')
    expect([s.from, s.to, s.source]).toEqual(['2019-02', '2020-06', 'modis'])
  })
  it('opens a region before the outlines have loaded', () => {
    expect(applyUrl(m, null, { regionKey: 'aa' }, base).area?.regionKey).toBe('aa')
  })
  it('ignores a region the manifest does not have and keeps the current area', () => {
    expect(applyUrl(m, FIX_OUTLINES, { regionKey: 'atlantis' }, base).area).toBeNull()
    const current = areaFromRegion(m, FIX_OUTLINES, 'bb')
    expect(applyUrl(m, FIX_OUTLINES, { regionKey: 'atlantis' }, { ...base, area: current }).area).toBe(current)
  })
  it('opens a box, and a box wins over a region', () => {
    expect(applyUrl(m, FIX_OUTLINES, { bbox: [1, 2, 3, 4] }, base).area?.bbox).toEqual([1, 2, 3, 4])
    const both = applyUrl(m, FIX_OUTLINES, { bbox: [1, 2, 3, 4], regionKey: 'aa' }, base)
    expect(both.area?.source).toBe('bbox')
  })
  it('drops months outside the data and keeps the current ones instead', () => {
    const s = applyUrl(m, FIX_OUTLINES, parseHash('#from=2010-01&to=2030-12'), base)
    expect([s.from, s.to]).toEqual(['2019-01', '2020-11'])
    const late = applyUrl(m, FIX_OUTLINES, parseHash('#from=2019-05&to=2021-06'), base)
    expect([late.from, late.to]).toEqual(['2019-05', '2020-11'])
  })
  it('accepts the unfinished last month', () => {
    expect(applyUrl(m, FIX_OUTLINES, { to: '2020-12' }, base).to).toBe('2020-12')
  })
  it('puts a backwards range the right way round', () => {
    const s = applyUrl(m, FIX_OUTLINES, { from: '2020-06', to: '2019-03' }, base)
    expect([s.from, s.to]).toEqual(['2019-03', '2020-06'])
  })
  it('changes nothing for an empty link', () => {
    expect(applyUrl(m, FIX_OUTLINES, {}, base)).toEqual(base)
  })
  it('opens Sicily from the real manifest', () => {
    const real = realJson<Manifest>('manifest.json')
    const outlines = realJson<Outlines>('outlines.json')
    const s = applyUrl(real, outlines, parseHash('#area=region:sicily&from=2022-01&to=2026-10&src=harmonized'), initialState(real))
    expect(s.area?.label).toBe('Sicily')
    expect(s.area?.regionIds).toEqual(['sicily'])
    expect([s.from, s.to]).toEqual(['2022-01', '2026-10'])
    expect(toHash(s)).toBe('#area=region:sicily&from=2022-01&to=2026-10&src=harmonized')
  })
  it('clamps months to the real record (starts 2002-07, last month 2026-11)', () => {
    const real = realJson<Manifest>('manifest.json')
    const s = applyUrl(real, null, { from: '2002-06', to: '2026-12' }, initialState(real))
    expect([s.from, s.to]).toEqual(['2002-07', '2026-10'])
  })
})
