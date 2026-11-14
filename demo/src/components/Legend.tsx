// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fmtCount, NO_DATA_FILL, ZERO_FILL, type CountScale } from '../lib/colorScale'

const HATCH = `repeating-linear-gradient(45deg, ${NO_DATA_FILL} 0 3px, #26262b 3px 6px)`

/** Short tick labels for a narrow ramp: 950, 5.9k, 17k, 1.2M. Full values stay in the screen-reader text. */
export function shortCount(v: number): string {
  if (v < 1000) return fmtCount(v)
  if (v < 1e6) return `${v < 1e4 ? (Math.round(v / 100) / 10).toString() : Math.round(v / 1000)}k`
  return `${Math.round(v / 1e5) / 10}M`
}

/** A ramp of swatches with the lower edge of each bin printed under it (for the bottom strip). */
export function CompactLegend({ scale, title }: { scale: CountScale; title: string }) {
  return (
    <div className="legend-compact">
      <div className="small">{title}</div>
      <ul aria-label={title}>
        <li><span className="swatch" style={{ background: HATCH }} /><span className="tick">none</span><span className="sr-only">No sensor or not yet</span></li>
        <li><span className="swatch" style={{ background: ZERO_FILL }} /><span className="tick">0</span></li>
        {scale.colors.map((c, i) => (
          <li key={c + i}><span className="swatch" style={{ background: c }} /><span className="tick" aria-hidden>{shortCount(scale.edges[i])}</span><span className="sr-only">{scale.labels[i]}</span></li>
        ))}
      </ul>
    </div>
  )
}

export function Legend({ scale, title, id, showNrt = false }: { scale: CountScale; title: string; id?: string; showNrt?: boolean }) {
  return (
    <div className="legend" id={id} aria-label={title}>
      <strong>{title}</strong>
      <span><span className="swatch" style={{ background: HATCH }} />No sensor / not yet</span>
      <span><span className="swatch" style={{ background: ZERO_FILL }} />0</span>
      {scale.colors.map((c, i) => (
        <span key={c + i}><span className="swatch" style={{ background: c }} />{scale.labels[i]}</span>
      ))}
      {showNrt && <>
        <span><span className="swatch" style={{ border: '1.5px dotted #fff' }} />Near real-time: provisional</span>
        <span><span className="swatch" style={{ boxShadow: 'inset 0 0 0 2px var(--yellow)' }} />Month to date</span>
      </>}
    </div>
  )
}
