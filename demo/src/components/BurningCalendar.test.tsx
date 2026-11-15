// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildCountScale } from '../lib/colorScale'
import { calendarMedians } from '../lib/indices'
import { monthRange } from '../lib/months'
import type { MonthStatus } from '../lib/status'
import { BurningCalendar } from './BurningCalendar'

const months = monthRange('2011-01', '2012-12')
const values = months.map((ym) => (ym < '2011-03' ? null : ym === '2011-06' ? 0 : 10))
const scale = buildCountScale(values, { method: 'quantile', bins: 4, palette: 'inferno' })
const STATUS: Record<string, MonthStatus> = { '2012-12': 'partial', '2012-10': 'nrt', '2012-05': 'incomplete' }

function setup(onFocusMonth = vi.fn(), unit = 'fire cell-days') {
  render(
    <BurningCalendar months={months} values={values} from="2011-01" to="2012-12" scale={scale} medians={calendarMedians(values, months, [2011, 2012])}
      statusOf={(ym) => STATUS[ym] ?? 'standard'} baselineYears={[2011, 2012]}
      seriesLabel="harmonized" unit={unit} legendId="lg" onFocusMonth={onFocusMonth} />,
  )
  return onFocusMonth
}

describe('BurningCalendar', () => {
  it('has one row per year and labels every month with the unit', () => {
    setup()
    expect(screen.getByRole('rowheader', { name: '2011' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '2012' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Jan 2011: no data/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Jun 2011: 0 fire cell-days/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Dec 2012: 10 fire cell-days, harmonized\. Month to date/)).toBeInTheDocument()
    expect(screen.getByText(/10 of 12 months/)).toBeInTheDocument() // 2011 has no data for Jan and Feb
  })
  it('uses whatever unit it is given, in the labels and the caption', () => {
    setup(vi.fn(), 'widgets')
    expect(screen.getByLabelText(/Jul 2011: 10 widgets/)).toBeInTheDocument()
    expect(screen.getByText(/Burning calendar: widgets per month, 2011-01 to 2012-12/)).toBeInTheDocument()
  })
  it('names the status of provisional months in the label', () => {
    setup()
    expect(screen.getByLabelText(/Oct 2012: 10 fire cell-days.*Near real-time/)).toBeInTheDocument()
    expect(screen.getByLabelText(/May 2012: 10 fire cell-days.*Some days had no satellite data/)).toBeInTheDocument()
  })
  it('marks partial, near-real-time and incomplete months with classes for their pattern', () => {
    setup()
    expect(screen.getByLabelText(/Dec 2012/)).toHaveClass('partial')
    expect(screen.getByLabelText(/Oct 2012/)).toHaveClass('nrt')
    expect(screen.getByLabelText(/May 2012/)).toHaveClass('incomplete')
    expect(screen.getByLabelText(/Jul 2012/)).not.toHaveClass('partial', 'nrt', 'incomplete')
    expect(screen.getByLabelText(/Jan 2011/)).toHaveClass('nodata')
    expect(screen.getByLabelText(/Jun 2011/)).toHaveClass('zero')
  })
  it('shows the typical year in a median row', () => {
    setup()
    expect(screen.getByRole('rowheader', { name: 'Median 2011–2012' })).toBeInTheDocument()
  })
  it('moves focus with the arrow keys', () => {
    const onFocusMonth = setup()
    const last = screen.getByLabelText(/Dec 2012/)
    last.focus()
    fireEvent.keyDown(last, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByLabelText(/Dec 2011/))
    expect(onFocusMonth).toHaveBeenLastCalledWith('2011-12')
  })
  it('stays inside the table at the edges and jumps with Home and End', () => {
    const onFocusMonth = setup()
    const first = screen.getByLabelText(/Jan 2011/)
    act(() => first.focus()) // so the component's own 'active month' state follows
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByLabelText(/Dec 2011/))
    expect(onFocusMonth).toHaveBeenLastCalledWith('2011-12')
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })
  it('shows numbers when the table view is on', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/Show numbers/))
    expect(screen.getByLabelText(/Jul 2011/)).toHaveTextContent('10')
  })
})

describe('BurningCalendar outside the chosen months', () => {
  it('dims months outside the range and leaves them out of the year totals', () => {
    render(
      <BurningCalendar months={months} values={values} from="2011-07" to="2012-06" scale={scale} medians={calendarMedians(values, months, [2011, 2012])}
        statusOf={() => 'standard'} baselineYears={[2011, 2012]} seriesLabel="harmonized" unit="fire cell-days" legendId="lg" />,
    )
    expect(screen.getByLabelText(/Mar 2011/)).toHaveClass('outside')
    expect(screen.getByLabelText(/Mar 2011.*Outside the chosen months/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Aug 2011/)).not.toHaveClass('outside')
    expect(screen.getAllByText(/6 of 12 months/).length).toBe(2) // Jul-Dec 2011 and Jan-Jun 2012
  })
})

describe('textClass', () => {
  it('picks the text colour with more contrast', async () => {
    const { textClass } = await import('../lib/contrast')
    expect(textClass('#da4e3c')).toBe('dark-text') // black on this red: 5.0:1, white only 4.1:1
    expect(textClass('#07173f')).toBe('light-text')
    expect(textClass('#fcffa4')).toBe('dark-text')
  })
})
