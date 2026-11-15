// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonthRangeSlider } from './MonthRangeSlider'

function setup(from = '2010-01', to = '2012-12') {
  const onChange = vi.fn()
  render(<MonthRangeSlider first="2000-11" last="2026-11" from={from} to={to} onChange={onChange} />)
  return { onChange, start: screen.getByRole('slider', { name: 'Start month' }), end: screen.getByRole('slider', { name: 'End month' }) }
}

describe('MonthRangeSlider', () => {
  it('reports its months and moves by month and by year with the keyboard', () => {
    const { onChange, start, end } = setup()
    expect(start).toHaveAttribute('aria-valuetext', 'Jan 2010')
    expect(end).toHaveAttribute('aria-valuetext', 'Dec 2012')
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('2010-02', '2012-12')
    fireEvent.keyDown(end, { key: 'PageDown' })
    expect(onChange).toHaveBeenLastCalledWith('2010-01', '2011-12')
    fireEvent.keyDown(end, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('2010-01', '2026-11')
  })
  it('never lets the handles cross or leave the record', () => {
    const { onChange, start, end } = setup('2010-01', '2010-03')
    fireEvent.keyDown(start, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('2010-03', '2010-03')
    fireEvent.keyDown(end, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('2010-01', '2010-01')
    fireEvent.keyDown(start, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('2000-11', '2010-03')
  })
})
