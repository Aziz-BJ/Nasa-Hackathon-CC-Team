// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { Area } from '../lib/area'
import type { AreaData } from '../hooks/useAreaData'
import type { Manifest } from '../lib/types'

export function AreaSummary({ area, data, manifest: m }: { area: Area | null; data: AreaData; manifest: Manifest }) {
  if (!area) return <p className="muted">No area chosen yet. Choose a region, draw on the globe, or type coordinates.</p>
  const km2 = Math.round(area.areaKm2).toLocaleString('en-GB')
  const names = m.regions.map((r) => r.name)
  const regionList = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  const cells = data.selection ? `${data.selection.cells.length.toLocaleString('en-GB')} ${m.cell_km} km cells with fire detections.` : ''
  return (
    <div aria-live="polite">
      <p><strong>{area.label}</strong>: {km2} km². {cells}</p>
      {area.regionIds
        ? <p className="small muted">Numbers come straight from the harmonized record{data.series?.bandSummed ? ', added over the regions' : ''}, with their 90% range.</p>
        : data.coverage !== 'none' && <p className="small muted">Numbers add up the {m.cell_km} km cells whose centre is inside your shape. The harmonized line is an estimate: the region's conversion applied to part of it, without a 90% range. Raw sensor counts are exact.</p>}
      {data.status === 'loading' && <p className="muted">Loading the fire cells…</p>}
      {data.status === 'error' && <p className="error">Could not load data: {data.error}</p>}
      {data.coverage === 'none' && <p className="notice">No data here. The harmonized record covers {regionList}. This is not the same as "no fires".</p>}
      {data.coverage === 'partial' && <p className="notice">Part of this shape is outside the study regions ({regionList}; at sea, only within 3 nautical miles of the Italian coast). Only fire cells inside the regions are counted.</p>}
    </div>
  )
}
