// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Writes public/data/<name>/ (contract version 2) from the team's pipeline outputs.
//
//   npm run import-data -- --cells <path to Andrea's cell_days.csv>
//
// Optional: --pipeline <Pierre's output folder>   (default ../pipeline/harmonized_outputs_REAL)
//           --outlines <region outline GeoJSON>    (default ../pipeline/region_outlines/region_outlines_all_four_regions.geojson)
//           --out <folder>                         (default public/data/real)
// Stops with an error if anything does not add up (see the checks at the end).
import { area as turfArea } from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { accumulate, makeWeight, monthsBetween, parseCsv, round, simplifyGeometry, type Row } from './import-lib.ts'

const root = fileURLToPath(new URL('../', import.meta.url)) // not .pathname: the repo path contains a space
const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])
const cellsPath = args.get('cells')
if (!cellsPath) {
  console.error('Usage: npm run import-data -- --cells <cell_days.csv> [--pipeline <folder>] [--outlines <geojson>] [--out <folder>]')
  process.exit(1)
}
const pipeline = args.get('pipeline') ?? join(root, '../pipeline/harmonized_outputs_REAL')
const outlinesPath = args.get('outlines') ?? join(root, '../pipeline/region_outlines/region_outlines_all_four_regions.geojson')
const out = args.get('out') ?? join(root, 'public/data/real')

const REGIONS: { id: string; name: string }[] = [
  { id: 'italy_mainland', name: 'Mainland Italy' },
  { id: 'sicily', name: 'Sicily' },
  { id: 'sardinia', name: 'Sardinia' },
  { id: 'california', name: 'California' },
]
const read = (f: string) => parseCsv(readFileSync(join(pipeline, f), 'utf8'))
const problems: string[] = []
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg) }

// ---- Pierre's monthly record
const monthly = read('harmonized_monthly.csv')
const months = monthsBetween(
  monthly.map((r) => r.ym).reduce((a, b) => (a < b ? a : b)),
  monthly.map((r) => r.ym).reduce((a, b) => (a > b ? a : b)),
)
const byRegion = new Map<string, Map<string, Row>>()
for (const r of monthly) {
  if (!byRegion.has(r.region)) byRegion.set(r.region, new Map())
  byRegion.get(r.region)!.set(r.ym, r)
}
check(byRegion.size === REGIONS.length && REGIONS.every((g) => byRegion.has(g.id)),
  `harmonized_monthly.csv regions are ${[...byRegion.keys()].join(', ')}`)
for (const g of REGIONS) {
  const rows = byRegion.get(g.id)
  check(!!rows && months.every((ym) => rows.has(ym)), `${g.id}: missing months in harmonized_monthly.csv`)
  for (const r of rows?.values() ?? []) {
    const [h, lo, hi] = [Number(r.H), Number(r.H_pred_lo), Number(r.H_pred_hi)]
    // H is the expected count; the range is for the count itself (whole numbers), so a mean below 1 can sit above 0-0.
    check(lo <= h + 1e-9 && h < hi + 1, `${g.id} ${r.ym}: H ${h} outside its range ${lo}-${hi}`)
    check(r.partial_month === 'False' || r.ym === months[months.length - 1], `${g.id} ${r.ym}: partial month that is not the last one`)
  }
}
const lastRow = byRegion.get(REGIONS[0].id)!.get(months[months.length - 1])!
const monthToDate = lastRow.partial_month === 'True'

// The days each satellite contributes are set day by day for all regions at once, so they must agree.
const days = { aqua: [] as number[], snpp: [] as number[], noaa20: [] as number[], none: [] as number[] }
for (const ym of months) {
  const rs = REGIONS.map((g) => byRegion.get(g.id)!.get(ym)!)
  const key = (r: Row) => [r.days_aqua, r.days_snpp, r.days_noaa20, r.days_none].join(',')
  check(rs.every((r) => key(r) === key(rs[0])), `${ym}: days by source differ between regions`)
  days.aqua.push(Number(rs[0].days_aqua))
  days.snpp.push(Number(rs[0].days_snpp))
  days.noaa20.push(Number(rs[0].days_noaa20))
  days.none.push(Number(rs[0].days_none))
}

// ---- Month to date (1..N of the last month in every year)
const missing = new Set(read('missing_days.csv').map((r) => `${r.satellite} ${r.date}`))
const mtdRows = monthToDate ? read('current_month_to_date.csv') : []
const lastYm = months[months.length - 1]
const daysInLast = days.aqua.at(-1)! + days.snpp.at(-1)! + days.noaa20.at(-1)! + days.none.at(-1)!
const lastDay = `${lastYm}-${String(daysInLast).padStart(2, '0')}`
const mtdYears = [...new Set(mtdRows.map((r) => Number(r.year)))].sort((a, b) => a - b)

// ---- Andrea's cells
const weight = makeWeight(read('factors.csv'))
const text = readFileSync(cellsPath, 'utf8')
function* cellRows(): Generator<Row> {
  let start = text.indexOf('\n') + 1
  const head = text.slice(0, start - 1).trim().split(',')
  while (start < text.length) {
    let end = text.indexOf('\n', start)
    if (end < 0) end = text.length
    const line = text.slice(start, end).trim()
    start = end + 1
    if (!line) continue
    const v = line.split(',')
    yield Object.fromEntries(head.map((h, i) => [h, v[i]]))
  }
}
const acc = accumulate(cellRows(), {
  months, lastDay, missing, weight,
  mtd: monthToDate ? { month: Number(lastYm.slice(5, 7)), day: daysInLast } : null,
})

// Scale each region-month so its cells add up to Pierre's H (this carries his fire-size term).
const scale = new Map<string, number>()
let exactMeasured = 0
let measuredMonths = 0
for (const g of REGIONS) {
  months.forEach((ym, i) => {
    const r = byRegion.get(g.id)!.get(ym)!
    const H = Number(r.H)
    const W = acc.regionW.get(`${g.id}|${i}`) ?? 0
    if (W === 0) check(H === 0, `${g.id} ${ym}: H is ${H} but no source cell-days were found`)
    scale.set(`${g.id}|${i}`, W > 0 ? H / W : 0)
    const measured = r.measured_aqua !== '' && r.snpp_used === '' && r.noaa20_used === ''
    if (measured) {
      measuredMonths++
      if (Math.abs(W - H) < 1e-9) exactMeasured++
      else problems.push(`${g.id} ${ym}: measured month rebuilt as ${W}, H is ${H}`)
    }
  })
}
const mtdScale = new Map<string, number>()
for (const r of mtdRows) {
  const W = acc.regionMtdW.get(`${r.region}|${r.year}`) ?? 0
  const H = Number(r.H)
  if (W === 0) check(H === 0, `${r.region} ${r.ym} month to date: H is ${H} but no source cell-days`)
  mtdScale.set(`${r.region}|${r.year}`, W > 0 ? H / W : 0)
}

// Raw counts per satellite must equal Pierre's in every region-month.
const rawSum = new Map<string, [number, number, number]>()
for (const [key, e] of acc.months) {
  const [cell, i] = key.split('|')
  const k = `${acc.cells.get(cell)!.region}|${i}`
  const s = rawSum.get(k) ?? [0, 0, 0]
  s[0] += e[1]; s[1] += e[2]; s[2] += e[3]
  rawSum.set(k, s)
}
let rawOk = 0
for (const g of REGIONS) {
  months.forEach((ym, i) => {
    const r = byRegion.get(g.id)!.get(ym)!
    const [a, s, n] = rawSum.get(`${g.id}|${i}`) ?? [0, 0, 0]
    if (a === Number(r.raw_aqua) && s === Number(r.raw_snpp) && n === Number(r.raw_noaa20)) rawOk++
    else problems.push(`${g.id} ${ym}: raw counts ${a}/${s}/${n}, Pierre has ${r.raw_aqua}/${r.raw_snpp}/${r.raw_noaa20}`)
  })
}

if (problems.length) {
  console.error(`Import stopped, ${problems.length} problem(s):\n  ${problems.slice(0, 20).join('\n  ')}`)
  process.exit(1)
}

// ---- Write
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'cells'), { recursive: true })
const write = (f: string, data: unknown) => writeFileSync(join(out, f), JSON.stringify(data))

const SENSOR_START: Record<string, string> = { modis: '2002-07', viirs_snpp: '2012-01', viirs_noaa20: '2018-04' }
const nullBefore = (key: string, values: number[]) => months.map((ym, i) => (ym < SENSOR_START[key] ? null : values[i]))
const series: Record<string, unknown> = {}
for (const g of REGIONS) {
  const rows = months.map((ym) => byRegion.get(g.id)!.get(ym)!)
  series[g.id] = {
    harmonized: rows.map((r) => round(Number(r.H), 4)),
    low: rows.map((r) => round(Number(r.H_pred_lo), 4)),
    high: rows.map((r) => round(Number(r.H_pred_hi), 4)),
    modis: nullBefore('modis', rows.map((r) => Number(r.raw_aqua))),
    viirs_snpp: nullBefore('viirs_snpp', rows.map((r) => Number(r.raw_snpp))),
    viirs_noaa20: nullBefore('viirs_noaa20', rows.map((r) => Number(r.raw_noaa20))),
  }
}
const mtd = monthToDate ? {
  month: lastYm,
  day: daysInLast,
  years: mtdYears,
  series: Object.fromEntries(REGIONS.map((g) => {
    const rows = mtdYears.map((y) => mtdRows.find((r) => r.region === g.id && Number(r.year) === y)!)
    return [g.id, {
      values: rows.map((r) => round(Number(r.H), 4)),
      low: rows.map((r) => round(Number(r.H_pred_lo), 4)),
      high: rows.map((r) => round(Number(r.H_pred_hi), 4)),
    }]
  })),
} : null
const factors: Record<string, unknown[]> = {}
for (const r of read('factors.csv')) {
  const model = r.model === 'SNPP->AQUA' ? 'snpp_to_aqua' : r.model === 'NOAA20->SNPP' ? 'noaa20_to_snpp' : 'noaa20_to_aqua'
  ;(factors[r.region] ??= []).push({
    model, season: r.season, daynight: r.daynight,
    factor: round(Number(r.factor), 4), low: round(Number(r.factor_lo90), 4), high: round(Number(r.factor_hi90), 4),
  })
}
write('regions.json', { series, mtd, factors })

// Outlines: Andrea's land outlines (the "kind: land" features), simplified for the web.
const outlineSrc = JSON.parse(readFileSync(outlinesPath, 'utf8')) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>
const outlines: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> = {
  type: 'FeatureCollection',
  features: REGIONS.map((g) => {
    const f = outlineSrc.features.find((x) => x.properties?.region === g.id && x.properties?.kind === 'land')
    if (!f) throw new Error(`No land outline for ${g.id} in ${outlinesPath}`)
    return { type: 'Feature', properties: { id: g.id, name: g.name }, geometry: simplifyGeometry(f.geometry, 0.004) }
  }),
}
writeFileSync(join(out, 'outlines.json'), JSON.stringify(outlines))

// Cells: one file per region. entries = [cell, month, harmonized, aqua, snpp, noaa20] repeated, sorted by cell then month.
const cellCount: Record<string, number> = {}
for (const g of REGIONS) {
  const ids = [...acc.cells.entries()].filter(([, c]) => c.region === g.id).map(([id]) => id).sort()
  const index = new Map(ids.map((id, i) => [id, i]))
  const perCell: number[][] = ids.map(() => [])
  for (const [key, e] of acc.months) {
    const [cell, iStr] = key.split('|')
    const ci = index.get(cell)
    if (ci === undefined) continue
    const i = Number(iStr)
    perCell[ci].push(i, round(e[0] * scale.get(`${g.id}|${i}`)!, 4), e[1], e[2], e[3])
  }
  const entries: number[] = []
  perCell.forEach((list, ci) => {
    const rows: number[][] = []
    for (let k = 0; k < list.length; k += 5) rows.push(list.slice(k, k + 5))
    rows.sort((a, b) => a[0] - b[0]).forEach((r) => entries.push(ci, ...r))
  })
  const mtdEntries: number[] = []
  for (const [key, w] of acc.mtd) {
    const [cell, year] = key.split('|')
    const ci = index.get(cell)
    const yi = mtdYears.indexOf(Number(year))
    if (ci === undefined || yi < 0) continue
    mtdEntries.push(ci, yi, round(w * (mtdScale.get(`${g.id}|${year}`) ?? 0), 4))
  }
  cellCount[g.id] = ids.length
  write(`cells/${g.id}.json`, {
    region: g.id,
    cells: ids.map((id) => { const c = acc.cells.get(id)!; return [id, round(c.lat, 5), round(c.lon, 5)] }),
    entries,
    mtd: mtdEntries,
  })
}

const loyo = read('validation_loyo.csv')
const loyoAll = (method: string) => loyo.find((r) => r.method === method && r.region === 'ALL')!
const seams = read('validation_seams.csv').filter((r) => r.kind.startsWith('real seam') && r.region === 'ALL')
const chain = read('validation_chain_stress.csv').find((r) => r.region === 'ALL')!
const full = loyoAll('FULL MODEL')
write('manifest.json', {
  schema_version: 2,
  mock: false,
  dataset_name: `Harmonized MODIS + VIIRS fire record, ${REGIONS.map((g) => g.name).join(', ')} (data to ${lastDay})`,
  first_month: months[0],
  last_month: lastYm,
  month_to_date: monthToDate,
  last_day: lastDay,
  nrt_from: '2026-08',
  baseline_years: [2003, 2025],
  harmonized_coverage: [months[0], lastYm],
  unit: 'fire cell-days',
  cell_km: 5,
  sensors: [
    { key: 'modis', label: 'Aqua MODIS', source: 'NASA FIRMS MODIS Collection 6.1 (Aqua only)', version: '6.1', first_month: SENSOR_START.modis, last_month: lastYm },
    { key: 'viirs_snpp', label: 'Suomi NPP VIIRS', source: 'NASA FIRMS VIIRS 375 m (S-NPP)', version: '2', first_month: SENSOR_START.viirs_snpp, last_month: lastYm },
    { key: 'viirs_noaa20', label: 'NOAA-20 VIIRS', source: 'NASA FIRMS VIIRS 375 m (NOAA-20)', version: '2', first_month: SENSOR_START.viirs_noaa20, last_month: lastYm },
  ],
  days,
  regions: REGIONS.map((g) => {
    const f = outlines.features.find((x) => x.properties?.id === g.id)!
    return { ...g, bbox: turfBbox(f).map((x) => round(x, 4)), area_km2: Math.round(turfArea(f) / 1e6), cells: cellCount[g.id] }
  }),
  groups: [{ id: 'italy', name: 'All of Italy', regions: ['italy_mainland', 'sicily', 'sardinia'] }],
  method: {
    name: 'Calibrated conversion to the Aqua MODIS scale',
    version: 'REAL run, 15 Nov 2026',
    reference_scale: 'Aqua MODIS fire cell-days at the nominal 13:30 / 01:30 orbit',
    fit_window: 'S-NPP to Aqua: 20 Jan 2012 to 30 Jun 2021; NOAA-20 to S-NPP: 1 Apr 2018 to 1 Nov 2026',
  },
  validation: {
    loyo_male_naive: round(Number(loyoAll('naive (no correction)').MALE), 3),
    loyo_male: round(Number(full.MALE), 3),
    loyo_r2: round(Number(full.R2), 3),
    coverage90: round(Number(full.coverage90), 3),
    seams: seams.map((r) => ({ seam: r.seam, step_pct: round(Number(r.step_pct), 1), lo90_pct: round(Number(r.lo90_pct), 1), hi90_pct: round(Number(r.hi90_pct), 1), no_step: r.no_step === 'True' })),
    chain_ratio: round(Number(chain.total_ratio_chain_over_snpp), 3),
  },
  generated_at: new Date().toISOString(),
})

console.log(`Wrote ${out}
  ${months.length} months (${months[0]} to ${lastYm}${monthToDate ? `, to ${lastDay}` : ''}), ${REGIONS.length} regions, ${acc.cells.size} fire cells
  measured months rebuilt exactly: ${exactMeasured} of ${measuredMonths}
  raw counts per satellite equal Pierre's: ${rawOk} of ${REGIONS.length * months.length} region-months`)
