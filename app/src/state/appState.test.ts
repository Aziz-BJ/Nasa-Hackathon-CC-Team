// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromRegion } from '../lib/area'
import { FIX_MANIFEST, FIX_OUTLINES } from '../test/fixtures'
import { initialState, lastComplete, reducer } from './appState'

const m = FIX_MANIFEST // 2019-01..2020-12, 2020-12 is a month to date

describe('appState', () => {
  it('starts on the whole record up to the last complete month, harmonized, with nothing selected', () => {
    const s = initialState(m)
    expect([s.from, s.to, s.source, s.area]).toEqual(['2019-01', '2020-11', 'harmonized', null])
    expect(initialState({ ...m, month_to_date: false }).to).toBe('2020-12')
  })
  it('knows the last complete month, also across a year end', () => {
    expect(lastComplete(m)).toBe('2020-11')
    expect(lastComplete({ ...m, last_month: '2021-01' })).toBe('2020-12')
    expect(lastComplete({ ...m, month_to_date: false })).toBe('2020-12')
  })
  it('swaps a backwards range instead of failing', () => {
    const s = reducer(initialState(m), { type: 'setRange', from: '2020-05', to: '2019-01' })
    expect([s.from, s.to]).toEqual(['2019-01', '2020-05'])
  })
  it('turns drawing off when an area is chosen', () => {
    const drawing = reducer(initialState(m), { type: 'setTool', tool: 'circle' })
    expect(drawing.tool).toBe('circle')
    expect(reducer(drawing, { type: 'setArea', area: null }).tool).toBe('pan')
  })
  it('sets the other options one at a time', () => {
    const s0 = initialState(m)
    expect(reducer(s0, { type: 'setSource', source: 'modis' }).source).toBe('modis')
    expect(reducer(s0, { type: 'setScaleTo', scaleTo: 'record' }).scaleTo).toBe('record')
    expect(reducer(s0, { type: 'setPalette', palette: 'cividis' }).palette).toBe('cividis')
    expect(reducer(s0, { type: 'setBasemap', basemap: 'night' }).basemap).toBe('night')
    expect(reducer(s0, { type: 'setLabels', labels: false }).labels).toBe(false)
    expect(reducer(s0, { type: 'setView', view: 'about' }).view).toBe('about')
    expect(s0.detections.show).toBe(false)
    const det = { show: true, aqua: false, snpp: true, noaa20: true }
    expect(reducer(s0, { type: 'setDetections', detections: det }).detections).toEqual(det)
  })
  it('opens a region from a link, then a box, and ignores an unknown region', () => {
    const s0 = initialState(m)
    const region = reducer(s0, { type: 'applyUrl', manifest: m, outlines: FIX_OUTLINES, url: { regionKey: 'bb', from: '2019-06' } })
    expect(region.area?.regionIds).toEqual(['bb'])
    expect(region.from).toBe('2019-06')
    const box = reducer(region, { type: 'applyUrl', manifest: m, outlines: FIX_OUTLINES, url: { bbox: [1, 1, 2, 2] } })
    expect(box.area?.bbox).toEqual([1, 1, 2, 2])
    const unknown = reducer(box, { type: 'applyUrl', manifest: m, outlines: FIX_OUTLINES, url: { regionKey: 'nope' } })
    expect(unknown.area).toBe(box.area)
  })
  it('keeps the chosen area object when only the range changes', () => {
    const area = areaFromRegion(m, FIX_OUTLINES, 'aa')
    const s = reducer({ ...initialState(m), area }, { type: 'setRange', from: '2019-02', to: '2019-09' })
    expect(s.area).toBe(area)
    expect(reducer(s, { type: 'setArea', area: areaFromBbox([0, 0, 1, 1]) }).area?.source).toBe('bbox')
  })
})
