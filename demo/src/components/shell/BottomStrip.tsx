// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The small bar along the bottom: what the colours mean, a one-line verdict, and "More info".
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'

export interface BottomStripProps {
  legend: ReactNode
  headline: ReactNode
  expanded: boolean
  onToggle: () => void
  /** Shown above the bar when "More info" is open. */
  more: ReactNode
}

export function BottomStrip({ legend, headline, expanded, onToggle, more }: BottomStripProps) {
  const ref = useRef<HTMLElement>(null)
  // Everything that floats above the strip reads --strip-h, so it never ends up underneath it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(() => root.style.setProperty('--strip-h', `${Math.ceil(el.getBoundingClientRect().height)}px`))
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--strip-h') }
  }, [])
  return (
    <section ref={ref} className="strip" aria-label="Legend and summary" data-tour="strip">
      <div className="strip-more-wrap" data-open={expanded} inert={!expanded} aria-hidden={!expanded}>
        {/* Focusable when open, so keyboard users can scroll a long summary. */}
        <div className="strip-more" id="strip-more" role="region" aria-label="Summary details" tabIndex={expanded ? 0 : -1}>{more}</div>
      </div>
      <div className="strip-bar">
        <div className="strip-legend">{legend}</div>
        <div className="strip-headline" aria-live="polite">{headline}</div>
        <button type="button" className="btn" aria-expanded={expanded} aria-controls="strip-more" onClick={onToggle}>
          {expanded ? <CaretDown aria-hidden /> : <CaretUp aria-hidden />} {expanded ? 'Less' : 'More info'}
        </button>
      </div>
      <p className="strip-credit">
        Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Imagery: NASA GIBS. Labels: <a href="https://openfreemap.org">OpenFreeMap</a>,
        © <a href="https://www.openmaptiles.org/">OpenMapTiles</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
        Not an official warning service<span className="long">; for current fires see
        the <a href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS Fire Map</a>. Built for NASA Space Apps 2026, not an official NASA product</span>.
      </p>
    </section>
  )
}
