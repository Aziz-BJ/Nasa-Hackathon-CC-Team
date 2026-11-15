// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { DETECTION_SATELLITES, type DetectionSelection, type DetectionsState } from '../lib/detections'

const fmt = (n: number) => n.toLocaleString('en-GB')

/** The detections layer's key for the bottom strip: one swatch per satellite with its count, and the raw-data note. */
export function DetectionsLegend({ selection, state, loading, error }: {
  selection: DetectionSelection | null; state: DetectionsState; loading: boolean; error: string | null
}) {
  const title = 'Detections at native pixel size (raw, not harmonized)'
  return (
    <div className="legend-detections">
      <div className="small">{title}</div>
      {error ? <span className="small error" role="alert">{error}</span>
        : loading || !selection ? <span className="small muted">Loading detections…</span>
        : <>
          <ul aria-label={title}>
            {DETECTION_SATELLITES.map((sat, i) => (
              <li key={sat.key} className={state[sat.key] ? '' : 'off'}>
                <span className="dot" style={{ background: sat.color }} aria-hidden />
                <span className="small">{sat.label}: {fmt(selection.counts[i])}{state[sat.key] ? '' : ' (hidden)'}</span>
              </li>
            ))}
          </ul>
          {selection.drawn < selection.selected && (
            <div className="small muted det-note">Showing {fmt(selection.drawn)} of {fmt(selection.selected)}, evenly thinned for speed. Choose fewer months or a smaller area to see all.</div>
          )}
          <div className="small muted det-note">Counts are not comparable between sensors: VIIRS sees many more, smaller fires. Positions are pixel centres.</div>
        </>}
    </div>
  )
}
