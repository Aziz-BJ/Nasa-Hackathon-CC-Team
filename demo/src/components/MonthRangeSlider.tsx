// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// A timeline from the first to the last month with two handles. The track can be coloured with the area's
// monthly fire activity, so busy seasons are visible while choosing. Drag a handle (it stays under the pointer),
// click the track to move the nearer handle, or use the keyboard: arrows = 1 month, Page Up/Down = 1 year, Home/End.
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { addMonths, labelYm, monthsBetween, parseYm, type YearMonth } from '../lib/months'

type Which = 'from' | 'to'

export interface MonthRangeSliderProps {
  first: YearMonth
  last: YearMonth
  from: YearMonth
  to: YearMonth
  /** One colour per month from `first` to `last`; omit for a plain track. */
  colors?: string[]
  onChange: (from: YearMonth, to: YearMonth) => void
}

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -12, PageUp: 12 }

export function MonthRangeSlider({ first, last, from, to, colors, onChange }: MonthRangeSliderProps) {
  const n = monthsBetween(first, last) + 1
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i))
  const a = clamp(monthsBetween(first, from))
  const b = clamp(monthsBetween(first, to))
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ which: Which; offset: number } | null>(null)
  const at = (i: number) => addMonths(first, clamp(i))
  // Month i covers [i/n, (i+1)/n] of the track: "from" sits at the left edge of its month, "to" at the right edge of its month.
  const left = (a / n) * 100
  const right = ((b + 1) / n) * 100

  function set(which: Which, i: number) {
    if (which === 'from') onChange(at(Math.min(clamp(i), b)), to)
    else onChange(from, at(Math.max(clamp(i), a)))
  }

  /** Continuous month position under the pointer, 0..n. */
  function posAt(clientX: number): number {
    const r = trackRef.current!.getBoundingClientRect()
    return ((clientX - r.left) / Math.max(1, r.width)) * n
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    const pos = posAt(e.clientX)
    let which: Which
    if (target.dataset.thumb === 'from' || target.dataset.thumb === 'to') which = target.dataset.thumb
    else which = Math.abs(pos - a) <= Math.abs(pos - (b + 1)) ? 'from' : 'to'
    // Keep the grab offset, so a handle doesn't jump to the pointer when grabbed off-centre.
    const edge = which === 'from' ? a : b + 1
    const offset = target.dataset.thumb ? pos - edge : 0
    drag.current = { which, offset }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (!target.dataset.thumb) set(which, which === 'from' ? Math.floor(pos) : Math.ceil(pos) - 1)
    ;(e.currentTarget.querySelector(`[data-thumb="${which}"]`) as HTMLElement | null)?.focus()
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const pos = posAt(e.clientX) - d.offset
    set(d.which, d.which === 'from' ? Math.round(pos) : Math.round(pos) - 1)
  }

  function onKey(which: Which, e: KeyboardEvent<HTMLDivElement>) {
    const cur = which === 'from' ? a : b
    let next: number | null = null
    if (e.key in STEP) next = cur + STEP[e.key]
    else if (e.key === 'Home') next = which === 'from' ? 0 : a
    else if (e.key === 'End') next = which === 'from' ? b : n - 1
    if (next === null) return
    e.preventDefault()
    set(which, next)
  }

  const background = colors && colors.length === n
    ? `linear-gradient(to right, ${colors.map((c, i) => `${c} ${((i / n) * 100).toFixed(3)}% ${(((i + 1) / n) * 100).toFixed(3)}%`).join(', ')})`
    : undefined
  const y0 = parseYm(first).year
  const y1 = parseYm(last).year
  const ticks = [y0, ...Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k).filter((y) => y % 5 === 0 && y !== y0 && y1 - y >= 2), y1]
  const tickPos = (y: number) => (y === y0 ? 0 : (Math.max(0, monthsBetween(first, `${y}-01`)) / n) * 100)

  const thumb = (which: Which, pos: number, ym: YearMonth, label: string, index: number) => (
    <div className={`range-thumb range-thumb-${which}`} data-thumb={which} role="slider" tabIndex={0}
      aria-label={label} aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={index} aria-valuetext={labelYm(ym)}
      style={{ left: `${pos}%` }} onKeyDown={(e) => onKey(which, e)} />
  )

  return (
    <div className="range-slider">
      <div className="range-track" ref={trackRef} style={{ background }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <div className="range-dim" style={{ left: 0, width: `${left}%` }} />
        <div className="range-dim" style={{ left: `${right}%`, right: 0 }} />
        <div className="range-window" style={{ left: `${left}%`, width: `${right - left}%` }} />
        {thumb('from', left, from, 'Start month', a)}
        {thumb('to', right, to, 'End month', b)}
      </div>
      <div className="range-ticks" aria-hidden>
        {ticks.map((y) => <span key={y} style={{ left: `${tickPos(y)}%` }}>{y}</span>)}
      </div>
    </div>
  )
}
