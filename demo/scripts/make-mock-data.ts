// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Writes MOCK data to public/data/_mock/ in the same shape as the real pipeline output.
// Every number here is synthetic. It exists to test the app, never to be shown as real.
// The mock "harmonized" series is a latent signal we invented, NOT a harmonization method.
// Run: node scripts/make-mock-data.ts   (deterministic: same output every run)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cellCentre, cellId, type Bbox } from '../src/lib/grid.ts'
import { formatYm, monthRange, parseYm } from '../src/lib/months.ts'

// fileURLToPath, not URL.pathname: the repo folder name contains a space, which .pathname leaves as %20.
const OUT = fileURLToPath(new URL('../public/data/_mock/', import.meta.url))
const GRID = 1
const TILE = 10
const FIRST = '2000-11'
const LAST = '2026-11'
const months = monthRange(FIRST, LAST)

// Small seeded random generator (mulberry32) so the files are reproducible.
let seed = 20261114
function rand(): number {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function gauss(): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
}
function poisson(mean: number): number {
  if (mean <= 0) return 0
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss()))
  const l = Math.exp(-mean)
  let k = 0
  let p = 1
  do { k++; p *= rand() } while (p > l)
  return k - 1
}

interface Region {
  id: string
  name: string
  bbox: Bbox
  /** Relative activity Jan..Dec */
  season: number[]
  /** Typical monthly latent hotspots per cell at the seasonal peak */
  peak: number
  /** Share of cells that ever burn */
  burnShare: number
  /** Multipliers for unusual years or months: "YYYY" or "YYYY-MM" */
  events: Record<string, number>
}

const REGIONS: Region[] = [
  {
    id: 'southern-africa', name: 'Southern Africa savanna (mock)', bbox: [12, -20, 32, -8],
    season: [0.05, 0.03, 0.04, 0.1, 0.35, 0.7, 0.95, 1, 0.8, 0.45, 0.15, 0.06],
    peak: 60, burnShare: 0.95, events: { '2010': 1.25, '2019': 1.3, '2024-08': 1.6, '2026-08': 1.5 },
  },
  {
    id: 'uk', name: 'United Kingdom (mock)', bbox: [-8, 50, 2, 59],
    season: [0.05, 0.15, 0.55, 1, 0.6, 0.3, 0.45, 0.5, 0.2, 0.1, 0.05, 0.05],
    peak: 1.2, burnShare: 0.7, events: { '2018': 2.2, '2022': 1.8, '2025': 3.0, '2026-11': 2.5 },
  },
  {
    id: 'east-siberia', name: 'Eastern Siberia boreal (mock)', bbox: [120, 58, 135, 66],
    season: [0, 0, 0.02, 0.15, 0.6, 1, 0.9, 0.5, 0.15, 0.02, 0, 0],
    peak: 25, burnShare: 0.8, events: { '2012': 1.6, '2021': 3.2, '2014': 0.4 },
  },
  {
    id: 'se-australia', name: 'South-east Australia (mock)', bbox: [145, -38, 153, -30],
    season: [0.9, 0.6, 0.35, 0.2, 0.1, 0.05, 0.05, 0.1, 0.3, 0.6, 0.85, 1],
    peak: 8, burnShare: 0.85, events: { '2019-11': 4, '2019-12': 6, '2020-01': 5, '2011': 0.5 },
  },
]

const SENSORS = [
  { key: 'modis', label: 'MODIS C6.1 (Terra + Aqua)', source: 'NASA FIRMS', version: '6.1', first_month: '2000-11', last_month: LAST },
  { key: 'viirs_snpp', label: 'VIIRS S-NPP 375 m', source: 'NASA FIRMS', version: '2', first_month: '2012-01', last_month: '2026-11' },
  { key: 'viirs_noaa20', label: 'VIIRS NOAA-20 375 m', source: 'NASA FIRMS', version: '2', first_month: '2018-04', last_month: LAST },
] as const
const span = (s: (typeof SENSORS)[number], ym: string) => ym >= s.first_month && ym <= s.last_month

type Series = (number | null)[]
interface CellOut { harmonized: Series; harmonized_low: Series; harmonized_high: Series; modis: Series; viirs_snpp: Series; viirs_noaa20: Series }
const tiles = new Map<string, { cells: string[]; data: CellOut[] }>()

for (const r of REGIONS) {
  const [w, s, e, n] = r.bbox
  for (let lat = s + GRID / 2; lat < n; lat += GRID) {
    for (let lon = w + GRID / 2; lon < e; lon += GRID) {
      if (rand() > r.burnShare) continue
      const id = cellId(lat, lon, GRID)
      const base = r.peak * Math.exp(gauss() * 0.6)
      const ratio = 2.5 + rand() * 2.5 // VIIRS/MODIS ratio differs by cell: not a fixed multiplier
      const out: CellOut = { harmonized: [], harmonized_low: [], harmonized_high: [], modis: [], viirs_snpp: [], viirs_noaa20: [] }
      for (const ym of months) {
        const { year, month } = parseYm(ym)
        const event = (r.events[String(year)] ?? 1) * (r.events[ym] ?? 1)
        const trend = 1 + (year - 2013) * 0.004
        let latent = base * r.season[month - 1] * event * trend * Math.exp(gauss() * 0.35)
        if (ym === LAST) latent *= 14 / 30 // month to date: 14 of 30 days
        const terraOnly = ym < '2002-07' ? 0.55 : 1
        out.modis.push(poisson(latent * terraOnly))
        out.viirs_snpp.push(span(SENSORS[1], ym) ? poisson(latent * ratio * (ym === '2026-11' ? 2 / 14 : 1)) : null)
        out.viirs_noaa20.push(span(SENSORS[2], ym) ? poisson(latent * ratio * 0.95) : null)
        const h = Math.round(latent * 3.75 * 10) / 10
        out.harmonized.push(h)
        out.harmonized_low.push(Math.round(h * 0.85 * 10) / 10)
        out.harmonized_high.push(Math.round(h * 1.15 * 10) / 10)
      }
      if (out.harmonized.every((v) => v === 0)) continue
      const c = cellCentre(id, GRID)
      const tileId = cellId(c.lat, c.lon, TILE)
      if (!tiles.has(tileId)) tiles.set(tileId, { cells: [], data: [] })
      tiles.get(tileId)!.cells.push(id)
      tiles.get(tileId)!.data.push(out)
    }
  }
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT + 'tiles', { recursive: true })
const keys = ['harmonized', 'harmonized_low', 'harmonized_high', 'modis', 'viirs_snpp', 'viirs_noaa20'] as const
for (const [tileId, t] of tiles) {
  const series = Object.fromEntries(keys.map((k) => [k, t.data.map((d) => d[k])]))
  writeFileSync(`${OUT}tiles/${tileId}.json`, JSON.stringify({ tile_id: tileId, cells: t.cells, series }))
}

// Overview: mean annual harmonized hotspots over the baseline years, on a 2-degree grid.
const OV = 2
const overview = new Map<string, number>()
for (const t of tiles.values()) {
  t.cells.forEach((id, i) => {
    const c = cellCentre(id, GRID)
    const key = cellId(c.lat, c.lon, OV)
    let sum = 0
    months.forEach((ym, j) => { if (ym >= '2003-01' && ym <= '2025-12') sum += t.data[i].harmonized[j] ?? 0 })
    overview.set(key, (overview.get(key) ?? 0) + sum / 23)
  })
}
writeFileSync(OUT + 'overview.json', JSON.stringify({
  grid_deg: OV,
  metric: 'Mean hotspots per year, 2003-2025, harmonized (MOCK)',
  cells: [...overview].map(([id, v]) => { const c = cellCentre(id, OV); return [c.lat, c.lon, Math.round(v)] }),
}))

// Reported fires on the ground: MOCK monthly series for the UK preset only.
const ukSeason = REGIONS[1].season
writeFileSync(OUT + 'reported.json', JSON.stringify({
  mock: true,
  series: [{
    preset_id: 'uk', label: 'Outdoor fires attended by fire services (MOCK)',
    source: 'MOCK. Replace with a real published statistic, e.g. Home Office FIRE0802 / StatsWales.',
    licence: 'n/a (mock)', url: 'https://www.gov.uk/government/statistical-data-sets/fire-statistics-data-tables',
    unit: 'fires attended', first_month: '2010-04',
    values: monthRange('2010-04', '2026-09').map((ym) => {
      const { year, month } = parseYm(ym)
      const ev = (REGIONS[1].events[String(year)] ?? 1)
      return Math.round(2500 * (0.4 + ukSeason[month - 1]) * Math.sqrt(ev) * Math.exp(gauss() * 0.15))
    }),
  }],
}))

writeFileSync(OUT + 'manifest.json', JSON.stringify({
  schema_version: 1,
  mock: true,
  dataset_name: 'Mock sample for app testing (synthetic)',
  grid_deg: GRID,
  tile_deg: TILE,
  first_month: FIRST,
  last_month: LAST,
  month_to_date: true,
  nrt_from: '2026-07',
  baseline_years: [2003, 2025],
  harmonized_coverage: [FIRST, LAST],
  sensors: SENSORS,
  coverage: REGIONS.map((r) => r.bbox),
  filters: { type: [0], modis_confidence_min: 30, viirs_confidence: ['n', 'h'] },
  method: { name: 'MOCK: synthetic values, not a harmonization method', version: '0', reference_scale: 'VIIRS 375 m', fit_years: null, test_years: null },
  validation: { metric: 'n/a (mock)', value: null, notes: 'Mock data has no validation.' },
  generated_at: new Date(Date.UTC(2026, 10, 14, 15, 0, 0)).toISOString(),
  tiles: [...tiles.keys()].sort(),
  presets: REGIONS.map((r) => ({ id: r.id, name: r.name, bbox: r.bbox })),
}, null, 2))

console.log(`Mock data: ${tiles.size} tiles, ${[...tiles.values()].reduce((a, t) => a + t.cells.length, 0)} cells, ${months.length} months -> ${OUT}`)
void formatYm
