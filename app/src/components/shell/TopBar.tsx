// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Apple-Maps-style top bar: one pill with the app name and the current selection (opens Area), and two round buttons.
import { FireSimple, Info, Question } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'

export interface TopBarProps {
  /** Short description of the current area and months, e.g. "Sicily, Jan 2023 – Dec 2023". */
  selection: string
  onSelectionClick: () => void
  onGuide: () => void
  onAbout: () => void
}

export function TopBar({ selection, onSelectionClick, onGuide, onAbout }: TopBarProps) {
  const ref = useRef<HTMLElement>(null)
  // The bar wraps when text is large or the screen is narrow; the rails and drawers start below its real bottom edge.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(() => root.style.setProperty('--top-h', `${Math.ceil(el.getBoundingClientRect().height) + 10}px`))
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--top-h') }
  }, [])
  return (
    <header ref={ref} className="topbar">
      <button type="button" className="search-pill" data-tour="selection" onClick={onSelectionClick} title="Change the area">
        <span className="app-glyph" aria-hidden><FireSimple weight="fill" /></span>
        <span className="pill-text">
          <span className="pill-title">Spark 1</span>
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
