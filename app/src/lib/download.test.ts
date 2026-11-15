// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { chartFilename, svgFile } from './download'

describe('svgFile with a legend', () => {
  const chart = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '600')
    svg.setAttribute('height', '300')
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'))
    return svg
  }
  const meta = {
    title: 'Why harmonize', area: 'Box W 13, S 37.3 & <E 15.5>', unit: 'fire cell-days per year',
    legend: [{ label: 'Harmonized', color: '#ffffff' }, { label: 'Raw MODIS', color: '#E69F00', dash: '6,3' }, { label: 'Band', color: '#409cff', kind: 'swatch' as const, opacity: 0.3 }],
  }
  it('is one well-formed SVG with title, area, unit, every legend entry and a source line', () => {
    const doc = new DOMParser().parseFromString(svgFile(chart(), meta), 'image/svg+xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    const t = doc.documentElement.textContent ?? ''
    for (const s of ['Why harmonize', 'Box W 13, S 37.3 & <E 15.5>', 'Unit: fire cell-days per year', 'Harmonized', 'Raw MODIS', 'Band', 'Data: NASA FIRMS']) expect(t).toContain(s)
    expect(doc.querySelectorAll('svg')).toHaveLength(2)
    expect(Number(doc.documentElement.getAttribute('height'))).toBeGreaterThan(300)
  })
  it('puts the area slug in the filename', () => {
    expect(chartFilename('fire-season-2026', 'Sicily')).toBe('fire-season-2026-sicily.svg')
    expect(chartFilename('fire-anomalies', 'Box W 13, S 37.3')).toBe('fire-anomalies-box-w-13-s-37-3.svg')
    expect(chartFilename('fire-anomalies')).toBe('fire-anomalies.svg')
  })
})

describe('svgFile', () => {
  it('makes a standalone SVG with a background', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'circle'))
    const text = svgFile(svg)
    expect(text.startsWith('<?xml')).toBe(true)
    expect(text).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(text).toContain('background')
    expect(text).toContain('<circle')
    expect(svg.style.background).toBe('') // the chart on screen is untouched
  })
})
