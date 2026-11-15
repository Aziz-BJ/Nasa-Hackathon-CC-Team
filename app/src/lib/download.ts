// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Saving files from the browser: CSV of the numbers, SVG images of the charts.
import { areaSlug } from './csv'

export function saveFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
export const SVG_SOURCE = 'Data: NASA FIRMS, harmonized MODIS + VIIRS record'

/** One entry of a downloaded chart's legend: a line (optionally dashed) or a filled swatch. */
export interface LegendEntry { label: string; color: string; kind?: 'line' | 'swatch'; dash?: string; opacity?: number }

/** What a downloaded chart says about itself, since the file is read away from the app. */
export interface SvgMeta {
  title: string
  /** The selected area, shown under the title. */
  area?: string
  /** The unit of the values. */
  unit: string
  legend: LegendEntry[]
  source?: string
}

/** "fire-season-2026" and "Box W 13, S 37.3" give "fire-season-2026-box-w-13-s-37-3.svg". */
export function chartFilename(base: string, areaLabel?: string): string {
  return `${base}${areaLabel ? `-${areaSlug(areaLabel)}` : ''}.svg`
}

function addText(parent: Element, x: number, y: number, content: string, size: number, fill: string, weight = '400') {
  const t = document.createElementNS(SVG_NS, 'text')
  t.setAttribute('x', String(x))
  t.setAttribute('y', String(y))
  t.setAttribute('font-size', String(size))
  t.setAttribute('font-weight', weight)
  t.setAttribute('fill', fill)
  t.textContent = content
  parent.append(t)
}

function addMark(parent: Element, e: LegendEntry, x: number, y: number) {
  if (e.kind === 'swatch') {
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y - 6))
    rect.setAttribute('width', '24')
    rect.setAttribute('height', '12')
    rect.setAttribute('fill', e.color)
    if (e.opacity !== undefined) rect.setAttribute('fill-opacity', String(e.opacity))
    parent.append(rect)
  } else {
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(x))
    line.setAttribute('x2', String(x + 24))
    line.setAttribute('y1', String(y))
    line.setAttribute('y2', String(y))
    line.setAttribute('stroke', e.color)
    line.setAttribute('stroke-width', '2.5')
    if (e.dash) line.setAttribute('stroke-dasharray', e.dash)
    parent.append(line)
  }
}

/**
 * A chart as a standalone SVG file, on a dark background so its light text stays readable anywhere.
 * With meta, the chart is wrapped with a title, the area, the unit, a legend and a source line.
 */
export function svgFile(svg: SVGSVGElement, meta?: SvgMeta): string {
  const chart = svg.cloneNode(true) as SVGSVGElement
  chart.style.fontFamily = FONT
  let root: SVGSVGElement = chart
  if (!meta) chart.setAttribute('xmlns', SVG_NS)
  else {
    chart.removeAttribute('xmlns') // the wrapper declares it
    const w = Number(chart.getAttribute('width')) || 640
    const h = Number(chart.getAttribute('height')) || 320
    const pad = 16
    const head = meta.area ? 78 : 58
    // Legend entries flow left to right and wrap at the chart width (text width estimated at 6.6 px per character).
    const rowH = 20
    let x = pad
    let row = 0
    const placed = meta.legend.map((e) => {
      const itemW = 30 + e.label.length * 6.6 + 18
      if (x > pad && x + itemW > w - pad) { x = pad; row++ }
      const at = { e, x, row }
      x += itemW
      return at
    })
    const legendH = meta.legend.length ? (row + 1) * rowH + 8 : 0
    const total = head + h + legendH + 32
    root = document.createElementNS(SVG_NS, 'svg')
    root.setAttribute('width', String(w))
    root.setAttribute('height', String(total))
    root.setAttribute('viewBox', `0 0 ${w} ${total}`)
    root.style.fontFamily = FONT
    const title = document.createElementNS(SVG_NS, 'title')
    title.textContent = meta.area ? `${meta.title}: ${meta.area}` : meta.title
    root.append(title)
    addText(root, pad, 26, meta.title, 16, '#f2f2f7', '700')
    if (meta.area) addText(root, pad, 46, meta.area, 13, 'rgba(235,235,245,0.85)')
    addText(root, pad, head - 12, `Unit: ${meta.unit}`, 12, 'rgba(235,235,245,0.7)')
    chart.setAttribute('x', '0')
    chart.setAttribute('y', String(head))
    root.append(chart)
    const ly = head + h + 8
    for (const { e, x: lx, row: r } of placed) {
      const y = ly + r * rowH + 10
      addMark(root, e, lx, y)
      addText(root, lx + 30, y + 4, e.label, 12, 'rgba(235,235,245,0.85)')
    }
    addText(root, pad, total - 12, meta.source ?? SVG_SOURCE, 11, 'rgba(235,235,245,0.6)')
  }
  root.style.background = '#1e1e20'
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(root)
}
