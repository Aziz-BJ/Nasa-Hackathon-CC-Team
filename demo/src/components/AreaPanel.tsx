// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { Circle, Hand, Polygon, Scribble, Square } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { areaFromPreset, type Area } from '../lib/area'
import type { Preset } from '../lib/types'
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
  pan: 'Drag to turn the globe, scroll to zoom.',
  circle: 'Click the centre, then click again (or drag) to set the size.',
  rectangle: 'Click one corner, then the opposite corner (or drag).',
  polygon: 'Click each corner. Click the first point again to finish.',
  freehand: 'Click, move to draw around the area, click again to finish.',
}

export interface AreaPanelProps {
  presets: Preset[]
  area: Area | null
  tool: DrawTool
  onTool: (t: DrawTool) => void
  onArea: (a: Area) => void
  /** Why the last drawn shape was rejected, if it was. */
  error?: string | null
}

export function AreaPanel({ presets, area, tool, onTool, onArea, error }: AreaPanelProps) {
  const presetValue = area?.source === 'preset' ? area.presetId ?? '' : ''
  return (
    <div>
      <label>
        Preset region
        <select value={presetValue} onChange={(e) => {
          const p = presets.find((x) => x.id === e.target.value)
          if (p) onArea(areaFromPreset(p))
        }}>
          <option value="">Choose a region…</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <p className="small" style={{ marginTop: '0.75rem' }}>Or draw on the globe:</p>
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
