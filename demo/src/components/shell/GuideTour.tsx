// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Short step-by-step guide. Opens on the first visit; the Guide button reopens it.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

export interface GuideStep {
  /** data-tour value of the element to highlight, or null for a centred card. */
  target: string | null
  title: string
  text: string
}

export const GUIDE_SEEN_KEY = 'hotspot-calendar-guide-seen'

export function guideSeen(): boolean {
  try { return localStorage.getItem(GUIDE_SEEN_KEY) === '1' } catch { return false }
}

export function markGuideSeen() {
  try { localStorage.setItem(GUIDE_SEEN_KEY, '1') } catch { /* private mode: the guide may show again */ }
}

const CARD_W = 320

function cardStyle(r: DOMRect | null): CSSProperties {
  if (!r) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = r.right + 16
  if (left + CARD_W > vw - 8) left = r.left - CARD_W - 16
  if (left < 8) left = Math.min(Math.max(8, r.left), vw - CARD_W - 8)
  let top = r.top
  if (top + 220 > vh - 8) top = Math.max(8, r.top - 230)
  return { left, top }
}

export function GuideTour({ steps, onClose }: { steps: GuideStep[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const step = steps[Math.min(i, steps.length - 1)]
  const last = i >= steps.length - 1

  useLayoutEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
    // On phones some boxes sit in a scrolling row: bring the highlighted one into view first.
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])
  useEffect(() => { cardRef.current?.focus() }, [i])

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowRight' && !last) setI(i + 1)
    else if (e.key === 'ArrowLeft' && i > 0) setI(i - 1)
    else if (e.key === 'Tab') {
      // Keep focus inside the guide card while it is open.
      const items = cardRef.current?.querySelectorAll<HTMLElement>('button')
      if (!items || items.length === 0) return
      const first = items[0]
      const end = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) { e.preventDefault(); end.focus() }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus() }
    }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" onKeyDown={onKey}>
      {rect
        ? <div className="tour-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" ref={cardRef} tabIndex={-1} style={cardStyle(rect)}>
        <p className="small muted">Step {i + 1} of {steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>Skip guide</button>
          {i > 0 && <button type="button" className="btn" onClick={() => setI(i - 1)}>Back</button>}
          <button type="button" className="btn btn-primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
