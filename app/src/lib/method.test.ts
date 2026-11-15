// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The app's statistics must reproduce Pierre's calendar_anomalies.csv from his harmonized_monthly.csv.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCsv, type Row } from '../../scripts/import-lib'
import { summarizeMonth, summarizeMtd } from './indices'
import { monthRange } from './months'

// Not `new URL(template, import.meta.url)`: Vite would treat that as an asset reference. The repo path has a space.
const HERE = dirname(fileURLToPath(import.meta.url))
const read = (name: string): Row[] =>
  parseCsv(readFileSync(resolve(HERE, '../../../pipeline/harmonized_outputs_REAL', name), 'utf8'))

const monthly = read('harmonized_monthly.csv')
const anomalies = read('calendar_anomalies.csv')
const mtdRows = read('current_month_to_date.csv')

const months = monthRange('2002-07', '2026-11')
const REGIONS = ['italy_mainland', 'sicily', 'sardinia', 'california']
const BASELINE: [number, number] = [2003, 2025]

const series = (region: string): number[] => {
  const byMonth = new Map(monthly.filter((r) => r.region === region).map((r) => [r.ym, Number(r.H)]))
  return months.map((ym) => {
    const v = byMonth.get(ym)
    if (v === undefined) throw new Error(`${region} ${ym} missing from harmonized_monthly.csv`)
    return v
  })
}
const nanToNull = (s: string) => (s === '' || s.toLowerCase() === 'nan' ? null : Number(s))
const close = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) <= 1e-6)

describe("the app reproduces Pierre's calendar statistics", () => {
  it('has the 4 regions x 293 months the checks assume', () => {
    expect(monthly).toHaveLength(REGIONS.length * months.length)
  })

  it('matches baseline median, delta %, robust z and percentile for all 1,168 calendar rows', () => {
    const bySeries = new Map(REGIONS.map((r) => [r, series(r)]))
    let compared = 0
    const problems: string[] = []
    for (const row of anomalies) {
      const ym = `${row.year}-${row.month.padStart(2, '0')}`
      const s = summarizeMonth(bySeries.get(row.region)!, months, ym, BASELINE)
      const exp = { median: Number(row.baseline_median), delta: nanToNull(row.delta_pct), z: nanToNull(row.robust_z), pct: Number(row.percentile) }
      if (!close(s.baseline?.median ?? null, exp.median)) problems.push(`${row.region} ${ym} median ${s.baseline?.median} vs ${exp.median}`)
      if (!close(s.deltaPct, exp.delta)) problems.push(`${row.region} ${ym} delta ${s.deltaPct} vs ${exp.delta}`)
      if (!close(s.z, exp.z)) problems.push(`${row.region} ${ym} z ${s.z} vs ${exp.z}`)
      if (!close(s.percentile, exp.pct)) problems.push(`${row.region} ${ym} percentile ${s.percentile} vs ${exp.pct}`)
      compared++
    }
    expect(problems.slice(0, 5)).toEqual([])
    expect(compared).toBe(1168)
  })

  it('never uses the month itself in its own baseline (22 other years for 2003-2025)', () => {
    const s = summarizeMonth(series('sardinia'), months, '2021-07', BASELINE)
    expect(s.baseline?.years).toHaveLength(22)
    expect(s.baseline?.years).not.toContain(2021)
  })

  it('compares the unfinished month with exactly 2003-2025 of the same days', () => {
    for (const region of REGIONS) {
      const rows = mtdRows.filter((r) => r.region === region)
      const mtd = { years: rows.map((r) => Number(r.year)), values: rows.map((r) => Number(r.H)) }
      const s = summarizeMtd(mtd, '2026-11', BASELINE)
      const expected = rows.filter((r) => Number(r.year) >= 2003 && Number(r.year) <= 2025).map((r) => Number(r.H))
      expect(s.baseline?.values).toEqual(expected)
      expect(s.baseline?.years).toHaveLength(23)
      expect(s.value).toBe(Number(rows.find((r) => r.year === '2026')!.H))
    }
  })
})
