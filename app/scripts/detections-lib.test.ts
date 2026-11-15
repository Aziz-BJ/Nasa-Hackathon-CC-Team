// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { selectDetections } from '../src/lib/detections'
import type { Area } from '../src/lib/area'
import { countBySatellite, dayOfYear, encodeRegionYear, groupRows, keepRow, satelliteCode, type DetectionRow } from './detections-lib'

const row = (over: Partial<DetectionRow>): DetectionRow => ({
  latitude: 38.1234567, longitude: 13.7654321, scan: 0.39, track: 0.36, satellite: 'SNPP', frp: 4.6,
  date_local: '2024-07-15', daynight: 'D', region: 'sicily', ...over,
})

describe('dayOfYear', () => {
  it('counts from 0 on 1 January, with leap years', () => {
    expect(dayOfYear('2023-01-01')).toBe(0)
    expect(dayOfYear('2023-03-01')).toBe(59)
    expect(dayOfYear('2024-03-01')).toBe(60)
    expect(dayOfYear('2024-12-31')).toBe(365)
  })
})

describe('satelliteCode', () => {
  it('packs satellite and night into one small number, and refuses unknown satellites', () => {
    expect(satelliteCode('AQUA', 'D')).toBe(0)
    expect(satelliteCode('AQUA', 'N')).toBe(1)
    expect(satelliteCode('SNPP', 'D')).toBe(2)
    expect(satelliteCode('NOAA20', 'N')).toBe(5)
    expect(() => satelliteCode('TERRA', 'D')).toThrow(/Unknown satellite/)
  })
})

describe('keepRow', () => {
  it('drops rows after the last complete day, as the harmonized record does', () => {
    expect(keepRow(row({ date_local: '2026-11-13' }), '2026-11-13')).toBe(true)
    expect(keepRow(row({ date_local: '2026-11-14' }), '2026-11-13')).toBe(false)
  })
})

describe('encodeRegionYear', () => {
  const rows = [
    row({ satellite: 'AQUA', daynight: 'N', scan: 1.2, track: 1.1, frp: 30.4, date_local: '2024-08-02' }),
    row({ latitude: 37.5, longitude: 12.5, date_local: '2024-07-15' }),
    row({ satellite: 'NOAA20', latitude: 38.9, longitude: 15.6, date_local: '2024-07-15' }),
  ]
  const f = encodeRegionYear('sicily', 2024, rows)

  it('sorts by day then satellite, and keeps positions to about 10 m', () => {
    expect(f.d).toEqual([196, 196, 214])
    expect(f.s).toEqual([2, 4, 1])
    expect([f.lon0, f.lat0]).toEqual([12.5, 37.5])
    const lon = f.lon0 + f.x[2] / 1e4
    const lat = f.lat0 + f.y[2] / 1e4
    expect(Math.abs(lon - 13.7654321)).toBeLessThan(5e-5)
    expect(Math.abs(lat - 38.1234567)).toBeLessThan(5e-5)
    expect([f.w[2], f.h[2], f.p[2]]).toEqual([120, 110, 30])
  })

  it('counts per satellite and groups by region and year', () => {
    expect(countBySatellite(f)).toEqual([1, 1, 1])
    const g = groupRows([...rows, row({ region: 'sardinia', date_local: '2023-01-01' })])
    expect([...g.keys()]).toEqual(['sicily', 'sardinia'])
    expect(g.get('sicily')?.get(2024)).toHaveLength(3)
    expect(g.get('sardinia')?.get(2023)).toHaveLength(1)
  })

  it('round-trips through the app: every row comes back for its whole region', () => {
    const area: Area = {
      label: 'Sicily', source: 'region', regionIds: ['sicily'], areaKm2: 25_000, bbox: [12, 36, 16, 39],
      geometry: { type: 'Polygon', coordinates: [[[12, 36], [16, 36], [16, 39], [12, 39], [12, 36]]] },
    }
    const sel = selectDetections([f], area, '2024-01', '2024-12', { show: true, aqua: true, snpp: true, noaa20: true })
    expect(sel.counts).toEqual([1, 1, 1])
    expect(sel.features.features.map((x) => x.properties.s)).toEqual([1, 2, 0])
  })
})
