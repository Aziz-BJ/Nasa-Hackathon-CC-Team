// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeRangePicker } from './TimeRangePicker'

const props = {
  first: '2000-11', last: '2026-11', from: '2000-11', to: '2026-11',
}

describe('TimeRangePicker', () => {
  it('shows the chosen range and its length above the bar', () => {
    render(<TimeRangePicker {...props} from="2022-01" to="2026-10" onChange={vi.fn()} />)
    expect(screen.getByText('Jan 2022 – Oct 2026')).toBeInTheDocument()
    expect(screen.getByText('58 months')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Start month' })).toHaveAttribute('aria-valuetext', 'Jan 2022')
    expect(screen.queryByRole('button', { name: /Last 12 months/ })).toBeNull()
  })
  it('changes the start year by hand and clamps to the data', async () => {
    const onChange = vi.fn()
    render(<TimeRangePicker {...props} onChange={onChange} />)
    expect(screen.queryByLabelText('From year')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Enter dates manually' }))
    await userEvent.selectOptions(screen.getByLabelText('From year'), '2019')
    expect(onChange).toHaveBeenCalledWith('2019-11', '2026-11')
    await userEvent.selectOptions(screen.getByLabelText('To month'), '12')
    expect(onChange).toHaveBeenLastCalledWith('2000-11', '2026-11')
  })
})
