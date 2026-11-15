// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CoordinateForm } from './CoordinateForm'

describe('CoordinateForm', () => {
  it('submits a valid box', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.type(screen.getByLabelText('West'), '-8.7')
    await userEvent.type(screen.getByLabelText('South'), '49.8')
    await userEvent.type(screen.getByLabelText('East'), '1.8')
    await userEvent.type(screen.getByLabelText('North'), '60.9')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(onArea).toHaveBeenCalledTimes(1)
    expect(onArea.mock.calls[0][0].bbox).toEqual([-8.7, 49.8, 1.8, 60.9])
  })
  it('shows a friendly error and does not submit', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.type(screen.getByLabelText('West'), '5')
    await userEvent.type(screen.getByLabelText('South'), '50')
    await userEvent.type(screen.getByLabelText('East'), '1')
    await userEvent.type(screen.getByLabelText('North'), '60')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/West must be less than east/)
    expect(onArea).not.toHaveBeenCalled()
  })
  it('accepts decimal commas (they used to give only "Enter all four numbers")', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.type(screen.getByLabelText('West'), '7,5')
    await userEvent.type(screen.getByLabelText('South'), '38,8')
    await userEvent.type(screen.getByLabelText('East'), '10')
    await userEvent.type(screen.getByLabelText('North'), '41,3')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(onArea.mock.calls[0][0].bbox).toEqual([7.5, 38.8, 10, 41.3])
  })
  it('builds a circle from a point', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Point + radius' }))
    await userEvent.type(screen.getByLabelText('Latitude'), '51.5')
    await userEvent.type(screen.getByLabelText('Longitude'), '-0.1')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(onArea.mock.calls[0][0].source).toBe('point')
  })
})
