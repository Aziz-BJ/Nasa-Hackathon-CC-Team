// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'
import { FeatureRail } from './FeatureRail'

describe('FeatureRail and Drawer', () => {
  it('marks the open box and closes the drawer with Escape or the close button', async () => {
    const onToggle = vi.fn()
    const onClose = vi.fn()
    render(
      <>
        <FeatureRail side="left" label="Tools" open="area" onToggle={onToggle}
          boxes={[{ id: 'area', label: 'Area', icon: null }, { id: 'dates', label: 'Dates', icon: null }]} />
        <Drawer open side="left" title="Choose an area" onClose={onClose}><p>Body</p></Drawer>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Area' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Dates' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('region', { name: 'Choose an area' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Dates' }))
    expect(onToggle).toHaveBeenCalledWith('dates')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Close Choose an area' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('hides a closed drawer from assistive tech and ignores Escape', async () => {
    const onClose = vi.fn()
    render(<Drawer open={false} side="right" title="Calendar" onClose={onClose}><p>Body</p></Drawer>)
    expect(screen.queryByRole('region', { name: 'Calendar' })).toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})
