// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Side drawer. It stays mounted so it can slide out the way it came in; CSS transitions start from the
// current on-screen value, so a drawer reopened mid-close simply turns around.
import { X } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'

export interface DrawerProps {
  open: boolean
  side: 'left' | 'right'
  wide?: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Drawer({ open, side, wide = false, title, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // Move focus into the drawer when it opens or switches feature.
  useEffect(() => { if (open) ref.current?.focus() }, [open, title])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <section id={open ? 'drawer' : undefined} ref={ref} tabIndex={-1} aria-labelledby={`drawer-title-${side}`}
      data-open={open} inert={!open} aria-hidden={!open}
      className={`drawer drawer-${side}${wide ? ' drawer-wide' : ''}`}>
      <header className="drawer-head">
        <h2 id={`drawer-title-${side}`}>{title}</h2>
        <button type="button" className="close-btn" aria-label={`Close ${title}`} onClick={onClose}><X weight="bold" aria-hidden /></button>
      </header>
      <div className="drawer-body">{children}</div>
    </section>
  )
}
