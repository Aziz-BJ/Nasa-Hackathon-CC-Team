// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { shortCount } from './Legend'

describe('shortCount', () => {
  it('abbreviates large counts for the legend ticks', () => {
    expect([shortCount(950), shortCount(5853), shortCount(16890), shortCount(1234567)]).toEqual(['950', '5.9k', '17k', '1.2M'])
  })
})
