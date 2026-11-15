// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Shareable links: area, months and data source live in the URL hash.
// Example: #area=region:sicily&from=2022-01&to=2026-10&src=harmonized
// Drawn and point areas are shared as their bounding box.
import { areaFromBbox, areaFromRegion, validateBbox } from '../lib/area'
import type { Outlines } from '../lib/data'
import type { Bbox } from '../lib/grid'
import type { YearMonth } from '../lib/months'
import { SERIES_KEYS, type Manifest, type SeriesKey } from '../lib/types'
import type { AppState, View } from './appState'

export interface UrlState {
  regionKey?: string
  bbox?: Bbox
  from?: YearMonth
  to?: YearMonth
  source?: SeriesKey
  view?: View
  /** det=1: the native pixel detections layer is on. */
  detections?: boolean
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/

export function parseHash(hash: string): UrlState {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const out: UrlState = {}
  const area = q.get('area') ?? ''
  if (area.startsWith('region:')) out.regionKey = area.slice(7)
  if (area.startsWith('box:')) {
    const box = area.slice(4).split(',').map(Number) as Bbox
    if (box.length === 4 && validateBbox(box) === null) out.bbox = box
  }
  const from = q.get('from')
  const to = q.get('to')
  if (from && YM.test(from)) out.from = from
  if (to && YM.test(to)) out.to = to
  const src = q.get('src')
  // An unknown src falls back to the harmonized record rather than keeping whatever was shown before.
  if (src) out.source = (SERIES_KEYS as readonly string[]).includes(src) ? src as SeriesKey : 'harmonized'
  if (q.get('view') === 'about') out.view = 'about'
  if (q.get('det') === '1') out.detections = true
  return out
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4

export function toHash(s: AppState): string {
  const q = new URLSearchParams()
  if (s.area?.regionKey) q.set('area', `region:${s.area.regionKey}`)
  else if (s.area) q.set('area', `box:${s.area.bbox.map(r4).join(',')}`)
  q.set('from', s.from)
  q.set('to', s.to)
  q.set('src', s.source)
  if (s.view === 'about') q.set('view', 'about')
  if (s.detections.show) q.set('det', '1')
  return '#' + q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',')
}

/** Apply what the URL asks for on top of a state, ignoring anything outside the data. */
export function applyUrl(m: Manifest, outlines: Outlines | null, u: UrlState, base: AppState): AppState {
  const region = u.regionKey ? areaFromRegion(m, outlines, u.regionKey) : null
  const area = u.bbox ? areaFromBbox(u.bbox) : region ?? base.area
  const inData = (ym?: YearMonth) => (ym && ym >= m.harmonized_coverage[0] && ym <= m.last_month ? ym : undefined)
  const from = inData(u.from) ?? base.from
  const to = inData(u.to) ?? base.to
  return {
    ...base, area,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    source: u.source ?? base.source,
    view: u.view ?? base.view,
    detections: u.detections ? { ...base.detections, show: true } : base.detections,
  }
}
