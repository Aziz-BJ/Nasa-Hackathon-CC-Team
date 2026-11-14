// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Build guard (HANDOVER.md 7.5): a production build must never ship mock data.
//   node scripts/check-data.mjs pre   -> fail if the chosen dataset is mock, unless ALLOW_MOCK=1
//   node scripts/check-data.mjs post  -> remove dist/data/_mock from real builds
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dataset = process.env.VITE_DATASET ?? '_mock'
const allowMock = process.env.ALLOW_MOCK === '1'
const root = fileURLToPath(new URL('../', import.meta.url)) // not .pathname: the repo path contains a space

if (process.argv[2] === 'post') {
  if (!allowMock && existsSync(`${root}dist/data/_mock`)) {
    rmSync(`${root}dist/data/_mock`, { recursive: true, force: true })
    console.log('Removed dist/data/_mock from the production build.')
  }
  process.exit(0)
}

const path = `${root}public/data/${dataset}/manifest.json`
let manifest
try {
  manifest = JSON.parse(readFileSync(path, 'utf8'))
} catch {
  console.error(`Build stopped: no readable manifest at public/data/${dataset}/manifest.json`)
  process.exit(1)
}
if (manifest.mock === true && !allowMock) {
  console.error(`Build stopped: dataset "${dataset}" is MOCK DATA. Set VITE_DATASET to the real dataset, or run "npm run build:demo" for a labelled demo.`)
  process.exit(1)
}
console.log(`Data check passed: "${dataset}" (${manifest.mock ? 'mock, demo build with banner' : 'real data'}).`)
