// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GuideTour, guideSeen, markGuideSeen } from './GuideTour'

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
})
