// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The clickable boxes around the globe. Each one opens its feature in the side drawer.
import type { ReactNode } from 'react'

export interface FeatureBox {
  id: string
  label: string
  icon: ReactNode
}

export interface FeatureRailProps {
  side: 'left' | 'right'
  label: string
  boxes: FeatureBox[]
  open: string | null
  onToggle: (id: string) => void
}

export function FeatureRail({ side, label, boxes, open, onToggle }: FeatureRailProps) {
  if (boxes.length === 0) return null
  return (
    <nav className={`rail rail-${side}`} aria-label={label}>
      {boxes.map((b) => (
        <button key={b.id} type="button" className="box" data-tour={`box-${b.id}`}
          aria-expanded={open === b.id} aria-controls={open === b.id ? 'drawer' : undefined}
          onClick={() => onToggle(b.id)}>
          {b.icon}
          <span>{b.label}</span>
        </button>
      ))}
    </nav>
  )
}
