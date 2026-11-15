// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { AreaSeries } from './aggregate'
import type { Area } from './area'
import { summarizeMonth, summarizeMtd } from './indices'
import { parseYm } from './months'
import { monthIndex, monthStatus, sourceCode } from './status'
import type { Manifest } from './types'

const num = (v: number | null | undefined, d: number) => (v === null || v === undefined || !Number.isFinite(v) ? '' : String(Math.round(v * 10 ** d) / 10 ** d))

export const CSV_COLUMNS = [
  'year', 'month', 'fire_cell_days_harmonized', 'low_90', 'high_90', 'source',
  'aqua_modis_raw', 'snpp_viirs_raw', 'noaa20_viirs_raw', 'days_without_satellite', 'data_status',
  'baseline_median', 'delta_pct', 'robust_z', 'percentile',
] as const

export function buildCsv(m: Manifest, area: Area, series: AreaSeries, i0: number, i1: number, generatedAt = new Date()): string {
  const [w, s, e, n] = area.bbox.map((x) => Math.round(x * 1000) / 1000)
  const [y0, y1] = m.baseline_years
  const v = m.validation
  const header = [
    `# Harmonized MODIS + VIIRS fire record: monthly export`,
    `# Area: ${area.label} (${Math.round(area.areaKm2).toLocaleString('en-GB')} km²; bbox W ${w}, S ${s}, E ${e}, N ${n})`,
    area.regionIds
      ? `# Numbers: the team's harmonized record for ${area.regionIds.length > 1 ? 'these regions, added together' : 'this region'}.`
        + (series.bandSummed ? ' low_90/high_90 add the regions\' 90% ranges, so they are wider than the true range.' : '')
      : `# Numbers: sum of the ${m.cell_km} km fire cells whose centre is inside the area. The harmonized column is an estimate`
        + ' (the region\'s conversion applied to part of it) and has no 90% range. Raw sensor columns are exact.',
    `# Unit: ${m.unit} = ${m.cell_km} km cells with at least one fire detection in a day or night pass, on the scale of ${m.method.reference_scale}.`,
    `# Months: ${series.months[i0]} to ${series.months[i1]}. Days are local solar days.`,
    `# Method: ${m.method.name} (${m.method.version}). Calibration windows: ${m.method.fit_window}.`,
    `# Validation (leave-one-year-out, monthly regional totals): mean absolute log error ${v.loyo_male} (no correction: ${v.loyo_male_naive}), R² ${v.loyo_r2}, ${Math.round(v.coverage90 * 100)}% inside the 90% range.`,
    `# Source column: measured_aqua (Aqua MODIS, to June 2021), converted_snpp, converted_noaa20, or mixed (days from several satellites; see days per source in the app).`,
    `# Comparisons: same calendar month in ${y0}-${y1}, leaving out the month's own year. delta_pct = 100 * (value - median) / median (empty when the median is 0); robust_z = (value - median) / (1.4826 * MAD); percentile = share of baseline years at or below the value.`,
    `# Products: ${m.sensors.map((x) => `${x.label} (${x.source}, from ${x.first_month})`).join('; ')}. Near-real-time (provisional) from ${m.nrt_from}.`,
    `# Dataset: ${m.dataset_name}${m.mock ? ' (MOCK DATA, NOT REAL)' : ''}; generated ${m.generated_at}; exported ${generatedAt.toISOString()}.`,
    `# Fire cell-days count satellite detections, not fires or burned area; zero detections is not "no fire" (cloud, smoke, gaps). Source: NASA FIRMS.`,
  ]
  const last = series.months[i1]
  if (m.month_to_date && last === m.last_month && series.mtd) {
    const t = summarizeMtd(series.mtd, last, m.baseline_years)
    const day = Number(m.last_day.slice(8, 10))
    header.push(`# ${last} is not finished (data to ${m.last_day}). Days 1-${day} against the same days in ${y0}-${y1}: `
      + `${num(t.value, 2)} vs median ${num(t.baseline?.median, 2)}, percentile ${num(t.percentile, 1)}. Full-month comparisons are left empty for this month.`)
  }
  const rows = [CSV_COLUMNS.join(',')]
  const h = series.values.harmonized
  for (let i = i0; i <= i1; i++) {
    const ym = series.months[i]
    const { year, month } = parseYm(ym)
    const status = monthStatus(m, ym)
    const sum = status === 'partial' ? null : summarizeMonth(h, series.months, ym, m.baseline_years)
    rows.push([
      String(year), String(month),
      num(h[i], 2), num(series.low?.[i], 2), num(series.high?.[i], 2), sourceCode(m, ym),
      num(series.values.modis[i], 0), num(series.values.viirs_snpp[i], 0), num(series.values.viirs_noaa20[i], 0),
      String(m.days.none[monthIndex(m, ym)] ?? ''), status,
      num(sum?.baseline?.median, 2), num(sum?.deltaPct, 1), num(sum?.z, 2), num(sum?.percentile, 1),
    ].join(','))
  }
  return [...header, ...rows].join('\n') + '\n'
}

export function csvFilename(area: Area, first: string, last: string): string {
  const slug = area.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `fire-cell-days_${slug}_${first}_${last}.csv`
}
