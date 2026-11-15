// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { svgFile } from './download'

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
