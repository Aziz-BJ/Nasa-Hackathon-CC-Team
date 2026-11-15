// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { Basemap, DrawTool } from '../components/GlobeMap'
import type { Area } from '../lib/area'
import type { PaletteId } from '../lib/colorScale'
import { addMonths, type YearMonth } from '../lib/months'
import type { Manifest, SeriesKey } from '../lib/types'
import { applyUrl, type UrlState } from './urlState'

export type ScaleTo = 'range' | 'record'
export type View = 'explore' | 'about'

export interface AppState {
  area: Area | null
  from: YearMonth
  to: YearMonth
  source: SeriesKey
  scaleTo: ScaleTo
  palette: PaletteId
  tool: DrawTool
  basemap: Basemap
  labels: boolean
  view: View
}

export type Action =
  | { type: 'setArea'; area: Area | null }
  | { type: 'setRange'; from: YearMonth; to: YearMonth }
  | { type: 'setSource'; source: SeriesKey }
  | { type: 'setScaleTo'; scaleTo: ScaleTo }
  | { type: 'setPalette'; palette: PaletteId }
  | { type: 'setTool'; tool: DrawTool }
  | { type: 'setBasemap'; basemap: Basemap }
  | { type: 'setLabels'; labels: boolean }
  | { type: 'setView'; view: View }
  | { type: 'applyUrl'; manifest: Manifest; url: UrlState }

/** The latest finished month. A month-to-date total is not comparable with full months, so we don't default to it. */
export function lastComplete(m: Manifest): YearMonth {
  return m.month_to_date ? addMonths(m.last_month, -1) : m.last_month
}

export function initialState(m: Manifest): AppState {
  return {
    area: null,
    from: m.harmonized_coverage[0],
    to: lastComplete(m),
    source: 'harmonized',
    scaleTo: 'range',
    palette: 'inferno',
    tool: 'pan',
    basemap: 'day',
    labels: true,
    view: 'explore',
  }
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setArea': return { ...s, area: a.area, tool: 'pan' }
    case 'setRange': return a.from <= a.to ? { ...s, from: a.from, to: a.to } : { ...s, from: a.to, to: a.from }
    case 'setSource': return { ...s, source: a.source }
    case 'setScaleTo': return { ...s, scaleTo: a.scaleTo }
    case 'setPalette': return { ...s, palette: a.palette }
    case 'setTool': return { ...s, tool: a.tool }
    case 'setBasemap': return { ...s, basemap: a.basemap }
    case 'setLabels': return { ...s, labels: a.labels }
    case 'setView': return { ...s, view: a.view }
    case 'applyUrl': return applyUrl(a.manifest, a.url, s)
  }
}
