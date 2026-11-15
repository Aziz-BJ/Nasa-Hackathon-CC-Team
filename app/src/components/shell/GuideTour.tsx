// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Short step-by-step guide. Opens every time the app is opened; the Guide button reopens it.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

export interface GuideStep {
  /** data-tour value of the element to highlight, or null for a centred card. */
  target: string | null
  title: string
  text: string
}

const CARD_W = 320
const CARD_H = 230
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(x, hi))

/** Beside the target if it fits, otherwise above it (or below), never on top of it. */
export function cardStyle(r: DOMRect | null, vw = window.innerWidth, vh = window.innerHeight): CSSProperties {
  if (!r) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  const w = Math.min(CARD_W, vw - 20)
  const top = clamp(r.top, 8, vh - CARD_H - 8)
  if (r.right + 16 + w <= vw - 8) return { left: r.right + 16, top }
  if (r.left - 16 - w >= 8) return { left: r.left - 16 - w, top }
  const left = clamp(r.left + r.width / 2 - w / 2, 8, vw - w - 8)
  return { left, top: r.top - CARD_H - 16 >= 8 ? r.top - CARD_H - 16 : Math.min(r.bottom + 16, vh - CARD_H - 8) }
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
  // Remember what had focus before the guide opened (usually the Guide button), and give it back on close.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  useEffect(() => () => opener?.focus?.(), [opener])
  useEffect(() => { cardRef.current?.focus() }, [i])
  // The guide is on top: Esc closes only the guide, not a drawer underneath, wherever focus is (a click outside the card
  // moves it to the page). Listening on window in the capture phase runs before the drawer's own Escape handler.
  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onEsc, { capture: true })
    return () => window.removeEventListener('keydown', onEsc, { capture: true })
  }, [onClose])

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight' && !last) setI(i + 1)
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
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" onKeyDown={onKey}
      // A click beside the card must not move focus out of the guide (to the page behind it).
      onMouseDown={(e) => { if (!cardRef.current?.contains(e.target as Node)) e.preventDefault() }}>
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
