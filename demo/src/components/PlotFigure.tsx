// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Renders an Observable Plot chart inside React at the width of its container (drawers vary in width).
import { DownloadSimple } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { saveFile, svgFile } from '../lib/download'

export function PlotFigure({ make, label, filename }: {
  make: (width: number) => SVGSVGElement | HTMLElement; label: string; filename?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (width < 50) return
    const el = make(width)
    // Plot labels inner <g> groups; inside role="img" those labels are invalid ARIA. The figure label covers it.
    el.querySelectorAll('[aria-label]').forEach((n) => n.removeAttribute('aria-label'))
    el.setAttribute('role', 'img')
    el.setAttribute('aria-label', label)
    ref.current?.replaceChildren(el)
    return () => el.remove()
  }, [make, label, width])
  function download() {
    const svg = ref.current?.querySelector('svg')
    if (svg && filename) saveFile(filename, svgFile(svg), 'image/svg+xml')
  }
  return (
    <>
      <div className="figure" ref={ref} />
      {filename && <button type="button" className="btn btn-small" onClick={download}><DownloadSimple aria-hidden /> Download image (SVG)</button>}
    </>
  )
}
