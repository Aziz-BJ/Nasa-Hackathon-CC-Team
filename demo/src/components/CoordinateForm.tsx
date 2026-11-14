// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The keyboard route to choosing an area. Drawing on the globe is never the only way.
import { useState, type FormEvent } from 'react'
import { areaFromBbox, areaFromPoint, checkSize, validateBbox, validatePoint, type Area } from '../lib/area'
import type { Bbox } from '../lib/grid'

type Mode = 'bbox' | 'point'
const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export function CoordinateForm({ onArea }: { onArea: (a: Area) => void }) {
  const [mode, setMode] = useState<Mode>('bbox')
  const [v, setV] = useState({ w: '', s: '', e: '', n: '', lat: '', lon: '', r: '50' })
  const [error, setError] = useState<string | null>(null)
  const field = (k: keyof typeof v, label: string, hint: string) => (
    <label>
      {label}
      <input type="text" inputMode="decimal" value={v[k]} aria-describedby="coord-hint"
        onChange={(ev) => setV({ ...v, [k]: ev.target.value })} placeholder={hint} />
    </label>
  )

  function submit(ev: FormEvent) {
    ev.preventDefault()
    let err: string | null
    let area: Area | null = null
    if (mode === 'bbox') {
      const box: Bbox = [num(v.w), num(v.s), num(v.e), num(v.n)]
      err = validateBbox(box)
      if (!err) area = areaFromBbox(box)
    } else {
      const [lat, lon, r] = [num(v.lat), num(v.lon), num(v.r)]
      err = validatePoint(lat, lon, r)
      if (!err) area = areaFromPoint(lat, lon, r)
    }
    if (!err && area) err = checkSize(area)
    setError(err)
    if (!err && area) onArea(area)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Enter coordinates">
      <fieldset>
        <legend className="small">Coordinate type</legend>
        <label><input type="radio" name="coord-mode" checked={mode === 'bbox'} onChange={() => setMode('bbox')} /> Box</label>
        <label><input type="radio" name="coord-mode" checked={mode === 'point'} onChange={() => setMode('point')} /> Point + radius</label>
      </fieldset>
      <p id="coord-hint" className="small muted">Decimal degrees. Latitude −90 to 90, longitude −180 to 180.</p>
      {mode === 'bbox' ? (
        <div className="row">
          {field('w', 'West', '-8.7')}{field('s', 'South', '49.8')}{field('e', 'East', '1.8')}{field('n', 'North', '60.9')}
        </div>
      ) : (
        <div className="row">
          {field('lat', 'Latitude', '51.5')}{field('lon', 'Longitude', '-0.1')}{field('r', 'Radius (km)', '50')}
        </div>
      )}
      <p className="error" role="alert">{error ?? ''}</p>
      <button type="submit" className="btn">Use these coordinates</button>
    </form>
  )
}
