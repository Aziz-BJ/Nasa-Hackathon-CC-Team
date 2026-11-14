// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Apple-Maps-style top bar: one pill with the app name and the current selection (opens Area), and two round buttons.
import { FireSimple, Info, Question } from '@phosphor-icons/react'

export interface TopBarProps {
  /** Short description of the current area and months, e.g. "United Kingdom (mock), Jan 2022 – Oct 2026". */
  selection: string
  onSelectionClick: () => void
  onGuide: () => void
  onAbout: () => void
}

export function TopBar({ selection, onSelectionClick, onGuide, onAbout }: TopBarProps) {
  return (
    <header className="topbar">
      <button type="button" className="search-pill" data-tour="selection" onClick={onSelectionClick} title="Change the area">
        <span className="app-glyph" aria-hidden><FireSimple weight="fill" /></span>
        <span className="pill-text">
          <span className="pill-title">Hotspot Calendar</span>
          <span className="pill-sub">{selection}</span>
        </span>
        <span className="sr-only">: change the area</span>
      </button>
      <div className="topbar-actions">
        <button type="button" className="round-btn" data-tour="guide" aria-label="Guide" title="Guide" onClick={onGuide}><Question weight="bold" aria-hidden /></button>
        <button type="button" className="round-btn" data-tour="about" aria-label="About" title="About and methods" onClick={onAbout}><Info weight="bold" aria-hidden /></button>
      </div>
    </header>
  )
}
