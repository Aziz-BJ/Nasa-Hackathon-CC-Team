// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { NO_DATA_FILL, ZERO_FILL, type CountScale } from '../lib/colorScale'

export function Legend({ scale, title, id, showNrt = false }: { scale: CountScale; title: string; id?: string; showNrt?: boolean }) {
  return (
    <div className="legend" id={id} aria-label={title}>
      <strong>{title}</strong>
      <span><span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${NO_DATA_FILL} 0 3px, #2a3554 3px 6px)` }} />No sensor / not yet</span>
      <span><span className="swatch" style={{ background: ZERO_FILL }} />0</span>
      {scale.colors.map((c, i) => (
        <span key={c + i}><span className="swatch" style={{ background: c }} />{scale.labels[i]}</span>
      ))}
      {showNrt && <>
        <span><span className="swatch" style={{ border: '1.5px dotted #fff' }} />Near real-time: provisional</span>
        <span><span className="swatch" style={{ outline: '2px solid var(--neon-yellow)', outlineOffset: '-2px' }} />Month to date</span>
      </>}
    </div>
  )
}
