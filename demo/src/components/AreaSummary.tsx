// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { Area } from '../lib/area'
import type { AreaData } from '../hooks/useAreaData'

export function AreaSummary({ area, data, gridDeg }: { area: Area | null; data: AreaData; gridDeg: number }) {
  if (!area) return <p className="muted">No area chosen yet. Pick a preset, draw on the globe, or type coordinates.</p>
  const km2 = Math.round(area.areaKm2).toLocaleString('en-GB')
  return (
    <div aria-live="polite">
      <p><strong>{area.label}</strong>: {km2} km². {data.selection ? `${data.selection.cells.length} grid cells with detections (${gridDeg}° cells, counted when the cell centre is inside the area).` : ''}</p>
      {data.status === 'loading' && <p className="muted">Loading data for this area…</p>}
      {data.status === 'error' && <p className="error">Could not load data: {data.error}</p>}
      {data.coverage === 'none' && <p className="notice">No data is loaded for this area yet. This is not the same as "no fires".</p>}
      {data.coverage === 'partial' && <p className="notice">Part of this area is outside the loaded data, so totals may be too low.</p>}
      {data.selection?.fallback && <p className="notice">No {gridDeg}° grid-cell centre lies inside this area, so we show the cell that contains its centre.</p>}
    </div>
  )
}
