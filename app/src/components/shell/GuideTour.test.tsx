// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'
import { cardStyle, GuideTour, guideSeen, markGuideSeen } from './GuideTour'

const steps = [
  { target: null, title: 'Welcome', text: 'Intro' },
  { target: 'box-area', title: 'Area', text: 'Pick an area' },
]

describe('GuideTour', () => {
  it('walks forward and back, then finishes', async () => {
    const onClose = vi.fn()
    render(<><button data-tour="box-area">Area</button><GuideTour steps={steps} onClose={onClose} /></>)
    expect(screen.getByRole('dialog', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Area' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('closes with Escape or Skip', async () => {
    const onClose = vi.fn()
    render(<GuideTour steps={steps} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Skip guide' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('remembers that the guide was seen', () => {
    localStorage.clear()
    expect(guideSeen()).toBe(false)
    markGuideSeen()
    expect(guideSeen()).toBe(true)
  })
  it('gives focus back on close, and its Esc does not close a drawer underneath', async () => {
    const onGuideClose = vi.fn()
    const onDrawerClose = vi.fn()
    const { rerender } = render(<><button>Guide</button><Drawer open side="left" title="Area" onClose={onDrawerClose}><p>x</p></Drawer></>)
    screen.getByRole('button', { name: 'Guide' }).focus()
    rerender(<><button>Guide</button><Drawer open side="left" title="Area" onClose={onDrawerClose}><p>x</p></Drawer><GuideTour steps={steps} onClose={onGuideClose} /></>)
    await userEvent.keyboard('{Escape}')
    expect(onGuideClose).toHaveBeenCalledTimes(1)
    expect(onDrawerClose).not.toHaveBeenCalled()
    rerender(<><button>Guide</button><Drawer open side="left" title="Area" onClose={onDrawerClose}><p>x</p></Drawer></>)
    expect(screen.getByRole('button', { name: 'Guide' })).toHaveFocus()
  })
  it('places the card above a target it cannot sit beside', () => {
    // Phone: 390 wide, a box near the bottom
    const box = { left: 11, right: 83, top: 608, bottom: 675, width: 72, height: 67 } as DOMRect
    const style = cardStyle(box, 390, 844)
    expect(Number(style.top) + 230).toBeLessThanOrEqual(box.top)
  })
})
