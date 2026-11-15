// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { Circle, Hand, Polygon, Scribble, Square } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { Area } from '../lib/area'
import type { Manifest } from '../lib/types'
import { CoordinateForm } from './CoordinateForm'
import type { DrawTool } from './GlobeMap'

const TOOLS: { tool: DrawTool; label: string; icon: ReactNode }[] = [
  { tool: 'pan', label: 'Move globe', icon: <Hand aria-hidden /> },
  { tool: 'circle', label: 'Circle', icon: <Circle aria-hidden /> },
  { tool: 'rectangle', label: 'Rectangle', icon: <Square aria-hidden /> },
  { tool: 'polygon', label: 'Polygon', icon: <Polygon aria-hidden /> },
  { tool: 'freehand', label: 'Freehand', icon: <Scribble aria-hidden /> },
]

const HELP: Record<DrawTool, string> = {
  pan: 'Drag to turn the globe, scroll to zoom. Click a region to choose it.',
  circle: 'Click the centre, then click again (or drag) to set the size.',
  rectangle: 'Click one corner, then the opposite corner (or drag).',
  polygon: 'Click each corner. Click the first point again to finish.',
  freehand: 'Click, move to draw around the area, click again to finish.',
}

export interface AreaPanelProps {
  manifest: Manifest
  area: Area | null
  tool: DrawTool
  onTool: (t: DrawTool) => void
  onRegion: (key: string) => void
  onArea: (a: Area) => void
  /** Why the last drawn shape was rejected, if it was. */
  error?: string | null
}

export function AreaPanel({ manifest: m, area, tool, onTool, onRegion, onArea, error }: AreaPanelProps) {
  const choices = [...m.regions.map((r) => ({ key: r.id, name: r.name, km2: r.area_km2 })),
    ...m.groups.map((g) => ({ key: g.id, name: g.name, km2: m.regions.filter((r) => g.regions.includes(r.id)).reduce((a, r) => a + r.area_km2, 0) }))]
  return (
    <div>
      <p className="small" id="region-help">The harmonized record covers these regions. Choose one:</p>
      <div className="region-list" role="group" aria-labelledby="region-help">
        {choices.map((c) => (
          <button key={c.key} type="button" className="btn region-choice" aria-pressed={area?.regionKey === c.key} onClick={() => onRegion(c.key)}>
            <span>{c.name}</span><span className="small muted">{Math.round(c.km2).toLocaleString('en-GB')} km²</span>
          </button>
        ))}
      </div>
      <p className="small" style={{ marginTop: '1rem' }}>Or draw a shape inside a region (the globe shows its {m.cell_km} km fire cells):</p>
      <div className="tools" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((t) => (
          <button key={t.tool} type="button" className="btn" aria-pressed={tool === t.tool} onClick={() => onTool(t.tool)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <p className="small muted" aria-live="polite">{HELP[tool]}</p>
      {error && <p className="error small" role="alert">{error}</p>}
      <details>
        <summary>Or type coordinates</summary>
        <CoordinateForm onArea={onArea} />
      </details>
    </div>
  )
}
