// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Writes public/data/real/detections/ from Andrea's cleaned detections (detections_clean.parquet, pipeline step 10):
// one compact file per region and year, plus index.json. Raw detections at native pixel size, not harmonized.
//
//   npm run import-detections -- --parquet <path to detections_clean.parquet>
//
// Optional: --out <folder>   (default public/data/real/detections)
// The manifest's last_day (public/data/real/manifest.json) is the cut-off: later rows are an incomplete day.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'
import { countBySatellite, encodeRegionYear, groupRows, keepRow, SATELLITES, type DetectionRow } from './detections-lib.ts'

const root = fileURLToPath(new URL('../', import.meta.url)) // not .pathname: the repo path contains a space
const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])
const parquet = args.get('parquet')
if (!parquet) {
  console.error('Usage: npm run import-detections -- --parquet <detections_clean.parquet> [--out <folder>]')
  process.exit(1)
}
const out = args.get('out') ?? join(root, 'public/data/real/detections')
const manifest = JSON.parse(readFileSync(join(root, 'public/data/real/manifest.json'), 'utf8')) as { last_day: string }

const COLUMNS = ['latitude', 'longitude', 'scan', 'track', 'satellite', 'frp', 'date_local', 'daynight', 'region']
const file = await asyncBufferFromFile(parquet)
const all = (await parquetReadObjects({ file, columns: COLUMNS })) as unknown as DetectionRow[]
const rows = all.filter((r) => keepRow(r, manifest.last_day))
console.log(`Read ${all.length.toLocaleString('en-GB')} detections; ${(all.length - rows.length).toLocaleString('en-GB')} dated after ${manifest.last_day} dropped.`)

rmSync(out, { recursive: true, force: true })
const index: { schema_version: 1; last_day: string; satellites: readonly string[]; regions: Record<string, Record<string, [number, number, number]>> } = {
  schema_version: 1, last_day: manifest.last_day, satellites: SATELLITES, regions: {},
}
const totals: [number, number, number] = [0, 0, 0]
for (const [region, byYear] of [...groupRows(rows)].sort(([a], [b]) => a.localeCompare(b))) {
  mkdirSync(join(out, region), { recursive: true })
  index.regions[region] = {}
  for (const [year, list] of [...byYear].sort(([a], [b]) => a - b)) {
    const enc = encodeRegionYear(region, year, list)
    writeFileSync(join(out, region, `${year}.json`), JSON.stringify(enc))
    const c = countBySatellite(enc)
    index.regions[region][String(year)] = c
    c.forEach((n, i) => { totals[i] += n })
  }
}
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1))
console.log('Detections written per satellite:', SATELLITES.map((s, i) => `${s} ${totals[i].toLocaleString('en-GB')}`).join(', '))
console.log(`Files: ${Object.values(index.regions).reduce((a, r) => a + Object.keys(r).length, 0)} region-years in ${out}`)
