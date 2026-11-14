// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { View } from '../state/appState'

export function Header({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <header className="header">
      <div>
        <h1>Hotspot Calendar</h1>
        <div className="tagline">25 years of satellite fire detections, MODIS and VIIRS on one scale</div>
      </div>
      <nav aria-label="Pages">
        <button className="btn" aria-pressed={view === 'explore'} onClick={() => onView('explore')}>Explore</button>
        <button className="btn" aria-pressed={view === 'about'} onClick={() => onView('about')}>About &amp; methods</button>
      </nav>
    </header>
  )
}
