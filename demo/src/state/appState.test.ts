// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { Manifest } from '../lib/types'
import { initialState, reducer } from './appState'

const m = { harmonized_coverage: ['2000-11', '2026-11'], last_month: '2026-11', month_to_date: true } as unknown as Manifest

describe('appState', () => {
  it('starts on the whole record up to the last complete month, harmonized', () => {
    const s = initialState(m)
    expect([s.from, s.to, s.source]).toEqual(['2000-11', '2026-10', 'harmonized'])
    expect(initialState({ ...m, month_to_date: false }).to).toBe('2026-11')
  })
  it('swaps a backwards range instead of failing', () => {
    const s = reducer(initialState(m), { type: 'setRange', from: '2020-05', to: '2019-01' })
    expect([s.from, s.to]).toEqual(['2019-01', '2020-05'])
  })
  it('turns drawing off when an area is chosen', () => {
    const drawing = reducer(initialState(m), { type: 'setTool', tool: 'circle' })
    expect(reducer(drawing, { type: 'setArea', area: null }).tool).toBe('pan')
  })
})
