// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { AreaSeries } from './aggregate'
import type { Area } from './area'
import { parseYm } from './months'
import { monthStatus, sensorsIn } from './status'
import type { Manifest } from './types'

const cell = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(v * 10) / 10))
const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export const CSV_COLUMNS = [
  'year', 'month', 'hotspots_harmonized', 'harmonized_low', 'harmonized_high',
  'modis', 'viirs_snpp', 'viirs_noaa20', 'data_status', 'sensors',
] as const

export function buildCsv(m: Manifest, area: Area, series: AreaSeries, i0: number, i1: number, generatedAt = new Date()): string {
  const [w, s, e, n] = area.bbox.map((x) => Math.round(x * 1000) / 1000)
  const header = [
    `# MODIS + VIIRS harmonized hotspot calendar export`,
    `# Area: ${area.label} (bbox W ${w}, S ${s}, E ${e}, N ${n}; ${Math.round(area.areaKm2).toLocaleString('en-GB')} km²)`,
    `# Grid: ${m.grid_deg} degree cells, counted when the cell centre is inside the area`,
    `# Months: ${series.months[i0]} to ${series.months[i1]} (UTC)`,
    `# Products: ${m.sensors.map((x) => `${x.label} v${x.version} (${x.source}, ${x.first_month} to ${x.last_month})`).join('; ')}`,
    `# Filters: type in [${m.filters.type.join(', ')}]; MODIS confidence >= ${m.filters.modis_confidence_min}; VIIRS confidence in [${m.filters.viirs_confidence.join(', ')}]`,
    `# Baseline years: ${m.baseline_years[0]}-${m.baseline_years[1]}`,
    `# Harmonization: ${m.method.name} v${m.method.version}, reference scale ${m.method.reference_scale}`,
    `# Near-real-time (provisional) from: ${m.nrt_from}`,
    `# Dataset: ${m.dataset_name}${m.mock ? ' (MOCK DATA, NOT REAL)' : ''}; generated ${m.generated_at}; exported ${generatedAt.toISOString()}`,
    `# Counts are satellite hotspot detections, not fires or burned area. Times UTC. Source: NASA FIRMS.`,
  ]
  const rows = [CSV_COLUMNS.join(',')]
  for (let i = i0; i <= i1; i++) {
    const ym = series.months[i]
    const { year, month } = parseYm(ym)
    rows.push([
      String(year), String(month),
      cell(series.values.harmonized[i]), cell(series.low?.[i]), cell(series.high?.[i]),
      cell(series.values.modis[i]), cell(series.values.viirs_snpp[i]), cell(series.values.viirs_noaa20[i]),
      monthStatus(m, ym), quote(sensorsIn(m, ym).map((x) => x.label).join(' + ')),
    ].join(','))
  }
  return [...header, ...rows].join('\n') + '\n'
}

export function csvFilename(area: Area, first: string, last: string): string {
  const slug = area.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `hotspots_${slug}_${first}_${last}.csv`
}
