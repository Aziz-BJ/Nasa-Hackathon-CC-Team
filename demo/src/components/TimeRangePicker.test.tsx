// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeRangePicker } from './TimeRangePicker'

const props = {
  first: '2000-11', last: '2026-11', from: '2000-11', to: '2026-11',
  quick: [{ label: 'Last 12 months', from: '2025-12', to: '2026-11' }],
}

describe('TimeRangePicker', () => {
  it('applies a quick range', async () => {
    const onChange = vi.fn()
    render(<TimeRangePicker {...props} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Last 12 months' }))
    expect(onChange).toHaveBeenCalledWith('2025-12', '2026-11')
  })
  it('changes the start year and clamps to the data', async () => {
    const onChange = vi.fn()
    render(<TimeRangePicker {...props} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('From year'), '2019')
    expect(onChange).toHaveBeenCalledWith('2019-11', '2026-11')
    await userEvent.selectOptions(screen.getByLabelText('To month'), '12')
    expect(onChange).toHaveBeenLastCalledWith('2000-11', '2026-11')
  })
})
