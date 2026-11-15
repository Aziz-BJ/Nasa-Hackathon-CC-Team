// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seriesFromRegions } from '../lib/aggregate'
import { areaFromRegion } from '../lib/area'
import { FIX_MANIFEST, FIX_OUTLINES, FIX_REGIONS } from '../test/fixtures'
import { ExportButton } from './ExportButton'

const manifest = FIX_MANIFEST
const area = areaFromRegion(manifest, FIX_OUTLINES, 'aa')!
const series = seriesFromRegions(manifest, FIX_REGIONS, ['aa'])
const show = () => render(<ExportButton manifest={manifest} area={area} series={series} i0={0} i1={5} />)

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => setClipboard(undefined))

describe('ExportButton copy link', () => {
  it('announces success when the clipboard accepts the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    show()
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/link copied/i))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })
  it('shows a message and a selected read-only field when the clipboard rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    show()
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/could not copy/i))
    const field = screen.getByLabelText('Link') as HTMLInputElement
    expect(field.readOnly).toBe(true)
    expect(field.value).toBe(window.location.href)
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(field.value.length)
    expect(document.activeElement).toBe(field)
  })
  it('does the same when there is no clipboard API', async () => {
    setClipboard(undefined)
    show()
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/could not copy/i))
  })
})
