// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromDrawn, areaFromPolygon, areaFromPoint, areaFromRegion } from '../lib/area'
import type { Outlines } from '../lib/data'
import type { Manifest } from '../lib/types'
import { FIX_MANIFEST, FIX_OUTLINES } from '../test/fixtures'
import { initialState } from './appState'
import { applyUrl, isEmptyUrl, parseHash, toHash } from './urlState'

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
  it('shares boxes as west, south, east, north, to 6 decimals', () => {
    const s = { ...base, area: areaFromBbox([1.1234567, 2, 3, 4]) }
    expect(toHash(s)).toContain('area=box:1.123457,2,3,4')
    expect(parseHash(toHash(s)).bbox).toEqual([1.123457, 2, 3, 4])
  })
  it('shares a drawn shape exactly, so it reopens with the same outline and area', () => {
    const drawn = areaFromDrawn({ type: 'Polygon', coordinates: [[[0, 0], [2.123456, 0], [0, 3], [0, 0]]] }, 'polygon')
    const h = toHash({ ...base, area: drawn })
    expect(h).toContain('area=shape:polygon:0,0;2.1235,0;0,3;0,0&')
    const back = applyUrl(m, FIX_OUTLINES, parseHash(h), base).area!
    expect(back.geometry).toEqual(drawn.geometry)
    expect(back.areaKm2).toBe(drawn.areaKm2)
    expect(back.label).toBe('Drawn polygon')
  })
  it('shares a drawn circle exactly (it used to reopen as its bounding box)', () => {
    const ring = Array.from({ length: 65 }, (_, k) => {
      const t = (2 * Math.PI * (k % 64)) / 64
      return [14 + 0.3 * Math.cos(t), 37.5 + 0.2 * Math.sin(t)]
    })
    const circle = areaFromDrawn({ type: 'Polygon', coordinates: [ring] }, 'circle')
    const back = applyUrl(m, FIX_OUTLINES, parseHash(toHash({ ...base, area: circle })), base).area!
    expect(back.geometry).toEqual(circle.geometry)
    expect(back.label).toBe('Drawn circle')
  })
  it('shares a typed point and radius exactly', () => {
    const p = areaFromPoint(40, 9, 10)
    const h = toHash({ ...base, area: p })
    expect(h).toContain('area=point:40,9,10&')
    expect(applyUrl(m, FIX_OUTLINES, parseHash(h), base).area?.geometry).toEqual(p.geometry)
  })
  it('keeps polygons drawn before this version (no tool) as polygons', () => {
    const poly = areaFromPolygon({ type: 'Polygon', coordinates: [[[0, 0], [2, 0], [0, 3], [0, 0]]] })
    expect(parseHash(toHash({ ...base, area: poly })).shape?.kind).toBe('polygon')
  })
  it('carries colours, imagery, labels and scale only when they differ from the defaults', () => {
    const s = { ...base, palette: 'cividis' as const, scaleTo: 'record' as const, basemap: 'night' as const, labels: false }
    const h = toHash(s)
    expect(h).toContain('&pal=cividis&scale=record&map=night&labels=0')
    expect(applyUrl(m, FIX_OUTLINES, parseHash(h), base)).toMatchObject({ palette: 'cividis', scaleTo: 'record', basemap: 'night', labels: false })
    expect(toHash(base)).not.toMatch(/pal=|scale=|map=|labels=/)
  })
  it('leaves the area out when none is chosen, and keeps the source and the About view', () => {
    const h = toHash({ ...base, source: 'viirs_snpp', view: 'about' })
    expect(h).toBe('#from=2019-01&to=2020-11&src=viirs_snpp&view=about')
    expect(parseHash(h)).toMatchObject({ source: 'viirs_snpp', view: 'about' })
  })
  it('keeps the detections layer in the link only when it is on', () => {
    const on = { ...base, detections: { ...base.detections, show: true } }
    expect(toHash(on)).toMatch(/&det=1$/)
    expect(toHash(base)).not.toMatch(/det=/)
    expect(parseHash(toHash(on)).detections).toBe(true)
    expect(applyUrl(m, FIX_OUTLINES, { detections: true }, base).detections.show).toBe(true)
    // Like the display options, a link without det=1 means the layer is off: pasting a link made with it off turns it
    // off, and keeps the satellite choices.
    const pasted = applyUrl(m, FIX_OUTLINES, parseHash(toHash(base)), { ...on, detections: { ...on.detections, aqua: false } })
    expect(pasted.detections).toEqual({ ...on.detections, show: false, aqua: false })
    expect(applyUrl(m, FIX_OUTLINES, {}, on).detections.show).toBe(false)
  })
  it('ignores junk', () => {
    // An unknown src goes back to the harmonized record instead of keeping the previous view.
    expect(parseHash('#area=box:9,9,1,1&from=2020-13&src=nope&view=x')).toEqual({ source: 'harmonized' })
    expect(parseHash('')).toEqual({})
    expect(parseHash('#area=box:1,2,3&to=2020-1')).toEqual({})
    expect(parseHash('#area=planet:mars')).toEqual({})
    expect(parseHash('#pal=rainbow&scale=x&map=mars&labels=yes')).toEqual({})
    expect(parseHash('#area=shape:hexagon:0,0;1,0;0,1;0,0')).toEqual({})
    expect(parseHash('#area=shape:polygon:0,0;1,0')).toEqual({})
    expect(parseHash('#area=point:40,9,0')).toEqual({})
  })
  it('applies the Area box rules to links: no missing numbers, no shapes over the size limit or smaller than a cell', () => {
    expect(parseHash('#area=box:1,,3,4')).toEqual({}) // the empty number used to read as 0
    expect(parseHash('#area=box:-180,-90,180,90')).toEqual({}) // over 10 million km²
    expect(parseHash('#area=box:14.2,37.5,14.2001,37.5001')).toEqual({}) // 10 m across
    expect(parseHash('#area=shape:polygon:170,60;190,60;190,65;170,60')).toEqual({}) // past the 180° line
    expect(parseHash('#area=box:13,37.3,15.5,38.3').bbox).toEqual([13, 37.3, 15.5, 38.3])
  })
  it('counts a hash with nothing a link carries as empty (the skip link\'s #main)', () => {
    expect(isEmptyUrl(parseHash('#main'))).toBe(true)
    expect(isEmptyUrl(parseHash('#from=2019-03'))).toBe(false)
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
  it('leaves the About page when a link without it is pasted (it used to stay on About)', () => {
    const about = { ...base, view: 'about' as const }
    expect(applyUrl(m, FIX_OUTLINES, parseHash('#area=region:aa&from=2019-03&to=2020-10&src=modis'), about).view).toBe('explore')
    expect(applyUrl(m, FIX_OUTLINES, parseHash('#view=about'), base).view).toBe('about')
  })
  it('ends any drawing when a link opens a new area', () => {
    const drawing = { ...base, tool: 'polygon' as const }
    expect(applyUrl(m, FIX_OUTLINES, { regionKey: 'aa' }, drawing).tool).toBe('pan')
    expect(applyUrl(m, FIX_OUTLINES, { from: '2019-03' }, drawing).tool).toBe('polygon')
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
