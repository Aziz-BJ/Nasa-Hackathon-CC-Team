// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { Area } from './area'
import { FIX_MANIFEST } from '../test/fixtures'
import { daySpan, DETECTIONS_OFF, HOTSPOT_COLUMNS, hotspotsCsv, hotspotsFilename, selectDetections, yearsToLoad } from './detections'
import type { DetectionsFile } from './types'

const ALL = { ...DETECTIONS_OFF, show: true }

// Region "aa" covers lon 0..2, lat 0..2. Five detections in 2020: Aqua day, Aqua night, S-NPP, S-NPP, NOAA-20.
const FILE: DetectionsFile = {
  region: 'aa', year: 2020, lon0: 0, lat0: 0,
  s: [0, 1, 2, 3, 4],
  d: [10, 45, 45, 200, 365], // 11 Jan, 15 Feb, 15 Feb, 19 Jul, 31 Dec (2020 is a leap year)
  x: [5000, 15000, 5000, 15000, 5000], // lon 0.5, 1.5, ...
  y: [5000, 5000, 15000, 15000, 5000],
  w: [100, 100, 39, 39, 39],
  h: [100, 100, 36, 36, 36],
  p: [200, 50, 30, 20, 4], // 0.1 MW units: 20 MW ... 0.4 MW
  t: [12 * 60 + 30, -60, 13 * 60, 60, 0], // the 2nd was seen at 23:00 UTC the day before
  c: [80, 45, 2, 3, 2],
  q: [0, 0, 0, 0, 1],
}
const square = (w: number, s: number, e: number, n: number): GeoJSON.Polygon =>
  ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] })
const REGION: Area = { label: 'Region A', source: 'region', regionIds: ['aa'], geometry: square(0, 0, 2, 2), bbox: [0, 0, 2, 2], areaKm2: 1000 }
// A drawn shape over the western half only: keeps x = 0.5.
const WEST: Area = { label: 'West', source: 'drawn', geometry: square(0, 0, 1, 2), bbox: [0, 0, 1, 2], areaKm2: 500 }

describe('daySpan', () => {
  it('gives the days of the chosen months inside one year', () => {
    expect(daySpan(2020, '2020-03', '2020-04')).toEqual([60, 120])
    expect(daySpan(2020, '2019-06', '2021-02')).toEqual([0, 365])
    expect(daySpan(2021, '2019-06', '2021-02')).toEqual([0, 58])
    expect(daySpan(2019, '2019-06', '2021-02')).toEqual([151, 364])
    expect(daySpan(2018, '2019-06', '2021-02')).toBeNull()
  })
})

describe('selectDetections', () => {
  it('keeps every detection of a whole region within the months', () => {
    const sel = selectDetections([FILE], REGION, '2020-01', '2020-12', ALL)
    expect(sel.counts).toEqual([2, 2, 1])
    expect([sel.selected, sel.drawn]).toEqual([5, 5])
    expect(selectDetections([FILE], REGION, '2020-02', '2020-02', ALL).counts).toEqual([1, 1, 0])
  })
  it('tests a drawn shape point by point', () => {
    const sel = selectDetections([FILE], WEST, '2020-01', '2020-12', ALL)
    expect(sel.counts).toEqual([1, 1, 1])
    expect(sel.features.features.every((f) => f.geometry.coordinates[0] < 1)).toBe(true)
  })
  it('counts hidden satellites but does not draw them', () => {
    const sel = selectDetections([FILE], REGION, '2020-01', '2020-12', { ...ALL, aqua: false, noaa20: false })
    expect(sel.counts).toEqual([2, 2, 1])
    expect(sel.selected).toBe(2)
    expect(sel.features.features.map((f) => f.properties.s)).toEqual([1, 1])
  })
  it('thins evenly above the limit and says how many it drew', () => {
    const sel = selectDetections([FILE], REGION, '2020-01', '2020-12', ALL, 2)
    expect([sel.selected, sel.drawn]).toEqual([5, 2])
  })
  it('sizes a dot as half the pixel width in screen pixels at zoom 0, wider away from the equator', () => {
    const [aqua] = selectDetections([FILE], REGION, '2020-01', '2020-01', ALL).features.features
    const mPerPx = (2 * Math.PI * 6_378_137) / 512
    expect(aqua.properties.k).toBeCloseTo(500 / (mPerPx * Math.cos((0.5 * Math.PI) / 180)), 6)
    // At zoom 10 a 1 km Aqua pixel is about 13 screen pixels across.
    expect(aqua.properties.k * 2 ** 10 * 2).toBeCloseTo(13.1, 0)
  })
})

describe('yearsToLoad', () => {
  it('picks the years of the chosen months that have a file', () => {
    expect(yearsToLoad(['2019', '2020', '2021', '2018'], '2019-06', '2020-02')).toEqual([2019, 2020])
    expect(yearsToLoad(['2019'], '2021-01', '2021-12')).toEqual([])
  })
})

describe('hotspotsCsv', () => {
  const out = hotspotsCsv(FIX_MANIFEST, [FILE], REGION, '2020-01', '2020-12', new Date('2026-11-15T12:00:00Z'))
  const lines = out.csv.trim().split('\n')
  const rows = lines.filter((l) => !l.startsWith('#')).slice(1).map((l) => l.split(','))
  const col = (r: string[], name: (typeof HOTSPOT_COLUMNS)[number]) => r[HOTSPOT_COLUMNS.indexOf(name)]

  it('has one row per detection, with the FIRMS fields decoded', () => {
    expect(out.rows).toBe(5)
    expect(out.counts).toEqual([2, 2, 1])
    expect(rows).toHaveLength(5)
    const [aquaDay, aquaNight, , , noaa] = rows
    expect([col(aquaDay, 'latitude'), col(aquaDay, 'longitude')]).toEqual(['0.5000', '0.5000'])
    expect([col(aquaDay, 'acq_date_utc'), col(aquaDay, 'acq_time_utc'), col(aquaDay, 'local_solar_date')]).toEqual(['2020-01-11', '1230', '2020-01-11'])
    expect([col(aquaNight, 'acq_date_utc'), col(aquaNight, 'acq_time_utc'), col(aquaNight, 'local_solar_date')]).toEqual(['2020-02-14', '2300', '2020-02-15'])
    expect([col(aquaNight, 'satellite'), col(aquaNight, 'instrument'), col(aquaNight, 'daynight'), col(aquaNight, 'confidence')]).toEqual(['Aqua', 'MODIS', 'N', '45'])
    expect([col(noaa, 'satellite'), col(noaa, 'confidence'), col(noaa, 'data_version'), col(noaa, 'local_solar_date')]).toEqual(['NOAA-20', 'n', 'NRT', '2020-12-31'])
    expect([col(aquaDay, 'doi'), col(noaa, 'doi')]).toEqual(['10.5067/MODIS/MYD14.061', '10.5067/FIRMS/VIIRS/VJ114IMGT_NRT.002'])
    expect([col(noaa, 'frp_mw'), col(noaa, 'scan_km'), col(noaa, 'track_km')]).toEqual(['0.4', '0.39', '0.36'])
  })
  it('says what the rows are and credits FIRMS in the header', () => {
    expect(out.csv).toMatch(/NOT harmonized/)
    expect(out.csv).toMatch(/We acknowledge the use of data and\/or imagery from NASA's Fire Information for Resource Management System \(FIRMS\)/)
    expect(out.csv).toMatch(/"as is"/)
    expect(out.csv).toMatch(/Not for tactical decisions/)
    expect(out.csv).toMatch(/Detections: 5 \(Aqua MODIS 2, Suomi NPP VIIRS 2, NOAA-20 VIIRS 1\)/)
  })
  it('follows the area and months like the map layer', () => {
    expect(hotspotsCsv(FIX_MANIFEST, [FILE], WEST, '2020-01', '2020-12').rows).toBe(3)
    expect(hotspotsCsv(FIX_MANIFEST, [FILE], REGION, '2021-01', '2021-12').rows).toBe(0)
    expect(hotspotsFilename(REGION, '2020-01', '2020-12')).toBe('hotspots_region-a_2020-01_2020-12.csv')
  })
})
