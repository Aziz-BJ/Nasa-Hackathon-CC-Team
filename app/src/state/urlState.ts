// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Shareable links: the whole view lives in the URL hash.
// Example: #area=region:sicily&from=2022-01&to=2026-10&src=harmonized
// Areas: region:<id> | box:<west>,<south>,<east>,<north> | point:<lat>,<lon>,<radius km>
//   | shape:<tool>:<lon>,<lat>;<lon>,<lat>;... (a drawn outline, exactly as drawn).
// Display options are written only when they differ from the defaults: pal, scale, map, labels.
// Links follow the same rules as the Area box: the 180° line and the size limits apply.
import type { Basemap } from '../components/GlobeMap'
import {
  areaFromBbox, areaFromDrawn, areaFromPoint, areaFromRegion, checkSize, DRAWN_KINDS, validateBbox, validateDrawn, validatePoint,
  type Area, type DrawnKind,
} from '../lib/area'
import { PALETTES, type PaletteId } from '../lib/colorScale'
import type { Outlines } from '../lib/data'
import type { Bbox } from '../lib/grid'
import type { YearMonth } from '../lib/months'
import { SERIES_KEYS, type Manifest, type SeriesKey } from '../lib/types'
import type { AppState, ScaleTo, View } from './appState'

/** Display options a link leaves out when they have these values. */
export const DISPLAY_DEFAULTS = { scaleTo: 'range' as ScaleTo, palette: 'inferno' as PaletteId, basemap: 'day' as Basemap, labels: true }

export interface UrlState {
  regionKey?: string
  bbox?: Bbox
  point?: [lat: number, lon: number, radiusKm: number]
  shape?: { kind: DrawnKind; ring: [number, number][] }
  from?: YearMonth
  to?: YearMonth
  source?: SeriesKey
  view?: View
  palette?: PaletteId
  scaleTo?: ScaleTo
  basemap?: Basemap
  labels?: boolean
  /** det=1: the native pixel detections layer is on. Like the display options, a link without it means off. */
  detections?: boolean
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/
/** Drawn outlines longer than this are not accepted from a link (drawn shapes are thinned to fewer points). */
const MAX_LINK_POINTS = 1000

/** Exactly n comma-separated finite numbers; an empty part is an error, not 0. */
function numbers(text: string, n: number): number[] | null {
  const parts = text.split(',')
  if (parts.length !== n || parts.some((p) => p.trim() === '')) return null
  const xs = parts.map(Number)
  return xs.every(Number.isFinite) ? xs : null
}

function parseShape(text: string): UrlState['shape'] | null {
  const at = text.indexOf(':')
  const kind = text.slice(0, at) as DrawnKind
  if (at < 0 || !DRAWN_KINDS.includes(kind)) return null
  const pairs = text.slice(at + 1).split(';')
  if (pairs.length < 3 || pairs.length > MAX_LINK_POINTS) return null
  const ring: [number, number][] = []
  for (const p of pairs) {
    const xy = numbers(p, 2)
    if (!xy || Math.abs(xy[0]) > 180 || Math.abs(xy[1]) > 90) return null
    ring.push([xy[0], xy[1]])
  }
  const [first, last] = [ring[0], ring[ring.length - 1]]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  return ring.length >= 4 ? { kind, ring } : null
}

export function parseHash(hash: string): UrlState {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const out: UrlState = {}
  const area = q.get('area') ?? ''
  if (area.startsWith('region:')) out.regionKey = area.slice(7)
  if (area.startsWith('box:')) {
    const box = numbers(area.slice(4), 4) as Bbox | null
    if (box && validateBbox(box) === null && checkSize(areaFromBbox(box)) === null) out.bbox = box
  }
  if (area.startsWith('point:')) {
    const p = numbers(area.slice(6), 3)
    if (p && validatePoint(p[0], p[1], p[2]) === null && checkSize(areaFromPoint(p[0], p[1], p[2])) === null) out.point = [p[0], p[1], p[2]]
  }
  if (area.startsWith('shape:')) {
    const shape = parseShape(area.slice(6))
    if (shape && validateDrawn(areaFromDrawn({ type: 'Polygon', coordinates: [shape.ring] }, shape.kind)) === null) out.shape = shape
  }
  const from = q.get('from')
  const to = q.get('to')
  if (from && YM.test(from)) out.from = from
  if (to && YM.test(to)) out.to = to
  const src = q.get('src')
  // An unknown src falls back to the harmonized record rather than keeping whatever was shown before.
  if (src) out.source = (SERIES_KEYS as readonly string[]).includes(src) ? src as SeriesKey : 'harmonized'
  if (q.get('view') === 'about') out.view = 'about'
  const pal = q.get('pal')
  if (pal && Object.hasOwn(PALETTES, pal)) out.palette = pal as PaletteId
  const scale = q.get('scale')
  if (scale === 'range' || scale === 'record') out.scaleTo = scale
  const map = q.get('map')
  if (map === 'day' || map === 'night') out.basemap = map
  const labels = q.get('labels')
  if (labels === '0' || labels === '1') out.labels = labels === '1'
  if (q.get('det') === '1') out.detections = true
  return out
}

/** True when a hash holds nothing a link can carry (e.g. "#main" from the skip link). */
export function isEmptyUrl(u: UrlState): boolean {
  return Object.keys(u).length === 0
}

// Six decimals (about 0.1 m) keep typed boxes exact. Drawn outlines are already rounded to 4 decimals when drawn.
const r6 = (x: number) => Math.round(x * 1e6) / 1e6

function areaParam(a: Area): string {
  if (a.regionKey) return `region:${a.regionKey}`
  if (a.point) return `point:${a.point.join(',')}`
  if (a.source === 'drawn' && a.geometry.type === 'Polygon') {
    return `shape:${a.kind ?? 'polygon'}:${a.geometry.coordinates[0].map(([x, y]) => `${r6(x)},${r6(y)}`).join(';')}`
  }
  return `box:${a.bbox.map(r6).join(',')}`
}

export function toHash(s: AppState): string {
  const q = new URLSearchParams()
  if (s.area) q.set('area', areaParam(s.area))
  q.set('from', s.from)
  q.set('to', s.to)
  q.set('src', s.source)
  if (s.view === 'about') q.set('view', 'about')
  if (s.palette !== DISPLAY_DEFAULTS.palette) q.set('pal', s.palette)
  if (s.scaleTo !== DISPLAY_DEFAULTS.scaleTo) q.set('scale', s.scaleTo)
  if (s.basemap !== DISPLAY_DEFAULTS.basemap) q.set('map', s.basemap)
  if (s.labels !== DISPLAY_DEFAULTS.labels) q.set('labels', s.labels ? '1' : '0')
  if (s.detections.show) q.set('det', '1')
  return '#' + q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%3B/g, ';')
}

function areaOf(m: Manifest, outlines: Outlines | null, u: UrlState): Area | null {
  if (u.shape) return areaFromDrawn({ type: 'Polygon', coordinates: [u.shape.ring] }, u.shape.kind)
  if (u.point) return areaFromPoint(...u.point)
  if (u.bbox) return areaFromBbox(u.bbox)
  return u.regionKey ? areaFromRegion(m, outlines, u.regionKey) : null
}

/**
 * Apply a link on top of a state. Area, months and source the link lacks (or that fall outside the data) stay as they are.
 * The view and display options are part of "this exact view": a link without them means the defaults, so a pasted link
 * also leaves the About page.
 */
export function applyUrl(m: Manifest, outlines: Outlines | null, u: UrlState, base: AppState): AppState {
  const area = areaOf(m, outlines, u) ?? base.area
  const inData = (ym?: YearMonth) => (ym && ym >= m.harmonized_coverage[0] && ym <= m.last_month ? ym : undefined)
  const from = inData(u.from) ?? base.from
  const to = inData(u.to) ?? base.to
  return {
    ...base, area,
    // A new area ends any drawing, as choosing one in the Area box does.
    tool: area !== base.area ? 'pan' : base.tool,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    source: u.source ?? base.source,
    view: u.view ?? 'explore',
    palette: u.palette ?? DISPLAY_DEFAULTS.palette,
    scaleTo: u.scaleTo ?? DISPLAY_DEFAULTS.scaleTo,
    basemap: u.basemap ?? DISPLAY_DEFAULTS.basemap,
    labels: u.labels ?? DISPLAY_DEFAULTS.labels,
    // The layer follows the link (off without det=1); the satellite choices stay as they were.
    detections: { ...base.detections, show: u.detections === true },
  }
}
