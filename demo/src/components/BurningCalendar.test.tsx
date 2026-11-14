// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildCountScale } from '../lib/colorScale'
import { monthRange } from '../lib/months'
import { BurningCalendar } from './BurningCalendar'

const months = monthRange('2011-01', '2012-12')
const values = months.map((ym) => (ym < '2011-03' ? null : ym === '2011-06' ? 0 : 10))
const scale = buildCountScale(values, { method: 'quantile', bins: 4, palette: 'inferno' })

function setup(onFocusMonth = vi.fn()) {
  render(
    <BurningCalendar months={months} values={values} from="2011-01" to="2012-12" scale={scale}
      statusOf={(ym) => (ym === '2012-12' ? 'partial' : 'standard')} baselineYears={[2011, 2012]}
      seriesLabel="harmonized" legendId="lg" onFocusMonth={onFocusMonth} />,
  )
  return onFocusMonth
}

describe('BurningCalendar', () => {
  it('has one row per year and labels every month', () => {
    setup()
    expect(screen.getByRole('rowheader', { name: '2011' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '2012' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Jan 2011: no data/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Jun 2011: 0 hotspots/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Dec 2012: 10 hotspots.*Month to date/)).toBeInTheDocument()
  })
  it('moves focus with the arrow keys', () => {
    const onFocusMonth = setup()
    const last = screen.getByLabelText(/Dec 2012/)
    last.focus()
    fireEvent.keyDown(last, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByLabelText(/Dec 2011/))
    expect(onFocusMonth).toHaveBeenLastCalledWith('2011-12')
  })
  it('shows numbers when the table view is on', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/Show numbers/))
    expect(screen.getByLabelText(/Jul 2011/)).toHaveTextContent('10')
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
