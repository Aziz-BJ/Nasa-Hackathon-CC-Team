// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { PALETTES, type PaletteId } from '../lib/colorScale'
import { DETECTION_SATELLITES, type DetectionsState } from '../lib/detections'
import { SERIES_KEYS, SERIES_LABELS, type SeriesKey } from '../lib/types'
import type { ScaleTo } from '../state/appState'
import type { Basemap } from './GlobeMap'

export interface DisplayOptionsProps {
  source: SeriesKey
  scaleTo: ScaleTo
  palette: PaletteId
  basemap: Basemap
  labels: boolean
  detections: DetectionsState
  /** false while the detections index is missing (the layer is optional). */
  detectionsAvailable: boolean
  onSource: (s: SeriesKey) => void
  onScaleTo: (s: ScaleTo) => void
  onPalette: (p: PaletteId) => void
  onBasemap: (b: Basemap) => void
  onLabels: (l: boolean) => void
  onDetections: (d: DetectionsState) => void
}

export function DisplayOptions(p: DisplayOptionsProps) {
  const d = p.detections
  return (
    <div>
      <fieldset>
        <legend className="small">Data</legend>
        {SERIES_KEYS.map((k) => (
          <label key={k}>
            <input type="radio" name="source" checked={p.source === k} onChange={() => p.onSource(k)} /> {SERIES_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="small">Detections at native pixel size</legend>
        <label>
          <input type="checkbox" checked={d.show} disabled={!p.detectionsAvailable}
            onChange={(e) => p.onDetections({ ...d, show: e.target.checked })} /> Show every detection at its real pixel size
        </label>
        {DETECTION_SATELLITES.map((sat) => (
          <label key={sat.key} className="indent">
            <input type="checkbox" checked={d[sat.key]} disabled={!d.show}
              onChange={(e) => p.onDetections({ ...d, [sat.key]: e.target.checked })} />{' '}
            <span className="dot" style={{ background: sat.color }} aria-hidden /> {sat.label}
          </label>
        ))}
        <p className="small muted">
          {p.detectionsAvailable
            ? 'Raw detections, not harmonized: VIIRS sees many more, smaller fires, so counts are not comparable. Each dot is a pixel centre, sized like the pixel when zoomed in.'
            : 'Detections are not available in this build.'}
        </p>
      </fieldset>
      <fieldset>
        <legend className="small">Calendar colours scaled to</legend>
        <label><input type="radio" name="scale" checked={p.scaleTo === 'range'} onChange={() => p.onScaleTo('range')} /> The months I chose</label>
        <label><input type="radio" name="scale" checked={p.scaleTo === 'record'} onChange={() => p.onScaleTo('record')} /> The whole record</label>
      </fieldset>
      <label>
        Colour ramp
        <select value={p.palette} onChange={(e) => p.onPalette(e.target.value as PaletteId)}>
          {(Object.keys(PALETTES) as PaletteId[]).map((id) => <option key={id} value={id}>{PALETTES[id].label}</option>)}
        </select>
      </label>
      <label>
        Globe imagery
        <select value={p.basemap} onChange={(e) => p.onBasemap(e.target.value as Basemap)}>
          <option value="day">Blue Marble (day)</option>
          <option value="night">Black Marble (night lights)</option>
        </select>
      </label>
      <label><input type="checkbox" checked={p.labels} onChange={(e) => p.onLabels(e.target.checked)} /> Borders and place names</label>
    </div>
  )
}
