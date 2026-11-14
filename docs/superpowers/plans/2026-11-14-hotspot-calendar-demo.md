# Hotspot Calendar Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete MODIS + VIIRS hotspot web app in `demo/`, running on small synthetic data, so every feature is built and tested exactly as it will ship once Andre's and Pierre's real files arrive.

**Architecture:** Static React single-page app (no backend). The pipeline's output is read through one adapter (`src/lib/data.ts`) from 10° tile files, so any area drawn anywhere on the globe loads only the tiles it touches. All statistics are pure, unit-tested functions in `src/lib/`. UI components only display. A build guard stops a production build that would ship mock data.

**Tech Stack:** Vite 8, React 19, TypeScript 7, MapLibre GL JS 6 (globe projection) with NASA GIBS imagery, Terra Draw 1.39 (drawing), Observable Plot 0.6 (charts), d3-scale-chromatic (accessible ramps), Turf 7 (geometry), Vitest 5 + Testing Library (unit), Playwright 1.65 + axe-core (end-to-end and accessibility).

---

## 0. Read this first

**Where things live.** The repository root is `/Users/azizbenjilani/Nasa ` (**the folder name ends with a space**, so always quote it). The app is built in `demo/`. Every command below runs inside `demo/` unless it says otherwise.

**The demo is the real app.** Only the data differs. The same code ships when real data arrives: Checkpoint 6 changes one setting (`VITE_DATASET`), tunes the colour bins and replaces the presets. Mock data is generated on demand into `demo/public/data/_mock/`, is never committed, and is labelled everywhere (red banner, CSV header, manifest `"mock": true`). A production build refuses to run on it.

**Rules carried over from HANDOVER.md section 0** (they bind every task):
- Every file written with AI help starts with `// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.` (CSS: `/* … */`). Every code block in this plan already has it.
- Log each checkpoint in `docs/AI_USE.md`. Cite every library and dataset in `docs/REFERENCES.md` (Task 24).
- The harmonization method is Pierre's. Nothing here computes or proposes one. The mock "harmonized" numbers are an invented latent signal, labelled as such.
- No NASA logos, no Space Apps logo (it contains NASA branding), no names or images of team members. English only.
- Ask Aziz before adding a backend, a paid service, a login, analytics, or a non-OSI dependency.
- Commits made by Claude end with the `Co-Authored-By` line from the session instructions.

**What was already proven on 14 Nov 2026 (throwaway spike).** Every code block below was typechecked with `tsc -b` (strict) and run:
- 60 unit tests and 17 Playwright tests (desktop and phone, including axe accessibility) pass.
- MapLibre 6 globe + NASA GIBS Blue Marble tiles + Terra Draw circle drawing work in dev, in the production build, and in headless Chromium.
- Pitfalls already solved, so don't "fix" them back:
  1. `maplibre-gl` 6 has **no default export**: use `import { Map } from 'maplibre-gl'`.
  2. MapLibre 6 loads its web worker relative to its own file, and Vite breaks that path in dev and in builds. Fixed with `setWorkerUrl(workerUrl)` and `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` (in `GlobeMap.tsx`).
  3. NASA GIBS reference-label tiles sometimes return HTTP 500. MapLibre skips them; we only log them.
  4. An `<option>` text, or "Median 2003–2025", can match a test locator. The tests use exact or scoped locators.
  5. White text on mid-tone ramp colours fails 4.5:1. The calendar picks black or white text by WCAG contrast, which always gives at least 4.58:1.
  6. A month-to-date total is not comparable with full months. The default range therefore ends at the last *complete* month.
  7. The repo path contains a space. Scripts turn `import.meta.url` into a path with `fileURLToPath`, never `URL.pathname` (which leaves `%20` and writes to a wrong folder). Found while executing Task 8.
  8. Found by the Checkpoint 1 verifier and fixed:
     - Year to date only counts complete January-to-month spans, so the November 2000 start doesn't give a false −83%.
     - Quantile colour bins fall back to log bins when tied low counts collapse them.
     - Coverage checks points inside the drawn shape, so two adjacent coverage boxes count as covered.
     - A thin area with no cell centre falls back to its centre cell.
     - Manifest validation is stricter, and a broken `reported.json` is ignored instead of breaking the app.
     - Anomaly colour bins are symmetric.
  9. Found by the Checkpoint 2 verifier and fixed:
     - Drawn shapes follow the typed rules (`validateDrawn`): a shape crossing the 180° line is rejected instead of becoming a band around the globe, and the size limit applies.
     - The coordinate type switch uses native radio buttons (valid ARIA, arrow keys).
     - The skip link targets `#main`, which exists on both pages.
- **Background browser tabs don't render WebGL.** If the globe looks blank while you test in a hidden pane or a background tab, bring the tab to the front before debugging.

**TO CONFIRM (asks for the team, none of them block Checkpoints 1 to 5):**
1. App name. "Hotspot Calendar" is a working title (`Header.tsx`, `index.html`).
2. The tiled data contract (section 2.3, `docs/DATA_CONTRACT.md`) with Andre and Pierre.
3. Baseline years, `MIN_DENOMINATOR`, verdict thresholds (`src/config.ts`) with Pierre.
4. The source for "fires reported on the ground" (section 2.5), and which presets have it.
5. Demo regions for the real presets. The mock uses Southern Africa, the UK, Eastern Siberia and South-east Australia.
6. Hosting (Netlify, Vercel or GitHub Pages; GitHub Pages needs the repo public).

---

## 1. Objectives: "could" becomes "should"

| Challenge wording | What the app does | Where |
| --- | --- | --- |
| Interactive map to draw the area, or enter lat/long | 3D globe (Google-Maps-like zoom from globe to flat map). Draw a **circle**, rectangle, polygon or freehand lasso. Type a box (W, S, E, N, the FIRMS order) or a point + radius. Presets. | `GlobeMap`, `AreaPanel`, `CoordinateForm` |
| Accessible colour ramps | Perceptually uniform ramps (inferno default, cividis option). Blue/red diverging for anomalies (never red–green). Patterns and outlines as a second cue. Text contrast ≥ 4.5:1. Table view. | `colorScale.ts`, `BurningCalendar`, theme |
| Burning calendar | Years × months grid. Year totals bar. Baseline median row. NRT and month-to-date markers. Keyboard navigable. Numbers on demand. | `BurningCalendar` |
| Historical comparisons, anomalies against multi-year averages | Anomaly bars per month vs the multi-year **average** (default) or median. Season chart with median and 50% / 80% bands. Verdict + percentile + rank + z-score. Year to date. | `AnomalyChart`, `SeasonalChart`, `KpiRow`, `indices.ts` |
| Number of fires detected and reported | Hotspots **detected** (totals, per month, per cell). Fires **reported** on the ground next to detections, for presets with a published statistic. | `KpiRow`, `ReportedChart` |
| Select region + date range, download | Month range picker with quick ranges. CSV with a provenance header. Shareable link. | `TimeRangePicker`, `ExportButton`, `urlState.ts` |
| Raw vs harmonized (core evidence) | Toggle Harmonized / MODIS / VIIRS S-NPP / VIIRS NOAA-20. Overlap chart showing the false 2012 step in the stitched raw record. | `DisplayOptions`, `OverlapChart` |

**Easy to navigate:** a numbered left column ("1. Choose an area", "2. Choose months", "3. Display"). The globe sits beside it. Results scroll below with a sticky section menu (Summary, Calendar, Seasons, Anomalies, Sensors, Reported, Download). The first preset loads automatically, so a judge sees results immediately. A skip link and full keyboard use are included.

## 2. Key design decisions

### 2.1 Globe and drawing
MapLibre GL JS 6 with `projection: { type: 'globe' }`. At low zoom it is a globe; zooming in turns it into a flat map, like Google Maps. Imagery comes from NASA GIBS (Blue Marble day, Black Marble night lights), with GIBS reference borders and labels on top. Using GIBS adds a second NASA resource. Terra Draw draws the shapes; the circle uses `projection: 'globe'`, so circles are geodesic. Drawn shapes become an `Area` and are shown with a Neon Yellow outline. Typed coordinates are the keyboard route, so drawing is never the only way.

### 2.2 Colour ramps relative to the time range
- **Map cells:** each cell's total over the chosen months. Bins are rebuilt from those totals, so the full ramp is always used.
- **Calendar:** bins are rebuilt from the monthly values inside the chosen months (default). A "whole record" option compares against all years.
- **Method:** `RAMP = { method: 'quantile', bins: 7 }` in `src/config.ts`. Quantile bins suit skewed counts. `log` is the alternative. Zero has its own swatch, "no sensor" is hatched, and the legend prints every bin edge.
- **Tuning with real data (Checkpoint 6):** compare the bin edges for 1 month, 12 months and the whole record on two presets. Choose quantile or log and the bin count from that. Only `RAMP` changes.

### 2.3 Data contract v2: tiles (proposal; confirm with Andre and Pierre)
Same fields as HANDOVER section 7, packed so the app loads only what an area needs:
```
public/data/<dataset>/manifest.json   one file: grid, months, sensors, coverage, filters, method, presets, tile list
public/data/<dataset>/tiles/<row>_<col>.json   one 10° tile: cell ids + one array per cell per series (one value per month)
public/data/<dataset>/overview.json   coarse global layer (mean hotspots per year) for the globe
public/data/<dataset>/reported.json   optional: ground-reported fire statistics per preset
```
`null` means "sensor not operating" and 0 means "no hotspots". Cells that never burn are left out. `coverage` lists the boxes the pipeline processed, so the app can say "no data loaded here" instead of showing a false zero. `src/lib/types.ts` is the contract in code. Task 24 writes `docs/DATA_CONTRACT.md` for Andre. If real tiles exceed about 2 MB gzipped, switch the tile format inside `data.ts` only.

### 2.4 Comparisons
- **Baseline:** same calendar month over `baseline_years`, never including its own year.
- **Typical and average:** the median and the mean are both shown, because extreme years skew the mean.
- **Anomaly:** `(value − reference) / max(reference, MIN_DENOMINATOR)`.
- **Verdict:** from the percentile, with the number always next to the words.
- **Year to date:** January to the focus month, against the median of the same span.
- **z-score:** shown small, for scientists.
- **Focus month:** the end of the chosen range.

None of this is the harmonization method. These are display statistics on its output.

### 2.5 "Fires detected and reported"
Detected means FIRMS hotspots. Reported means a published count of fires attended by fire services, for example England FIRE0802 and StatsWales. It appears only for presets that have one (`reported.json`), labelled as context, with its source and licence. The mock includes a UK series marked MOCK. The real source is TO CONFIRM item 4.

### 2.6 Brand (spaceappschallenge.org/brand, read 14 Nov 2026)
- **Palette:** Deep Blue `#07173F` background, Electric Blue `#0042A6` buttons, Blue Yonder `#2E96F5` links, Neon Yellow `#EAFE07` accent only (focus ring, area outline, focus-year line), Martian Red `#8E1100` mock banner, White.
- **Header:** the brand 45° gradient from Electric Blue to Deep Blue.
- **Fonts:** Fira Sans for headings, Overpass for body (OFL, bundled via Fontsource, so there are no requests to Google Fonts).
- **Icons:** Phosphor, as the guide suggests.
- **Rules:** text stays at contrast ≥ 4.5:1. No logos.

### 2.7 Accessibility
- **Contrast:** WCAG 1.4.11 for graphics, 4.5:1 for text.
- **Second cue:** colour is never the only cue (hatching, dotted borders, outlines, line dashes and symbols).
- **Calendar:** a real `<table>` with labelled cells, arrow-key navigation and a numbers toggle.
- **Charts:** labelled figures with captions.
- **Shared links:** a hash URL restores the view.
- **Automated check:** axe runs in CI.
- **Manual checks:** colour-blind emulation and greyscale (Task 25).

## 3. File structure (all under `demo/`)

```
index.html                      title, language, no logo favicon
vite.config.ts                  build + Vitest config (base './' so any static host works)
playwright.config.ts            e2e: builds the demo, serves it, runs desktop + phone
scripts/make-mock-data.ts       deterministic synthetic data in the real format
scripts/check-data.mjs          build guard: no mock data in production builds
e2e/app.spec.ts                 end-to-end and accessibility tests
src/
  main.tsx                      fonts, theme, React root
  App.tsx                       page layout and wiring (grows at checkpoints 2, 3, 4)
  config.ts                     every tunable number (ramp, thresholds, limits)
  dataSource.ts                 which dataset folder to read
  styles/theme.css              brand tokens and layout
  test/setup.ts                 Testing Library setup
  lib/                          pure logic, unit tested
    months.ts grid.ts types.ts data.ts area.ts status.ts aggregate.ts
    indices.ts colorScale.ts contrast.ts mapFeatures.ts csv.ts
  state/appState.ts urlState.ts
  hooks/useDataset.ts useAreaData.ts
  components/
    Header Footer MockBanner AboutPage GlobeMap AreaPanel CoordinateForm Legend AreaSummary
    TimeRangePicker DisplayOptions BurningCalendar KpiRow PlotFigure SeasonalChart
    AnomalyChart OverlapChart ReportedChart ExportButton
```

## 4. Checkpoints

Each checkpoint ends with a stop: run the checks, show Aziz the result, commit and tag. Don't start the next checkpoint until Aziz says go.

| # | Name | Tasks | Aziz sees | Proof |
| --- | --- | --- | --- | --- |
| 1 | Engine | 1–8 | Tests for every number the app will show; mock files; a refused production build | `npm test` 42 pass; `npm run build` exits 1 |
| 2 | Globe and area | 9–13 | The globe; choose an area 4 ways; coloured cells; area summary | 49 pass; manual check list |
| 3 | Calendar and colour ramps | 14–16 | Month range, data toggle, burning calendar, colours that rescale | 55 pass; manual check list |
| 4 | Indices, charts, download | 17–22 | Verdict cards, season, anomaly, overlap and reported charts, CSV, share link | 55 pass; manual check list |
| 5 | Ready to publish | 23–26 | e2e + axe green on desktop and phone, docs, QA sign-off | `npm run test:e2e` 17 pass |
| 6 | Real data (after the pipeline delivers) | 27 | Same app on FIRMS data | build passes, no banner |

---

## 5. Tasks

### Checkpoint 1: Engine

### Task 1: Scaffold `demo/`

**Files:**
- Create: `demo/` (Vite React TypeScript template)
- Modify: `demo/index.html`, `demo/vite.config.ts`, `.gitignore` (repo root)
- Create: `demo/src/test/setup.ts`
- Delete: `demo/src/App.css`, `demo/src/index.css`, `demo/src/assets/`, `demo/public/favicon.svg`, `demo/public/icons.svg`

- [ ] **Step 1: Create the project and install pinned dependencies** (from the repo root. `demo/` already exists with a placeholder README, and `--overwrite` replaces it.)

```bash
cd "/Users/azizbenjilani/Nasa "
npm create vite@latest demo -- --template react-ts --no-interactive --overwrite
cd demo
npm install
npm install --save-exact maplibre-gl@6.18.0 terra-draw@1.39.0 terra-draw-maplibre-gl-adapter@1.5.0 @observablehq/plot@0.6.19 d3-scale@4.0.3 d3-scale-chromatic@3.1.1 @turf/area@7.4.0 @turf/bbox@7.4.0 @turf/bbox-polygon@7.4.0 @turf/boolean-point-in-polygon@7.4.0 @turf/circle@7.4.0 @fontsource/fira-sans@5.3.0 @fontsource/overpass@5.3.0 @phosphor-icons/react@2.1.10
npm install --save-exact -D vitest@5.1.0 jsdom@31.0.1 @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.10 @types/d3-scale@4.0.9 @types/d3-scale-chromatic@3.1.0 @playwright/test@1.65.1 @axe-core/playwright@4.14.0
rm -rf src/assets src/App.css src/index.css public/favicon.svg public/icons.svg
mkdir -p src/lib src/state src/hooks src/components src/styles src/test scripts e2e
```

Expected: `package.json` lists `react ^19.3.1`, `vite ^8.3.x`, `typescript ~7.0.2` and every package above.

- [ ] **Step 2: Replace `demo/index.html`** (no Vite logo favicon, real title)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Monthly calendar of NASA FIRMS satellite fire detections, MODIS and VIIRS on one scale." />
    <title>Hotspot Calendar</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Replace `demo/vite.config.ts`**

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works from any folder (GitHub Pages, Netlify, a USB stick).
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Create `demo/src/test/setup.ts`**

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

- [ ] **Step 5: Ignore generated files.** Append to the repo-root `.gitignore`:

```gitignore

# Demo app (generated)
demo/public/data/_mock/
demo/test-results/
demo/playwright-report/
```

- [ ] **Step 6: Commit** (the app will not typecheck until Task 9 writes `main.tsx` and `App.tsx`; that is expected)

```bash
cd "/Users/azizbenjilani/Nasa "
git add .gitignore demo
git commit -m "demo: scaffold Vite + React + TypeScript app with pinned dependencies"
```

### Task 2: Months and grid

**Files:** Create `src/lib/months.ts`, `src/lib/months.test.ts`, `src/lib/grid.ts`, `src/lib/grid.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/months.test.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { addMonths, labelYm, monthRange, monthsBetween, parseYm } from './months'

describe('months', () => {
  it('parses and rejects', () => {
    expect(parseYm('2012-01')).toEqual({ year: 2012, month: 1 })
    expect(() => parseYm('2012-13')).toThrow(/01-12/)
    expect(() => parseYm('2012-1')).toThrow(/YYYY-MM/)
  })
  it('does month arithmetic across years', () => {
    expect(monthsBetween('2000-11', '2001-02')).toBe(3)
    expect(addMonths('2000-11', 3)).toBe('2001-02')
    expect(addMonths('2001-01', -1)).toBe('2000-12')
  })
  it('builds inclusive ranges', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthRange('2026-02', '2025-11')).toEqual([])
  })
  it('labels months', () => {
    expect(labelYm('2026-11')).toBe('Nov 2026')
  })
})
```

`src/lib/grid.test.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { cellCentre, cellId, cellRing, tilesForBbox } from './grid'

describe('grid', () => {
  it('matches the contract example (0.25 deg)', () => {
    // HANDOVER 7.2 example: lat 38.125, lon -1.875 -> "512_712"
    expect(cellId(38.125, -1.875, 0.25)).toBe('512_712')
    expect(cellCentre('512_712', 0.25)).toEqual({ lat: 38.125, lon: -1.875 })
  })
  it('clamps the north pole and the antimeridian into the last cell', () => {
    expect(cellId(90, 180, 1)).toBe('179_359')
  })
  it('builds a closed ring', () => {
    const ring = cellRing('90_180', 1)
    expect(ring[0]).toEqual([0, 0])
    expect(ring[2]).toEqual([1, 1])
    expect(ring[4]).toEqual(ring[0])
  })
  it('finds overlapping tiles without spilling over exact edges', () => {
    expect(tilesForBbox([0, 0, 10, 10], 10)).toEqual(['9_18'])
    expect(tilesForBbox([-5, -5, 5, 5], 10)).toEqual(['8_17', '8_18', '9_17', '9_18'])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/months.test.ts src/lib/grid.test.ts`
Expected: FAIL, `Failed to resolve import "./months"` and `"./grid"`.

- [ ] **Step 3: Implement**

`src/lib/months.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.

/** A calendar month written "YYYY-MM". FIRMS dates are UTC, so months are UTC months. */
export type YearMonth = string

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export function parseYm(ym: YearMonth): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) throw new Error(`Invalid month "${ym}", expected YYYY-MM`)
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) throw new Error(`Invalid month "${ym}", month must be 01-12`)
  return { year, month }
}

export function formatYm(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Whole months from a to b (b - a). */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  const pa = parseYm(a)
  const pb = parseYm(b)
  return (pb.year - pa.year) * 12 + (pb.month - pa.month)
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const { year, month } = parseYm(ym)
  const zero = year * 12 + (month - 1) + n
  return formatYm(Math.floor(zero / 12), (zero % 12) + 1)
}

/** Inclusive list of months from first to last. */
export function monthRange(first: YearMonth, last: YearMonth): YearMonth[] {
  const n = monthsBetween(first, last)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addMonths(first, i))
}

/** "Nov 2026" */
export function labelYm(ym: YearMonth): string {
  const { year, month } = parseYm(ym)
  return `${MONTH_SHORT[month - 1]} ${year}`
}

/** "November 2026" */
export function longLabelYm(ym: YearMonth): string {
  const { year, month } = parseYm(ym)
  return `${MONTH_LONG[month - 1]} ${year}`
}
```

`src/lib/grid.ts` (cell ids follow HANDOVER 7.1. The test checks the handover's own example `512_712`.)
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Grid scheme from the team data contract (HANDOVER.md section 7.1):
// row = floor((lat + 90) / deg), col = floor((lon + 180) / deg), id = "row_col".
// Tiles use the same scheme with a coarser size (tile_deg).

export type Bbox = [west: number, south: number, east: number, north: number]

const round6 = (x: number) => Math.round(x * 1e6) / 1e6

export function cellId(lat: number, lon: number, deg: number): string {
  const rows = Math.round(180 / deg)
  const cols = Math.round(360 / deg)
  const row = Math.min(Math.floor((lat + 90) / deg), rows - 1)
  const col = Math.min(Math.floor((lon + 180) / deg), cols - 1)
  return `${row}_${col}`
}

export function parseCellId(id: string): { row: number; col: number } {
  const m = /^(\d+)_(\d+)$/.exec(id)
  if (!m) throw new Error(`Invalid cell id "${id}"`)
  return { row: Number(m[1]), col: Number(m[2]) }
}

export function cellCentre(id: string, deg: number): { lat: number; lon: number } {
  const { row, col } = parseCellId(id)
  return { lat: round6((row + 0.5) * deg - 90), lon: round6((col + 0.5) * deg - 180) }
}

/** Corner ring of a cell as [lon, lat] pairs, closed, counter-clockwise. */
export function cellRing(id: string, deg: number): [number, number][] {
  const { row, col } = parseCellId(id)
  const s = round6(row * deg - 90)
  const w = round6(col * deg - 180)
  const n = round6(s + deg)
  const e = round6(w + deg)
  return [[w, s], [e, s], [e, n], [w, n], [w, s]]
}

/** Ids of all tiles (same scheme, tile size tileDeg) that overlap the bbox. */
export function tilesForBbox([w, s, e, n]: Bbox, tileDeg: number): string[] {
  const maxRow = Math.round(180 / tileDeg) - 1
  const maxCol = Math.round(360 / tileDeg) - 1
  const r0 = Math.max(0, Math.floor((s + 90) / tileDeg))
  const r1 = Math.min(maxRow, Math.ceil((n + 90) / tileDeg) - 1)
  const c0 = Math.max(0, Math.floor((w + 180) / tileDeg))
  const c1 = Math.min(maxCol, Math.ceil((e + 180) / tileDeg) - 1)
  const ids: string[] = []
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) ids.push(`${r}_${c}`)
  return ids
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/lib/months.test.ts src/lib/grid.test.ts`
Expected: `Tests  8 passed (8)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/months.ts src/lib/months.test.ts src/lib/grid.ts src/lib/grid.test.ts
git commit -m "demo: month arithmetic and grid/tile ids"
```

### Task 3: Settings, data contract types and loader

**Files:** Create `src/config.ts`, `src/lib/types.ts`, `src/lib/data.ts`, `src/lib/data.test.ts`

- [ ] **Step 1: Create `src/config.ts`** (every tunable number in one place)

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Every tunable number in one place. Values marked TO CONFIRM must be agreed with Pierre/Andre.

/** Folder under public/data/ to load. "_mock" in the demo; the real dataset name when Andre's files land. */
export const DATASET: string = import.meta.env.VITE_DATASET ?? '_mock'

/** Colour ramp for counts. Bins are recomputed from the values inside the selected months. TO TUNE with real data. */
export const RAMP = { method: 'quantile' as 'quantile' | 'log', bins: 7 }

/** Relative anomaly denominator floor, in hotspots, so near-zero medians (UK winters) don't explode. TO CONFIRM. */
export const MIN_DENOMINATOR = 5

/** Percentile cut-offs for the verdict words: well below | below | near typical | above | well above. TO CONFIRM. */
export const VERDICT_THRESHOLDS: [number, number, number, number] = [10, 25, 75, 90]

/** Largest area a user can select, in km², so a selection loads only a few tiles. */
export const MAX_AREA_KM2 = 10_000_000

/** Fewest baseline years needed before we print a comparison. */
export const MIN_BASELINE_YEARS = 3
```

- [ ] **Step 2: Create `src/lib/types.ts`** (the contract with the pipeline)

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The data contract between the pipeline (Andre, Pierre) and the app. Proposed extension of HANDOVER.md section 7:
// same fields, packed into 10-degree tiles so any drawn area on the globe loads only the files it needs.
import type { Bbox } from './grid'
import type { YearMonth } from './months'

export const SERIES_KEYS = ['harmonized', 'modis', 'viirs_snpp', 'viirs_noaa20'] as const
export type SeriesKey = (typeof SERIES_KEYS)[number]
export type SensorKey = Exclude<SeriesKey, 'harmonized'>
export type BandKey = 'harmonized_low' | 'harmonized_high'

export const SERIES_LABELS: Record<SeriesKey, string> = {
  harmonized: 'Harmonized (MODIS + VIIRS)',
  modis: 'MODIS only (raw)',
  viirs_snpp: 'VIIRS S-NPP only (raw)',
  viirs_noaa20: 'VIIRS NOAA-20 only (raw)',
}

export interface SensorInfo {
  key: SensorKey
  label: string
  source: string
  version: string
  first_month: YearMonth
  last_month: YearMonth
}

export interface Preset {
  id: string
  name: string
  bbox: Bbox
}

export interface Manifest {
  schema_version: 1
  mock: boolean
  dataset_name: string
  grid_deg: number
  tile_deg: number
  first_month: YearMonth
  last_month: YearMonth
  /** true when last_month is not finished yet ("month to date"). */
  month_to_date: boolean
  /** First month that is near-real-time (provisional) rather than standard science-quality data. */
  nrt_from: YearMonth
  baseline_years: [number, number]
  harmonized_coverage: [YearMonth, YearMonth]
  sensors: SensorInfo[]
  /** Areas the pipeline processed. Outside these, "no data" is not the same as "no hotspots". */
  coverage: Bbox[]
  filters: { type: number[]; modis_confidence_min: number; viirs_confidence: string[] }
  method: {
    name: string
    version: string
    reference_scale: string
    fit_years: [number, number] | null
    test_years: [number, number] | null
  }
  validation: { metric: string; value: number | null; notes: string }
  generated_at: string
  tiles: string[]
  presets: Preset[]
}

/**
 * One tile. Cells with no detections in any month are left out (sparse), which means 0, not "no data".
 * Each series holds one array per cell, one value per month from manifest.first_month to last_month.
 * null = that sensor was not operating that month.
 */
export interface TileFile {
  tile_id: string
  cells: string[]
  series: Record<SeriesKey, (number | null)[][]> & Partial<Record<BandKey, (number | null)[][]>>
}

export interface OverviewFile {
  grid_deg: number
  metric: string
  cells: [lat: number, lon: number, value: number][]
}

export interface ReportedSeries {
  preset_id: string
  label: string
  source: string
  licence: string
  url: string
  unit: string
  first_month: YearMonth
  values: (number | null)[]
}

export interface ReportedFile {
  mock: boolean
  series: ReportedSeries[]
}
```

- [ ] **Step 3: Write the failing test** `src/lib/data.test.ts`

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it, vi } from 'vitest'
import { createDataSource, DataError, validateManifest } from './data'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const minimal = {
  schema_version: 1, mock: true, dataset_name: 'x', grid_deg: 1, tile_deg: 10,
  first_month: '2000-11', last_month: '2026-11', month_to_date: true, nrt_from: '2026-07',
  baseline_years: [2003, 2025], harmonized_coverage: ['2000-11', '2026-11'],
  sensors: [], coverage: [], tiles: [], presets: [],
}

describe('validateManifest', () => {
  it('accepts a minimal manifest', () => {
    expect(validateManifest(minimal).grid_deg).toBe(1)
  })
  it('names the broken field', () => {
    expect(() => validateManifest({ ...minimal, nrt_from: '2026-7' })).toThrow(/nrt_from/)
    expect(() => validateManifest({ ...minimal, last_month: '2026-13' })).toThrow(/last_month/)
    expect(() => validateManifest({ ...minimal, first_month: '2027-01' })).toThrow(/first_month must not be after/)
    expect(() => validateManifest({ ...minimal, sensors: [{ key: 'modis' }] })).toThrow(/sensors\[0\]/)
    expect(() => validateManifest({ ...minimal, schema_version: 2 })).toThrow(DataError)
  })
})

describe('createDataSource', () => {
  it('caches tiles and retries after a failure', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValue(json({ tile_id: '1_1', cells: [], series: {} }))
    const ds = createDataSource('/data/x/', fetchFn)
    await expect(ds.tile('1_1')).rejects.toThrow(/HTTP 500/)
    await ds.tile('1_1')
    await ds.tile('1_1')
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn).toHaveBeenLastCalledWith('/data/x/tiles/1_1.json')
  })
  it('treats a missing or HTML reported.json as absent', async () => {
    const html = new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    expect(await createDataSource('/', async () => html).reported()).toBeNull()
    expect(await createDataSource('/', async () => new Response('', { status: 404 })).reported()).toBeNull()
  })
  it('treats an unreadable reported.json as absent', async () => {
    const broken = new Response('{not json', { status: 200, headers: { 'content-type': 'application/json' } })
    expect(await createDataSource('/', async () => broken).reported()).toBeNull()
  })
})
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run src/lib/data.test.ts`
Expected: FAIL, `Failed to resolve import "./data"`.

- [ ] **Step 5: Implement `src/lib/data.ts`** (the only file that knows file names. The dev server answers a missing file with HTML, so the optional `reported.json` is checked by content type.)

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The only place that knows file names and shapes. If Andre renames a field, fix it here.
import type { Manifest, OverviewFile, ReportedFile, TileFile } from './types'

type FetchFn = (url: string) => Promise<Response>

export class DataError extends Error {}

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new DataError(msg)
}

const isYm = (x: unknown) => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x)

export function validateManifest(raw: unknown): Manifest {
  check(raw !== null && typeof raw === 'object', 'manifest.json is not a JSON object')
  const m = raw as Manifest
  check(m.schema_version === 1, `Unsupported schema_version ${String(m.schema_version)} (this app reads version 1)`)
  check(typeof m.mock === 'boolean', 'manifest.mock must be true or false')
  for (const k of ['grid_deg', 'tile_deg'] as const) {
    check(typeof m[k] === 'number' && m[k] > 0, `manifest.${k} must be a positive number`)
  }
  for (const k of ['first_month', 'last_month', 'nrt_from'] as const) {
    check(isYm(m[k]), `manifest.${k} must be YYYY-MM`)
  }
  check(m.first_month <= m.last_month, 'manifest.first_month must not be after manifest.last_month')
  check(typeof m.month_to_date === 'boolean', 'manifest.month_to_date must be true or false')
  check(Array.isArray(m.baseline_years) && m.baseline_years.length === 2, 'manifest.baseline_years must be [first, last]')
  check(Array.isArray(m.harmonized_coverage) && m.harmonized_coverage.length === 2 && m.harmonized_coverage.every(isYm),
    'manifest.harmonized_coverage must be [first, last] as YYYY-MM')
  for (const k of ['sensors', 'coverage', 'tiles', 'presets'] as const) {
    check(Array.isArray(m[k]), `manifest.${k} must be a list`)
  }
  m.sensors.forEach((s, i) => check(s && typeof s.key === 'string' && isYm(s.first_month) && isYm(s.last_month),
    `manifest.sensors[${i}] needs key, first_month and last_month (YYYY-MM)`))
  return m
}

function isJson(res: Response): boolean {
  return (res.headers.get('content-type') ?? '').includes('json')
}

export function createDataSource(baseUrl: string, fetchFn: FetchFn = (u) => fetch(u)) {
  const tiles = new Map<string, Promise<TileFile>>()

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchFn(baseUrl + path)
    if (!res.ok || !isJson(res)) throw new DataError(`Could not load ${path} (HTTP ${res.status})`)
    return (await res.json()) as T
  }

  return {
    async manifest(): Promise<Manifest> {
      return validateManifest(await getJson<unknown>('manifest.json'))
    },
    tile(id: string): Promise<TileFile> {
      let p = tiles.get(id)
      if (!p) {
        p = getJson<TileFile>(`tiles/${id}.json`)
        tiles.set(id, p)
        p.catch(() => tiles.delete(id))
      }
      return p
    },
    overview(): Promise<OverviewFile> {
      return getJson<OverviewFile>('overview.json')
    },
    /** Optional file. Missing (404, the dev server's HTML fallback) or unreadable means "no reported data". */
    async reported(): Promise<ReportedFile | null> {
      try {
        const res = await fetchFn(baseUrl + 'reported.json')
        if (!res.ok || !isJson(res)) return null
        return (await res.json()) as ReportedFile
      } catch {
        return null
      }
    },
  }
}

export type DataSource = ReturnType<typeof createDataSource>
```

- [ ] **Step 6: Run it to see it pass**

Run: `npx vitest run src/lib/data.test.ts`
Expected: `Tests  5 passed (5)`

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/lib/types.ts src/lib/data.ts src/lib/data.test.ts
git commit -m "demo: settings, tiled data contract types and validated loader"
```

### Task 4: Areas, data status and aggregation

**Files:** Create `src/lib/area.ts`, `src/lib/area.test.ts`, `src/lib/status.ts`, `src/lib/aggregate.ts`, `src/lib/aggregate.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/area.test.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromPoint, areaFromPolygon, checkSize, validateBbox, validateDrawn, validatePoint } from './area'

describe('area', () => {
  it('validates boxes in west, south, east, north order', () => {
    expect(validateBbox([-8.7, 49.8, 1.8, 60.9])).toBeNull()
    expect(validateBbox([1, 50, -1, 60])).toMatch(/180° line/)
    expect(validateBbox([0, 60, 1, 50])).toMatch(/South must be less/)
    expect(validateBbox([0, -91, 1, 0])).toMatch(/Latitude/)
    expect(validateBbox([0, NaN, 1, 0])).toMatch(/all four/)
  })
  it('computes a box area close to the real value', () => {
    // 1 x 1 degree at the equator is about 12,300 km²
    const a = areaFromBbox([0, 0, 1, 1])
    expect(a.areaKm2).toBeGreaterThan(12_000)
    expect(a.areaKm2).toBeLessThan(12_500)
    expect(a.bbox).toEqual([0, 0, 1, 1])
  })
  it('builds a circle from a point and radius', () => {
    const a = areaFromPoint(51.5, -0.1, 50)
    expect(a.areaKm2).toBeGreaterThan(7_700) // pi * 50^2 = 7,854 (64-step polygon is slightly smaller)
    expect(a.areaKm2).toBeLessThan(7_900)
    expect(validatePoint(51.5, -0.1, 0)).toMatch(/more than 0/)
  })
  it('rejects areas over the size limit', () => {
    expect(checkSize(areaFromBbox([-180, -60, 180, 80]))).toMatch(/limit/)
  })
  it('applies the typed-coordinate rules to drawn shapes', () => {
    const ring = (lons: number[]) => areaFromPolygon({ type: 'Polygon', coordinates: [[[lons[0], 60], [lons[1], 60], [lons[1], 65], [lons[0], 65], [lons[0], 60]]] })
    expect(validateDrawn(ring([175, -175]))).toMatch(/180° line/) // wraps from +175 to -175
    expect(validateDrawn(ring([170, 190]))).toMatch(/180° line/) // longitudes past 180
    expect(validateDrawn(areaFromBbox([-60, -50, 60, 50]))).toMatch(/limit/)
    expect(validateDrawn(areaFromBbox([0, 0, 1, 1]))).toBeNull()
  })
})
```

`src/lib/aggregate.test.ts` (checks that `null` (no sensor) stays separate from `0` (no hotspots), and the smaller-than-a-cell fallback)
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { aggregate, cellTotals, coverageOf, selectCells } from './aggregate'
import { areaFromBbox, areaFromPoint } from './area'
import type { Manifest, TileFile } from './types'

const manifest = {
  schema_version: 1, mock: true, dataset_name: 't', grid_deg: 1, tile_deg: 10,
  first_month: '2011-12', last_month: '2012-02', month_to_date: false, nrt_from: '2012-02',
  baseline_years: [2003, 2025], harmonized_coverage: ['2011-12', '2012-02'],
  sensors: [
    { key: 'modis', label: 'MODIS', source: 'FIRMS', version: '6.1', first_month: '2000-11', last_month: '2026-11' },
    { key: 'viirs_snpp', label: 'S-NPP', source: 'FIRMS', version: '2', first_month: '2012-01', last_month: '2026-11' },
  ],
  coverage: [[0, 0, 10, 10]], tiles: ['9_18'], presets: [],
} as unknown as Manifest

// Cells "90_180" (centre 0.5, 0.5) and "92_182" (centre 2.5, 2.5)
const tile: TileFile = {
  tile_id: '9_18',
  cells: ['90_180', '92_182'],
  series: {
    harmonized: [[1, 2, 3], [10, 20, 30]],
    modis: [[1, 1, 1], [5, 5, 5]],
    viirs_snpp: [[null, 4, 4], [null, 9, 9]],
    viirs_noaa20: [[null, null, null], [null, null, null]],
    harmonized_low: [[0, 1, 2], [8, 16, 24]],
    harmonized_high: [[2, 3, 4], [12, 24, 36]],
  },
}

describe('aggregate', () => {
  it('sums only cells whose centre is inside the area', () => {
    const sel = selectCells(areaFromBbox([0, 0, 2, 2]), [tile], 1)
    expect(sel.cells.map((c) => c.id)).toEqual(['90_180'])
    const s = aggregate(manifest, sel)
    expect(s.months).toEqual(['2011-12', '2012-01', '2012-02'])
    expect(s.values.harmonized).toEqual([1, 2, 3])
    expect(s.low).toEqual([0, 1, 2])
  })
  it('keeps null (no sensor) separate from 0 (no hotspots)', () => {
    const empty = aggregate(manifest, selectCells(areaFromBbox([5, 5, 9, 9]), [tile], 1))
    expect(empty.values.modis).toEqual([0, 0, 0])
    expect(empty.values.viirs_snpp).toEqual([null, 0, 0])
    expect(empty.values.viirs_noaa20).toEqual([null, null, null])
  })
  it('falls back to the containing cell for areas smaller than a cell', () => {
    const sel = selectCells(areaFromPoint(2.4, 2.6, 5), [tile], 1)
    expect(sel.fallback).toBe(true)
    expect(sel.cells.map((c) => c.id)).toEqual(['92_182'])
  })
  it('falls back for a thin strip that contains no cell centre', () => {
    // 0.3 x 5 degrees: bigger than one cell, but between the cell centres at 0.5 and 1.5 degrees east
    const sel = selectCells(areaFromBbox([0.6, -2, 0.9, 3]), [tile], 1)
    expect(sel.fallback).toBe(true)
    expect(sel.cells.map((c) => c.id)).toEqual(['90_180'])
  })
  it('totals each cell over a month range', () => {
    const sel = selectCells(areaFromBbox([0, 0, 3, 3]), [tile], 1)
    expect(cellTotals(sel, 'viirs_snpp', 0, 2).map((c) => c.total)).toEqual([8, 18])
    expect(cellTotals(sel, 'viirs_snpp', 0, 0).map((c) => c.total)).toEqual([null, null])
  })
  it('reports coverage', () => {
    expect(coverageOf(manifest, areaFromBbox([1, 1, 2, 2]))).toBe('full')
    expect(coverageOf(manifest, areaFromBbox([8, 8, 12, 12]))).toBe('partial')
    expect(coverageOf(manifest, areaFromBbox([20, 20, 22, 22]))).toBe('none')
  })
  it('counts an area across two adjacent coverage boxes as fully covered', () => {
    const two = { ...manifest, coverage: [[0, 0, 10, 10], [10, 0, 20, 10]] } as unknown as Manifest
    expect(coverageOf(two, areaFromBbox([5, 1, 15, 2]))).toBe('full')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/area.test.ts src/lib/aggregate.test.ts`
Expected: FAIL, unresolved imports `./area`, `./aggregate`.

- [ ] **Step 3: Implement**

`src/lib/area.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { area as turfArea } from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import { bboxPolygon } from '@turf/bbox-polygon'
import { circle } from '@turf/circle'
import { MAX_AREA_KM2 } from '../config'
import type { Bbox } from './grid'

export type AreaSource = 'preset' | 'drawn' | 'bbox' | 'point'

export interface Area {
  label: string
  source: AreaSource
  /** Set when the area is a preset, so preset-only data (reported fires) can be matched. */
  presetId?: string
  geometry: GeoJSON.Polygon
  bbox: Bbox
  areaKm2: number
}

const fmtKm2 = (x: number) => Math.round(x).toLocaleString('en-GB')
const fmtDeg = (x: number) => String(Math.round(x * 100) / 100)

function finish(geometry: GeoJSON.Polygon, label: string, source: AreaSource): Area {
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry }
  return { label, source, geometry, bbox: turfBbox(feature) as Bbox, areaKm2: turfArea(feature) / 1e6 }
}

/** Returns an error message, or null when the box is valid. Order is west, south, east, north (FIRMS area API order). */
export function validateBbox([w, s, e, n]: Bbox): string | null {
  if ([w, s, e, n].some((v) => !Number.isFinite(v))) return 'Enter all four numbers.'
  if (s < -90 || n > 90) return 'Latitude must be between -90 and 90.'
  if (w < -180 || e > 180) return 'Longitude must be between -180 and 180.'
  if (s >= n) return 'South must be less than north.'
  if (w >= e) return 'West must be less than east. Boxes that cross the 180° line are not supported yet: draw two boxes instead.'
  return null
}

export function validatePoint(lat: number, lon: number, radiusKm: number): string | null {
  if (![lat, lon, radiusKm].every(Number.isFinite)) return 'Enter latitude, longitude and radius.'
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.'
  if (lon < -180 || lon > 180) return 'Longitude must be between -180 and 180.'
  if (radiusKm <= 0) return 'Radius must be more than 0 km.'
  if (radiusKm > 1500) return 'Radius must be 1500 km or less.'
  return null
}

/** Returns an error message when the area is too large to load quickly. */
export function checkSize(a: Area): string | null {
  if (a.areaKm2 <= MAX_AREA_KM2) return null
  return `This area is ${fmtKm2(a.areaKm2)} km². The limit is ${fmtKm2(MAX_AREA_KM2)} km² so results stay fast: choose a smaller area.`
}

export function areaFromBbox(bbox: Bbox, label?: string, source: AreaSource = 'bbox'): Area {
  const [w, s, e, n] = bbox
  return finish(bboxPolygon(bbox).geometry, label ?? `Box W ${fmtDeg(w)}, S ${fmtDeg(s)}, E ${fmtDeg(e)}, N ${fmtDeg(n)}`, source)
}

export function areaFromPoint(lat: number, lon: number, radiusKm: number): Area {
  const geom = circle([lon, lat], radiusKm, { units: 'kilometers', steps: 64 }).geometry
  return finish(geom, `${radiusKm} km around ${fmtDeg(lat)}, ${fmtDeg(lon)}`, 'point')
}

export function areaFromPolygon(geometry: GeoJSON.Polygon, label = 'Drawn area'): Area {
  return finish(geometry, label, 'drawn')
}

/** Drawn shapes follow the same rules as typed ones: no 180° crossing, and the size limit. */
export function validateDrawn(a: Area): string | null {
  const ring = a.geometry.coordinates[0]
  const crosses = ring.some(([lon], i) => Math.abs(lon) > 180 || (i > 0 && Math.abs(lon - ring[i - 1][0]) > 180))
  if (crosses) return 'This shape crosses the 180° line, which is not supported yet. Draw it on one side of the line.'
  return checkSize(a)
}

export function areaFromPreset(p: { id: string; name: string; bbox: Bbox }): Area {
  return { ...areaFromBbox(p.bbox, p.name, 'preset'), presetId: p.id }
}
```

`src/lib/status.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { YearMonth } from './months'
import type { Manifest, SensorInfo, SeriesKey } from './types'

export type MonthStatus = 'standard' | 'nrt' | 'partial' | 'no_sensor'

export const STATUS_LABELS: Record<MonthStatus, string> = {
  standard: 'Standard (science quality)',
  nrt: 'Near real-time: provisional',
  partial: 'Month to date: provisional',
  no_sensor: 'No sensor operating',
}

/** YYYY-MM strings compare correctly as text. */
export function inSpan(ym: YearMonth, [first, last]: [YearMonth, YearMonth]): boolean {
  return ym >= first && ym <= last
}

export function monthStatus(m: Manifest, ym: YearMonth): MonthStatus {
  if (!inSpan(ym, m.harmonized_coverage) || ym > m.last_month) return 'no_sensor'
  if (m.month_to_date && ym === m.last_month) return 'partial'
  if (ym >= m.nrt_from) return 'nrt'
  return 'standard'
}

export function sensorsIn(m: Manifest, ym: YearMonth): SensorInfo[] {
  return m.sensors.filter((s) => inSpan(ym, [s.first_month, s.last_month]))
}

/** Months in which a series can have a value at all. */
export function seriesSpan(m: Manifest, key: SeriesKey): [YearMonth, YearMonth] | null {
  if (key === 'harmonized') return m.harmonized_coverage
  const s = m.sensors.find((x) => x.key === key)
  return s ? [s.first_month, s.last_month] : null
}
```

`src/lib/aggregate.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Sums grid cells inside the user's area. A cell is "inside" when its centre is inside,
// so edges are approximate to one grid cell (said in the UI).
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type { Area } from './area'
import { cellCentre, cellId } from './grid'
import { monthRange, type YearMonth } from './months'
import { inSpan, seriesSpan } from './status'
import { SERIES_KEYS, type Manifest, type SeriesKey, type TileFile } from './types'

export interface CellRef {
  tile: TileFile
  index: number
  id: string
  lat: number
  lon: number
}

export interface Selection {
  cells: CellRef[]
  /** true when no grid-cell centre lies inside the area, so we used the cell containing its centre. */
  fallback: boolean
}

export interface AreaSeries {
  months: YearMonth[]
  values: Record<SeriesKey, (number | null)[]>
  low: (number | null)[] | null
  high: (number | null)[] | null
}

/** Does any grid-cell centre lie inside the area? (Sparse tiles can't tell us: absent cells are zeros.) */
function containsCellCentre(area: Area, feature: GeoJSON.Feature<GeoJSON.Polygon>, gridDeg: number): boolean {
  const [w, s, e, n] = area.bbox
  const r0 = Math.ceil((s + 90) / gridDeg - 0.5)
  const r1 = Math.floor((n + 90) / gridDeg - 0.5)
  const c0 = Math.ceil((w + 180) / gridDeg - 0.5)
  const c1 = Math.floor((e + 180) / gridDeg - 0.5)
  if (r1 < r0 || c1 < c0) return false
  if ((r1 - r0 + 1) * (c1 - c0 + 1) > 20_000) return true // very large areas always contain one
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (booleanPointInPolygon([(c + 0.5) * gridDeg - 180, (r + 0.5) * gridDeg - 90], feature)) return true
    }
  }
  return false
}

export function selectCells(area: Area, tiles: TileFile[], gridDeg: number): Selection {
  const [w, s, e, n] = area.bbox
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  const cells: CellRef[] = []
  for (const tile of tiles) {
    tile.cells.forEach((id, index) => {
      const c = cellCentre(id, gridDeg)
      if (c.lon < w || c.lon > e || c.lat < s || c.lat > n) return
      if (booleanPointInPolygon([c.lon, c.lat], feature)) cells.push({ tile, index, id, ...c })
    })
  }
  if (cells.length > 0 || containsCellCentre(area, feature, gridDeg)) return { cells, fallback: false }
  // Small or thin areas: use the cell that contains the area's centre.
  const id = cellId((s + n) / 2, (w + e) / 2, gridDeg)
  for (const tile of tiles) {
    const index = tile.cells.indexOf(id)
    if (index >= 0) return { cells: [{ tile, index, id, ...cellCentre(id, gridDeg) }], fallback: true }
  }
  return { cells: [], fallback: true }
}

/** 0 where the series could have data, null where it could not (sensor not operating). */
function baseArray(m: Manifest, months: YearMonth[], key: SeriesKey): (number | null)[] {
  const span = seriesSpan(m, key)
  return months.map((ym) => (span && inSpan(ym, span) ? 0 : null))
}

function addInto(out: (number | null)[], values: (number | null)[] | undefined) {
  if (!values) return
  for (let i = 0; i < out.length; i++) {
    const v = values[i]
    if (out[i] !== null && v !== null && v !== undefined) out[i] = (out[i] as number) + v
  }
}

export function aggregate(m: Manifest, sel: Selection): AreaSeries {
  const months = monthRange(m.first_month, m.last_month)
  const values = Object.fromEntries(SERIES_KEYS.map((k) => [k, baseArray(m, months, k)])) as AreaSeries['values']
  const hasBand = sel.cells.length > 0 && sel.cells.every((c) => c.tile.series.harmonized_low && c.tile.series.harmonized_high)
  // Band = sum of cell bands (conservative). Replace if Pierre supplies region-level uncertainty.
  const low = hasBand ? baseArray(m, months, 'harmonized') : null
  const high = hasBand ? baseArray(m, months, 'harmonized') : null
  for (const c of sel.cells) {
    for (const k of SERIES_KEYS) addInto(values[k], c.tile.series[k][c.index])
    if (low && high) {
      addInto(low, c.tile.series.harmonized_low?.[c.index])
      addInto(high, c.tile.series.harmonized_high?.[c.index])
    }
  }
  return { months, values, low, high }
}

/** Per-cell totals over months [i0, i1] (indices into AreaSeries.months), for colouring the map. */
export function cellTotals(sel: Selection, key: SeriesKey, i0: number, i1: number) {
  return sel.cells.map((c) => {
    const arr = c.tile.series[key][c.index]
    let total: number | null = null
    for (let i = i0; i <= i1; i++) {
      const v = arr[i]
      if (v !== null && v !== undefined) total = (total ?? 0) + v
    }
    return { id: c.id, lat: c.lat, lon: c.lon, total }
  })
}

/**
 * Is the area inside the processed coverage? Checks the area's corners and a grid of points inside it,
 * so an area spanning two adjacent coverage boxes counts as fully covered.
 */
export function coverageOf(m: Manifest, area: Area): 'none' | 'partial' | 'full' {
  const [w, s, e, n] = area.bbox
  const covered = ([lon, lat]: number[]) => m.coverage.some(([cw, cs, ce, cn]) => lon >= cw && lon <= ce && lat >= cs && lat <= cn)
  const feature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: area.geometry }
  const points: number[][] = [...area.geometry.coordinates[0]]
  const N = 10
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = [w + ((e - w) * i) / N, s + ((n - s) * j) / N]
      if (booleanPointInPolygon(p, feature)) points.push(p)
    }
  }
  const hits = points.filter(covered).length
  if (hits === points.length) return 'full'
  if (hits > 0) return 'partial'
  // A small coverage box can sit between sample points.
  return m.coverage.some(([cw, cs, ce, cn]) => w < ce && e > cw && s < cn && n > cs) ? 'partial' : 'none'
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/area.test.ts src/lib/aggregate.test.ts`
Expected: `Tests  12 passed (12)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/area.ts src/lib/area.test.ts src/lib/status.ts src/lib/aggregate.ts src/lib/aggregate.test.ts
git commit -m "demo: area validation, data status and per-area aggregation"
```

### Task 5: Indices (historical comparison)

**Files:** Create `src/lib/indices.ts`, `src/lib/indices.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/indices.test.ts` (hand-computable series: Augusts = 10, 20, 30, 40)

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { monthRange } from './months'
import {
  monthlyAnomalies, percentileOf, quantile, rankOf, relativeAnomaly,
  sameMonthBaseline, summarizeMonth, verdictFor, yearToDate,
} from './indices'

// 2003-01 .. 2006-12: every August = 10, 20, 30, 40 for 2003..2006; every other month = 1
const months = monthRange('2003-01', '2006-12')
const series = months.map((ym) => (ym.endsWith('-08') ? (Number(ym.slice(0, 4)) - 2002) * 10 : 1))

describe('indices', () => {
  it('quantile interpolates like numpy', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10, 20, 30], 0.25)).toBe(15)
  })
  it('builds a same-month baseline that excludes the focus year', () => {
    const b = sameMonthBaseline(series, months, 8, [2003, 2006], 2006)!
    expect(b.years).toEqual([2003, 2004, 2005])
    expect(b.median).toBe(20)
    expect(b.mean).toBe(20)
  })
  it('floors the anomaly denominator', () => {
    expect(relativeAnomaly(30, 20)).toBe(50)
    expect(relativeAnomaly(6, 0, 5)).toBe(120)
  })
  it('ranks and grades', () => {
    expect(percentileOf(40, [10, 20, 30])).toBe(100)
    expect(rankOf(40, [10, 20, 30])).toEqual({ rank: 1, of: 4 })
    expect(verdictFor(100)).toBe('well-above')
    expect(verdictFor(50)).toBe('typical')
    expect(verdictFor(5)).toBe('well-below')
  })
  it('summarizes a focus month', () => {
    const s = summarizeMonth(series, months, '2006-08', [2003, 2006])
    expect(s.value).toBe(40)
    expect(s.vsMedianPct).toBe(100)
    expect(s.rank).toEqual({ rank: 1, of: 4 })
    expect(s.verdict).toBe('well-above')
  })
  it('compares year to date', () => {
    // Jan-Aug 2006 = 7 + 40 = 47; baseline 2003-2005 = 17, 27, 37 -> median 27
    const y = yearToDate(series, months, '2006-08', [2003, 2006])!
    expect(y.current).toBe(47)
    expect(y.typical).toBe(27)
  })
  it('lists monthly anomalies in a range', () => {
    const i = months.indexOf('2006-08')
    const a = monthlyAnomalies(series, months, i, i, [2003, 2006])
    expect(a).toEqual([{ month: '2006-08', value: 40, reference: 20, anomalyPct: 100 }])
  })
  it('leaves year to date empty when the year is missing early months', () => {
    // The record starts in November 2000, so Jan-Dec 2000 is incomplete
    const m2 = monthRange('2000-11', '2006-12')
    const flat = m2.map(() => 10)
    expect(yearToDate(flat, m2, '2000-12', [2000, 2006])).toBeNull()
    expect(yearToDate(flat, m2, '2006-12', [2000, 2006])).toEqual({ current: 120, typical: 120, anomalyPct: 0, years: 5 })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/indices.test.ts`
Expected: FAIL, `Failed to resolve import "./indices"`.

- [ ] **Step 3: Implement `src/lib/indices.ts`**

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Key indices (HANDOVER.md F4). These are display statistics on already-harmonized counts;
// they are not the harmonization method, which belongs to Pierre.
import { MIN_BASELINE_YEARS, MIN_DENOMINATOR, VERDICT_THRESHOLDS } from '../config'
import { parseYm, type YearMonth } from './months'

type Series = (number | null)[]

/** Linear-interpolation quantile (same as numpy's default and R type 7). Input must be sorted. */
export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const h = (sorted.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}

export interface BaselineStats {
  years: number[]
  values: number[]
  median: number
  mean: number
  sd: number
  p10: number
  p25: number
  p75: number
  p90: number
}

export function statsOf(years: number[], values: number[]): BaselineStats | null {
  if (values.length < MIN_BASELINE_YEARS) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1))
  return {
    years, values, mean, sd,
    median: quantile(sorted, 0.5),
    p10: quantile(sorted, 0.1), p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75), p90: quantile(sorted, 0.9),
  }
}

/** The same calendar month across the baseline years, leaving out excludeYear (a month is never its own baseline). */
export function sameMonthBaseline(
  series: Series, months: YearMonth[], calMonth: number,
  [y0, y1]: [number, number], excludeYear?: number,
): BaselineStats | null {
  const years: number[] = []
  const values: number[] = []
  months.forEach((ym, i) => {
    const { year, month } = parseYm(ym)
    const v = series[i]
    if (month === calMonth && year >= y0 && year <= y1 && year !== excludeYear && v !== null) {
      years.push(year)
      values.push(v)
    }
  })
  return statsOf(years, values)
}

/** (value - reference) / max(reference, floor) as a percentage. */
export function relativeAnomaly(value: number, reference: number, floor = MIN_DENOMINATOR): number {
  return ((value - reference) / Math.max(reference, floor)) * 100
}

/** Share of the sample below the value (ties count half), 0-100. */
export function percentileOf(value: number, sample: number[]): number {
  if (sample.length === 0) return NaN
  const below = sample.filter((v) => v < value).length
  const equal = sample.filter((v) => v === value).length
  return ((below + equal / 2) / sample.length) * 100
}

/** 1 = highest. Ties share the better rank. "of" counts the value itself plus the sample. */
export function rankOf(value: number, sample: number[]): { rank: number; of: number } {
  return { rank: sample.filter((v) => v > value).length + 1, of: sample.length + 1 }
}

export type VerdictLevel = 'well-below' | 'below' | 'typical' | 'above' | 'well-above'

export const VERDICT_LABELS: Record<VerdictLevel, string> = {
  'well-below': 'Well below typical',
  below: 'Below typical',
  typical: 'Near typical',
  above: 'Above typical',
  'well-above': 'Well above typical',
}

export function verdictFor(percentile: number, [a, b, c, d] = VERDICT_THRESHOLDS): VerdictLevel {
  if (percentile < a) return 'well-below'
  if (percentile < b) return 'below'
  if (percentile <= c) return 'typical'
  if (percentile <= d) return 'above'
  return 'well-above'
}

export function zScore(value: number, mean: number, sd: number): number | null {
  return sd > 0 ? (value - mean) / sd : null
}

export interface MonthSummary {
  month: YearMonth
  value: number | null
  baseline: BaselineStats | null
  vsMeanPct: number | null
  vsMedianPct: number | null
  percentile: number | null
  rank: { rank: number; of: number } | null
  verdict: VerdictLevel | null
  z: number | null
}

export function summarizeMonth(series: Series, months: YearMonth[], focus: YearMonth, baselineYears: [number, number]): MonthSummary {
  const i = months.indexOf(focus)
  const value = i >= 0 ? series[i] : null
  const { year, month } = parseYm(focus)
  const baseline = sameMonthBaseline(series, months, month, baselineYears, year)
  if (value === null || baseline === null) {
    return { month: focus, value, baseline, vsMeanPct: null, vsMedianPct: null, percentile: null, rank: null, verdict: null, z: null }
  }
  const percentile = percentileOf(value, baseline.values)
  return {
    month: focus, value, baseline,
    vsMeanPct: relativeAnomaly(value, baseline.mean),
    vsMedianPct: relativeAnomaly(value, baseline.median),
    percentile,
    rank: rankOf(value, baseline.values),
    verdict: verdictFor(percentile),
    z: zScore(value, baseline.mean, baseline.sd),
  }
}

export interface YearToDate {
  current: number
  typical: number
  anomalyPct: number
  years: number
}

/**
 * January to the focus month of the focus year, against the median of the same span in baseline years.
 * A year counts only when every month from January to the focus month exists and has a value,
 * so a record that starts in November is never compared with full years.
 */
export function yearToDate(series: Series, months: YearMonth[], focus: YearMonth, [y0, y1]: [number, number]): YearToDate | null {
  const { year: fy, month: fm } = parseYm(focus)
  const acc = new Map<number, { sum: number; n: number; gap: boolean }>()
  months.forEach((ym, i) => {
    const { year, month } = parseYm(ym)
    if (month > fm) return
    const a = acc.get(year) ?? { sum: 0, n: 0, gap: false }
    const v = series[i]
    if (v === null) a.gap = true
    else a.sum += v
    a.n++
    acc.set(year, a)
  })
  const complete = (y: number): number | null => {
    const a = acc.get(y)
    return a && !a.gap && a.n === fm ? a.sum : null
  }
  const current = complete(fy)
  if (current === null) return null
  const base = [...acc.keys()]
    .filter((y) => y >= y0 && y <= y1 && y !== fy)
    .map(complete)
    .filter((v): v is number => v !== null)
  if (base.length < MIN_BASELINE_YEARS) return null
  const typical = quantile([...base].sort((a, b) => a - b), 0.5)
  return { current, typical, anomalyPct: relativeAnomaly(current, typical), years: base.length }
}

export interface MonthlyAnomaly {
  month: YearMonth
  value: number
  reference: number
  anomalyPct: number
}

/** Anomaly of every month in [i0, i1] against its calendar month's multi-year average (or median), excluding its own year. */
export function monthlyAnomalies(
  series: Series, months: YearMonth[], i0: number, i1: number,
  baselineYears: [number, number], reference: 'mean' | 'median' = 'mean',
): MonthlyAnomaly[] {
  const out: MonthlyAnomaly[] = []
  for (let i = i0; i <= i1; i++) {
    const v = series[i]
    if (v === null) continue
    const { year, month } = parseYm(months[i])
    const b = sameMonthBaseline(series, months, month, baselineYears, year)
    if (!b) continue
    const ref = reference === 'mean' ? b.mean : b.median
    out.push({ month: months[i], value: v, reference: ref, anomalyPct: relativeAnomaly(v, ref) })
  }
  return out
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/indices.test.ts`
Expected: `Tests  8 passed (8)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/indices.ts src/lib/indices.test.ts
git commit -m "demo: baseline stats, anomalies, percentile, rank, verdict, year to date"
```

### Task 6: Colour ramps, text contrast and map features

**Files:** Create `src/lib/colorScale.ts`, `src/lib/colorScale.test.ts`, `src/lib/contrast.ts`, `src/lib/mapFeatures.ts`

- [ ] **Step 1: Write the failing test** `src/lib/colorScale.test.ts` (includes "is relative to the values it was built from", the range-relative requirement)

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { anomalyBin, anomalyColor, buildCountScale, NO_DATA_FILL, ZERO_FILL } from './colorScale'

describe('buildCountScale', () => {
  const values = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]
  it('separates no data, zero and positive counts', () => {
    const s = buildCountScale(values, { method: 'quantile', bins: 4, palette: 'inferno' })
    expect(s.colorOf(null)).toBe(NO_DATA_FILL)
    expect(s.colorOf(0)).toBe(ZERO_FILL)
    expect(s.colorOf(1)).toBe(s.colors[0])
    expect(s.colorOf(100)).toBe(s.colors[s.colors.length - 1])
  })
  it('is relative to the values it was built from', () => {
    const narrow = buildCountScale([1, 2, 3, 4], { method: 'quantile', bins: 4, palette: 'inferno' })
    const wide = buildCountScale([1, 20, 300, 4000], { method: 'quantile', bins: 4, palette: 'inferno' })
    expect(narrow.binOf(4)).toBe(narrow.colors.length - 1)
    expect(wide.binOf(4)).toBe(0)
  })
  it('collapses to one bin when all values are equal', () => {
    const s = buildCountScale([5, 5, 5], { method: 'quantile', bins: 7, palette: 'cividis' })
    expect(s.edges).toEqual([5])
    expect(s.labels).toEqual(['5 to 5'])
  })
  it('falls back to log bins when ties collapse the quantile bins', () => {
    const skewed = [...Array(99).fill(1), 1000]
    const s = buildCountScale(skewed, { method: 'quantile', bins: 7, palette: 'inferno' })
    expect(s.edges.length).toBeGreaterThan(2)
    expect(s.colorOf(1)).not.toBe(s.colorOf(1000))
    // A narrow range keeps its quantile bins: log bins would merge 10 and 19
    const narrow = buildCountScale([...Array(40).fill(10), 11, 12, 13, 14, 15, 16, 17, 18, 19], { method: 'quantile', bins: 7, palette: 'inferno' })
    expect(narrow.colorOf(10)).not.toBe(narrow.colorOf(19))
  })
  it('makes log bins with round numbers', () => {
    const s = buildCountScale([1, 1000], { method: 'log', bins: 3, palette: 'inferno' })
    expect(s.edges).toEqual([1, 10, 100])
  })
})

describe('anomaly colours', () => {
  it('bins symmetric percentages', () => {
    expect(anomalyBin(-80)).toBe(0)
    expect(anomalyBin(0)).toBe(3)
    expect([anomalyBin(-10), anomalyBin(10)]).toEqual([3, 3])
    expect([anomalyBin(-25), anomalyBin(25)]).toEqual([2, 4])
    expect([anomalyBin(-50), anomalyBin(50)]).toEqual([1, 5])
    expect([anomalyBin(-51), anomalyBin(51)]).toEqual([0, 6])
    expect(anomalyBin(300)).toBe(6)
    expect(anomalyColor(null)).toBe(NO_DATA_FILL)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/colorScale.test.ts`
Expected: FAIL, `Failed to resolve import "./colorScale"`.

- [ ] **Step 3: Implement**

`src/lib/colorScale.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Colour ramps. Count bins are rebuilt from the values inside the selected months, so the
// colours are relative to the time range (RAMP in config.ts sets the method; tune with real data).
import { interpolateCividis, interpolateInferno, interpolateRdBu } from 'd3-scale-chromatic'
import { quantile } from './indices'

export type PaletteId = 'inferno' | 'cividis'
export type RampMethod = 'quantile' | 'log'

export const PALETTES: Record<PaletteId, { label: string; interpolate: (t: number) => string }> = {
  inferno: { label: 'Fire (inferno)', interpolate: interpolateInferno },
  cividis: { label: 'Colour-vision optimised (cividis)', interpolate: interpolateCividis },
}

export const ZERO_FILL = '#16285a'
export const NO_DATA_FILL = '#5c6680'

export interface CountScale {
  /** Lower bound of each bin. Bin i covers [edges[i], edges[i+1]) and the last bin goes up to max. */
  edges: number[]
  max: number
  colors: string[]
  colorOf(v: number | null): string
  binOf(v: number): number
  labels: string[]
}

export function fmtCount(v: number): string {
  if (v === 0) return '0'
  if (Math.abs(v) < 10) return (Math.round(v * 10) / 10).toLocaleString('en-GB')
  return Math.round(v).toLocaleString('en-GB')
}

function nice(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x))
  const f = x / p
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p
}

export function buildCountScale(
  values: (number | null)[],
  opts: { method: RampMethod; bins: number; palette: PaletteId },
): CountScale {
  const pos = values.filter((v): v is number => v !== null && v > 0).sort((a, b) => a - b)
  const min = pos[0] ?? 1
  const max = pos[pos.length - 1] ?? 1
  const make = (method: RampMethod) => {
    const t: number[] = []
    for (let k = 1; k < opts.bins; k++) {
      t.push(method === 'quantile' ? quantile(pos, k / opts.bins) : nice(min * (max / min) ** (k / opts.bins)))
    }
    return [...new Set(t.map((x) => Math.round(x * 10) / 10))].filter((x) => x > min && x <= max)
  }
  let thresholds: number[] = []
  if (pos.length > 1) {
    thresholds = make(opts.method)
    // Many tied low counts (lots of 1s and 2s) collapse quantile bins, so 2 and 1000 would share a colour.
    // Then log bins keep the high values apart, if they give more bins (they don't for a narrow range).
    const distinct = new Set(pos).size
    if (opts.method === 'quantile' && thresholds.length + 1 < Math.min(opts.bins, distinct)) {
      const log = make('log')
      if (log.length > thresholds.length) thresholds = log
    }
  }
  const edges = [min, ...thresholds]
  const interp = PALETTES[opts.palette].interpolate
  const n = edges.length
  const colors = edges.map((_, i) => interp(0.2 + 0.78 * (n === 1 ? 1 : i / (n - 1))))
  const binOf = (v: number) => {
    let i = 0
    while (i + 1 < n && v >= edges[i + 1]) i++
    return i
  }
  const labels = edges.map((lo, i) => (i + 1 < n ? `${fmtCount(lo)} to <${fmtCount(edges[i + 1])}` : `${fmtCount(lo)} to ${fmtCount(max)}`))
  return {
    edges, max, colors, labels, binOf,
    colorOf: (v) => (v === null ? NO_DATA_FILL : v <= 0 ? ZERO_FILL : colors[binOf(v)]),
  }
}

/** Anomaly bins in percent, symmetric around 0. Blue = fewer hotspots than usual, red = more (never red-green). */
const ANOMALY_T = [0.92, 0.78, 0.64, 0.5, 0.36, 0.22, 0.08]
export const ANOMALY_COLORS = ANOMALY_T.map((t) => interpolateRdBu(t))
export const ANOMALY_LABELS = [
  'More than 50% below', '25 to 50% below', '10 to 25% below', 'Within 10%',
  '10 to 25% above', '25 to 50% above', 'More than 50% above',
]

/** 0..6: |pct| up to 10 is bin 3; up to 25, up to 50, and beyond step outwards on each side. */
export function anomalyBin(pct: number): number {
  const a = Math.abs(pct)
  const step = a <= 10 ? 0 : a <= 25 ? 1 : a <= 50 ? 2 : 3
  return pct < 0 ? 3 - step : 3 + step
}

export function anomalyColor(pct: number | null): string {
  return pct === null ? NO_DATA_FILL : ANOMALY_COLORS[anomalyBin(pct)]
}
```

`src/lib/contrast.ts` (tested in Task 15)
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.

/** White or black text, whichever contrasts more with the cell (WCAG luminance). Always at least 4.58:1. */
export function textClass(hex: string): 'dark-text' | 'light-text' {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return 'light-text'
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? 'dark-text' : 'light-text'
}
```

`src/lib/mapFeatures.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { buildCountScale, fmtCount, type CountScale, type PaletteId } from './colorScale'
import { cellId, cellRing } from './grid'
import type { OverviewFile } from './types'

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { color: string; label: string }>

export const EMPTY_FC: FC = { type: 'FeatureCollection', features: [] }

export function cellsToFeatures(
  totals: { id: string; total: number | null }[], gridDeg: number, scale: CountScale,
): FC {
  return {
    type: 'FeatureCollection',
    features: totals
      .filter((c) => c.total !== null && c.total > 0)
      .map((c) => ({
        type: 'Feature',
        properties: { color: scale.colorOf(c.total), label: `${fmtCount(c.total as number)} hotspots` },
        geometry: { type: 'Polygon', coordinates: [cellRing(c.id, gridDeg)] },
      })),
  }
}

/** Global context layer: where hotspots usually are. Log bins because counts span orders of magnitude. */
export function overviewToFeatures(ov: OverviewFile, palette: PaletteId): FC {
  const scale = buildCountScale(ov.cells.map((c) => c[2]), { method: 'log', bins: 6, palette })
  return {
    type: 'FeatureCollection',
    features: ov.cells.filter((c) => c[2] > 0).map(([lat, lon, v]) => ({
      type: 'Feature',
      properties: { color: scale.colorOf(v), label: `${fmtCount(v)} hotspots per year` },
      geometry: { type: 'Polygon', coordinates: [cellRing(cellId(lat, lon, ov.grid_deg), ov.grid_deg)] },
    })),
  }
}

export function areaToFeatures(geometry: GeoJSON.Polygon | null): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: geometry ? [{ type: 'Feature', properties: {}, geometry }] : [] }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/colorScale.test.ts`
Expected: `Tests  6 passed (6)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorScale.ts src/lib/colorScale.test.ts src/lib/contrast.ts src/lib/mapFeatures.ts
git commit -m "demo: range-relative colour bins, anomaly colours, map features"
```

### Task 7: CSV export

**Files:** Create `src/lib/csv.ts`, `src/lib/csv.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/csv.test.ts`

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { aggregate, selectCells } from './aggregate'
import { areaFromBbox } from './area'
import { buildCsv, csvFilename } from './csv'
import type { Manifest, TileFile } from './types'

const manifest = {
  schema_version: 1, mock: true, dataset_name: 'Test', grid_deg: 1, tile_deg: 10,
  first_month: '2011-12', last_month: '2012-01', month_to_date: true, nrt_from: '2012-01',
  baseline_years: [2003, 2025], harmonized_coverage: ['2011-12', '2012-01'],
  sensors: [
    { key: 'modis', label: 'MODIS C6.1', source: 'NASA FIRMS', version: '6.1', first_month: '2000-11', last_month: '2026-11' },
    { key: 'viirs_snpp', label: 'VIIRS S-NPP 375 m', source: 'NASA FIRMS', version: '2', first_month: '2012-01', last_month: '2026-11' },
  ],
  coverage: [], tiles: [], presets: [],
  filters: { type: [0], modis_confidence_min: 30, viirs_confidence: ['n', 'h'] },
  method: { name: 'Mock', version: '0', reference_scale: 'VIIRS', fit_years: null, test_years: null },
  validation: { metric: '', value: null, notes: '' }, generated_at: '2026-11-14T00:00:00Z',
} as unknown as Manifest

const tile: TileFile = {
  tile_id: '9_18', cells: ['90_180'],
  series: { harmonized: [[1.25, 2]], modis: [[1, 1]], viirs_snpp: [[null, 3]], viirs_noaa20: [[null, null]] },
}

describe('buildCsv', () => {
  const area = areaFromBbox([0, 0, 2, 2], 'Test, "box"')
  const series = aggregate(manifest, selectCells(area, [tile], 1))
  const csv = buildCsv(manifest, area, series, 0, 1, new Date('2026-11-14T12:00:00Z'))
  const lines = csv.trim().split('\n')
  it('starts with provenance comments', () => {
    expect(lines[0]).toMatch(/^# /)
    expect(csv).toContain('not fires or burned area')
    expect(csv).toContain('MOCK DATA, NOT REAL')
    expect(csv).toContain('Baseline years: 2003-2025')
  })
  it('writes one row per month with blanks for no sensor', () => {
    const rows = lines.filter((l) => !l.startsWith('#'))
    expect(rows[0]).toBe('year,month,hotspots_harmonized,harmonized_low,harmonized_high,modis,viirs_snpp,viirs_noaa20,data_status,sensors')
    expect(rows[1]).toBe('2011,12,1.3,,,1,,,standard,MODIS C6.1')
    expect(rows[2]).toBe('2012,1,2,,,1,3,,partial,MODIS C6.1 + VIIRS S-NPP 375 m')
  })
  it('makes a safe filename', () => {
    expect(csvFilename(area, '2011-12', '2012-01')).toBe('hotspots_test-box_2011-12_2012-01.csv')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: FAIL, `Failed to resolve import "./csv"`.

- [ ] **Step 3: Implement `src/lib/csv.ts`** (columns from HANDOVER F6)

```ts
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
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: `Tests  3 passed (3)`

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "demo: CSV export with provenance header"
```

### Task 8: Mock data and the build guard

**Files:** Create `scripts/make-mock-data.ts`, `scripts/check-data.mjs`; modify `package.json` scripts

- [ ] **Step 1: Create `scripts/make-mock-data.ts`** (deterministic; the same output every run; runs directly on Node 26, which strips TypeScript types)

```ts
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
```

- [ ] **Step 2: Create `scripts/check-data.mjs`**

```js
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
```

- [ ] **Step 3: Set the npm scripts**

```bash
npm pkg set name=hotspot-calendar
npm pkg set scripts.mock-data="node scripts/make-mock-data.ts"
npm pkg set scripts.predev="npm run mock-data"
npm pkg set scripts.check-data="node scripts/check-data.mjs pre"
npm pkg set scripts.build="npm run check-data && tsc -b && vite build && node scripts/check-data.mjs post"
npm pkg set scripts.build:demo="npm run mock-data && ALLOW_MOCK=1 npm run build"
npm pkg set scripts.test="npm run mock-data && vitest run"
npm pkg set scripts.test:e2e="playwright test"
```

- [ ] **Step 4: Generate the mock data**

Run: `npm run mock-data`
Expected: `Mock data: 14 tiles, 445 cells, 313 months -> …/demo/public/data/_mock/` (about 3.2 MB, gitignored)

- [ ] **Step 5: Prove the guard works**

Run: `npm run check-data; echo "exit $?"`
Expected: `Build stopped: dataset "_mock" is MOCK DATA. …` then `exit 1`

- [ ] **Step 6: Run every engine test**

Run: `npm test`
Expected: `Tests  42 passed (42)`

- [ ] **Step 7: Commit**

```bash
git add scripts package.json package-lock.json
git commit -m "demo: deterministic mock data generator and no-mock build guard"
```

#### ✅ CHECKPOINT 1: Engine. Stop and review with Aziz
- `npm test`: 42 pass. `npm run check-data`: exit 1 on mock data.
- Open `public/data/_mock/manifest.json` together: is the tiled contract (section 2.3) acceptable to send to Andre and Pierre?
- Review `src/config.ts` values (TO CONFIRM 3).
- Add a row to `docs/AI_USE.md` (date, files, "engine generated with Claude from the plan").
- Tag: `git tag cp1-engine`. Push only when Aziz says so.

---

### Checkpoint 2: Globe and area selection

### Task 9: Theme, entry point, page frame and About page

**Files:** Create `src/styles/theme.css`, `src/main.tsx` (replace), `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/MockBanner.tsx`, `src/components/AboutPage.tsx`

- [ ] **Step 1: Create `src/styles/theme.css`** (brand tokens from section 2.6, layout, calendar styles)

```css
/* Portions of this file were generated with AI assistance (Claude) and reviewed by the team. */
/* Space Apps brand palette (spaceappschallenge.org/brand): text sits on Deep Blue, Electric Blue or White.
   Neon Yellow is an accent only (focus, highlights), never a background. Contrast >= 4.5:1 for text. */
:root {
  --deep-blue: #07173f;
  --electric-blue: #0042a6;
  --neon-blue: #0960e1;
  --blue-yonder: #2e96f5;
  --rocket-red: #e43700;
  --martian-red: #8e1100;
  --neon-yellow: #eafe07;
  --white: #ffffff;
  --muted: #c9d3ea;
  --line: rgba(255, 255, 255, 0.18);
  --panel: rgba(255, 255, 255, 0.04);
  --font-head: 'Fira Sans', system-ui, sans-serif;
  --font-body: 'Overpass', system-ui, sans-serif;
  color-scheme: dark;
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body { background: var(--deep-blue); color: var(--white); font: 16px/1.5 var(--font-body); }
h1, h2, h3 { font-family: var(--font-head); font-weight: 700; line-height: 1.2; margin: 0 0 0.5rem; }
h1 { font-weight: 900; font-size: 1.5rem; }
h2 { font-size: 1.25rem; }
h3 { font-size: 1rem; }
a { color: var(--blue-yonder); }
p { margin: 0 0 0.75rem; }
.muted { color: var(--muted); }
.small { font-size: 0.875rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

:focus-visible { outline: 3px solid var(--neon-yellow); outline-offset: 2px; }
.skip-link { position: absolute; left: -9999px; top: 0; background: var(--white); color: var(--deep-blue); padding: 0.5rem 1rem; z-index: 10; }
.skip-link:focus { left: 1rem; }

button, select, input { font: inherit; color: inherit; }
button { cursor: pointer; }
.btn { background: var(--electric-blue); color: var(--white); border: 1px solid var(--blue-yonder); border-radius: 6px; padding: 0.4rem 0.8rem; }
.btn:hover { background: var(--neon-blue); }
.btn[aria-pressed='true'] { background: var(--white); color: var(--deep-blue); border-color: var(--white); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
select, input[type='number'], input[type='text'] {
  background: var(--deep-blue); border: 1px solid var(--line); border-radius: 6px; padding: 0.35rem 0.5rem; min-width: 0;
}
fieldset { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem; margin: 0 0 1rem; }
legend { font-family: var(--font-head); font-weight: 700; padding: 0 0.25rem; }
label { display: block; }
.error { color: #ffb4a6; } /* light red on deep blue: 9.6:1 */

/* Header: brand gradient Electric Blue (top left) to Deep Blue (bottom right), 45 degrees */
.header { background: linear-gradient(135deg, var(--electric-blue), var(--deep-blue)); padding: 0.75rem 1.25rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.header nav { margin-left: auto; display: flex; gap: 0.5rem; }
.header .tagline { color: var(--muted); font-size: 0.9rem; }
.mock-banner { background: var(--martian-red); color: var(--white); font-weight: 700; text-align: center; padding: 0.4rem; letter-spacing: 0.04em; }

/* Explore page layout */
.explore { display: grid; grid-template-columns: minmax(280px, 340px) 1fr; grid-template-areas: 'controls map' 'results results'; gap: 1rem; padding: 1rem; }
.controls { grid-area: controls; }
.map-col { grid-area: map; min-width: 0; }
.results { grid-area: results; min-width: 0; }
.globe-wrap { position: relative; height: min(62vh, 640px); border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
.globe { width: 100%; height: 100%; }
.map-fallback { padding: 2rem; border: 1px dashed var(--line); border-radius: 10px; }
@media (max-width: 860px) {
  .explore { grid-template-columns: 1fr; grid-template-areas: 'map' 'controls' 'results'; }
  .globe-wrap { height: 50vh; }
}

.tools { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.tools .btn { display: inline-flex; align-items: center; gap: 0.3rem; }
.row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: end; }
.row > label { flex: 1 1 5rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
.chips .btn { font-size: 0.85rem; padding: 0.2rem 0.6rem; }

.section-nav { position: sticky; top: 0; z-index: 2; background: var(--deep-blue); border-bottom: 1px solid var(--line); display: flex; gap: 1rem; flex-wrap: wrap; padding: 0.5rem 0; margin-bottom: 1rem; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 1rem; margin-bottom: 1rem; }
.card > header { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; justify-content: space-between; }
.caption { color: var(--muted); font-size: 0.875rem; margin-top: 0.5rem; }

/* KPI row */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
.kpi { border: 1px solid var(--line); border-radius: 8px; padding: 0.75rem; }
.kpi .value { font-family: var(--font-head); font-weight: 900; font-size: 1.75rem; }
.verdict { display: inline-block; border-radius: 999px; padding: 0.1rem 0.6rem; font-weight: 700; border: 2px solid currentColor; }

/* Legend */
.legend { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; align-items: center; font-size: 0.8rem; margin-top: 0.5rem; }
.legend .swatch { display: inline-block; width: 1.4rem; height: 0.9rem; vertical-align: middle; margin-right: 0.25rem; border: 1px solid var(--line); }

/* Burning calendar */
.calendar-wrap { overflow-x: auto; }
table.calendar { border-collapse: separate; border-spacing: 2px; font-size: 0.75rem; }
table.calendar th { font-weight: 700; color: var(--muted); padding: 0 0.25rem; text-align: right; white-space: nowrap; }
table.calendar thead th { text-align: center; }
table.calendar td.c { width: 2.6rem; min-width: 2.6rem; height: 1.4rem; text-align: center; color: #000; border-radius: 2px; position: relative; }
table.calendar td.c.dark-text { color: #000; }
table.calendar td.c.light-text { color: var(--white); }
table.calendar td.c.zero { outline: 1px solid var(--line); outline-offset: -1px; }
table.calendar td.c.nodata { background: repeating-linear-gradient(45deg, #5c6680 0 3px, #2a3554 3px 6px) !important; }
table.calendar td.c.outside { opacity: 0.25; }
table.calendar td.c.nrt::after { content: ''; position: absolute; inset: 2px; border: 1.5px dotted var(--white); border-radius: 2px; pointer-events: none; }
table.calendar td.c.partial { outline: 2px solid var(--neon-yellow); outline-offset: -2px; }
table.calendar td.c:focus-visible { outline: 3px solid var(--neon-yellow); outline-offset: 1px; z-index: 1; }
table.calendar td.total { padding-left: 0.5rem; white-space: nowrap; color: var(--muted); }
table.calendar td.total .bar { display: inline-block; height: 0.6rem; background: var(--blue-yonder); margin-right: 0.35rem; vertical-align: middle; }
.cell-detail { min-height: 3rem; margin-top: 0.5rem; }

.figure svg { overflow: visible; }
.footer { border-top: 1px solid var(--line); padding: 1rem 1.25rem; color: var(--muted); font-size: 0.85rem; }
.about { max-width: 52rem; padding: 1rem 1.25rem 2rem; }
.about table { border-collapse: collapse; }
.about td, .about th { border: 1px solid var(--line); padding: 0.3rem 0.5rem; text-align: left; }
.notice { border-left: 4px solid var(--neon-yellow); padding: 0.5rem 0.75rem; background: var(--panel); margin: 0.5rem 0; }
```

- [ ] **Step 2: Replace `src/main.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fira-sans/700.css'
import '@fontsource/fira-sans/900.css'
import '@fontsource/overpass/400.css'
import '@fontsource/overpass/700.css'
import '@fontsource/overpass/400-italic.css'
import './styles/theme.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Create the frame components**

`src/components/Header.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { View } from '../state/appState'

export function Header({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <header className="header">
      <div>
        <h1>Hotspot Calendar</h1>
        <div className="tagline">25 years of satellite fire detections, MODIS and VIIRS on one scale</div>
      </div>
      <nav aria-label="Pages">
        <button className="btn" aria-pressed={view === 'explore'} onClick={() => onView('explore')}>Explore</button>
        <button className="btn" aria-pressed={view === 'about'} onClick={() => onView('about')}>About &amp; methods</button>
      </nav>
    </header>
  )
}
```

`src/components/MockBanner.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
export function MockBanner() {
  return <div className="mock-banner" role="region" aria-label="Mock data warning">MOCK DATA, NOT REAL. Synthetic numbers for testing the app.</div>
}
```

`src/components/Footer.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
export function Footer() {
  return (
    <footer className="footer">
      <p>Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Not an official warning service. Imagery: NASA GIBS.</p>
      <p>
        Built for the NASA International Space Apps Challenge 2026. Not an official NASA product.
        For current fires see the <a href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS Fire Map</a>; for warnings follow your local authorities.
      </p>
    </footer>
  )
}
```

`src/components/AboutPage.tsx` (all method facts come from the manifest. Pierre and Guido own the method wording.)
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Method text is a placeholder until Pierre and Guido write it (docs/METHODS.md). Do not invent the method here.
import type { Manifest } from '../lib/types'

export function AboutPage({ manifest }: { manifest: Manifest }) {
  const m = manifest
  return (
    <main className="about" id="main">
      <h2>What this shows</h2>
      <p>
        A monthly calendar of satellite fire detections ("hotspots") for any area you choose, from the early 2000s to now,
        and how the latest month compares with previous years. NASA's fire record comes from two instruments: MODIS (since 2000)
        and VIIRS (since 2012). They detect fires at different sizes, so joining them without correction shows a false rise in 2012.
        This tool puts both on one scale.
      </p>
      <div className="notice">
        This is a historical record of satellite detections, not a warning system. For current fires see the{' '}
        <a href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS Fire Map</a>; for official warnings follow your local authorities.
      </div>

      <h2>Data</h2>
      <table>
        <thead><tr><th>Product</th><th>Version</th><th>Source</th><th>Months used</th></tr></thead>
        <tbody>
          {m.sensors.map((s) => <tr key={s.key}><td>{s.label}</td><td>{s.version}</td><td>{s.source}</td><td>{s.first_month} to {s.last_month}</td></tr>)}
        </tbody>
      </table>
      <p className="small">
        Filters: fire type {m.filters.type.join(', ')} (0 = presumed vegetation fire); MODIS confidence ≥ {m.filters.modis_confidence_min};
        VIIRS confidence {m.filters.viirs_confidence.join(', ')}. Grid: {m.grid_deg}° cells. Months from {m.nrt_from} are near real-time (provisional) and will be replaced by standard data.
        All times UTC. Dataset generated {m.generated_at}.
      </p>

      <h2>Method</h2>
      <p>{m.method.name} (version {m.method.version}). Reference scale: {m.method.reference_scale}.
        {m.method.fit_years && ` Fitted on ${m.method.fit_years[0]} to ${m.method.fit_years[1]}`}
        {m.method.test_years && `, tested on ${m.method.test_years[0]} to ${m.method.test_years[1]}.`}
      </p>
      <p>Validation: {m.validation.metric} {m.validation.value ?? ''}. {m.validation.notes}</p>

      <h2>How the comparisons work</h2>
      <ul>
        <li>Baseline: {m.baseline_years[0]} to {m.baseline_years[1]}, same calendar month. A month is never part of its own baseline.</li>
        <li>Typical month: the median of the baseline years. Average: the mean. We show both because a few extreme years pull the mean up.</li>
        <li>Verdict words come from the percentile: below 10th "well below", 10th to 25th "below", 25th to 75th "near typical", 75th to 90th "above", over 90th "well above". The number is always shown next to the words.</li>
        <li>Colours: count colours are rebuilt from the months you choose, so they always use the whole ramp. Choose "whole record" to compare with all years instead.</li>
      </ul>

      <h2>Limits</h2>
      <ul>
        <li>A hotspot is a hot pixel seen by a satellite, not a confirmed fire. One large fire can make many hotspots.</li>
        <li>Hotspot counts must not be used to estimate burned area.</li>
        <li>No detection does not mean no fire: cloud, smoke, small or smouldering fires and gaps between satellite passes all hide fires.</li>
        <li>Industrial heat, gas flares and volcanoes are filtered by the FIRMS "type" field where available.</li>
        <li>The sensors in use change over time (Terra, Aqua, S-NPP until November 2026, NOAA-20, NOAA-21). Each comparison names its baseline years.</li>
        <li>Area edges are approximate to one grid cell.</li>
      </ul>

      <h2>Use of AI</h2>
      <p>Parts of this app's code were generated with AI assistance (Claude) and reviewed by the team. The harmonization method is the team's own work. See docs/AI_USE.md in the repository.</p>
    </main>
  )
}
```

- [ ] **Step 4: Commit** (typechecks once App lands in Task 13)

```bash
git add src/styles src/main.tsx src/components/Header.tsx src/components/Footer.tsx src/components/MockBanner.tsx src/components/AboutPage.tsx
git commit -m "demo: brand theme, header, footer, mock banner, about page"
```

### Task 10: App state and data hooks

**Files:** Create `src/state/appState.ts`, `src/state/appState.test.ts`, `src/dataSource.ts`, `src/hooks/useDataset.ts`, `src/hooks/useAreaData.ts`

- [ ] **Step 1: Write the failing test** `src/state/appState.test.ts`

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import type { Manifest } from '../lib/types'
import { initialState, quickRanges, reducer } from './appState'

const m = { harmonized_coverage: ['2000-11', '2026-11'], last_month: '2026-11', month_to_date: true } as unknown as Manifest

describe('appState', () => {
  it('starts on the whole record up to the last complete month, harmonized', () => {
    const s = initialState(m)
    expect([s.from, s.to, s.source]).toEqual(['2000-11', '2026-10', 'harmonized'])
    expect(initialState({ ...m, month_to_date: false }).to).toBe('2026-11')
  })
  it('swaps a backwards range instead of failing', () => {
    const s = reducer(initialState(m), { type: 'setRange', from: '2020-05', to: '2019-01' })
    expect([s.from, s.to]).toEqual(['2019-01', '2020-05'])
  })
  it('turns drawing off when an area is chosen', () => {
    const drawing = reducer(initialState(m), { type: 'setTool', tool: 'circle' })
    expect(reducer(drawing, { type: 'setArea', area: null }).tool).toBe('pan')
  })
  it('offers quick ranges that end at the last complete month', () => {
    const q = quickRanges(m)
    expect(q.map((r) => r.label)).toContain('Whole record')
    expect(q.find((r) => r.label === 'Last 12 months')).toEqual({ label: 'Last 12 months', from: '2025-11', to: '2026-10' })
    expect(q.every((r) => r.to === '2026-10')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/state/appState.test.ts`
Expected: FAIL, `Failed to resolve import "./appState"`.

- [ ] **Step 3: Implement `src/state/appState.ts`** (Task 21 adds one action for shared links). It imports two *types* from `GlobeMap.tsx`, which arrives in Task 11; Vitest strips types, so the test still runs.

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { Basemap, DrawTool } from '../components/GlobeMap'
import type { Area } from '../lib/area'
import type { PaletteId } from '../lib/colorScale'
import { addMonths, formatYm, parseYm, type YearMonth } from '../lib/months'
import type { Manifest, SeriesKey } from '../lib/types'

export type ScaleTo = 'range' | 'record'
export type View = 'explore' | 'about'

export interface AppState {
  area: Area | null
  from: YearMonth
  to: YearMonth
  source: SeriesKey
  scaleTo: ScaleTo
  palette: PaletteId
  tool: DrawTool
  basemap: Basemap
  labels: boolean
  view: View
}

export type Action =
  | { type: 'setArea'; area: Area | null }
  | { type: 'setRange'; from: YearMonth; to: YearMonth }
  | { type: 'setSource'; source: SeriesKey }
  | { type: 'setScaleTo'; scaleTo: ScaleTo }
  | { type: 'setPalette'; palette: PaletteId }
  | { type: 'setTool'; tool: DrawTool }
  | { type: 'setBasemap'; basemap: Basemap }
  | { type: 'setLabels'; labels: boolean }
  | { type: 'setView'; view: View }

/** The latest finished month. A month-to-date total is not comparable with full months, so we don't default to it. */
export function lastComplete(m: Manifest): YearMonth {
  return m.month_to_date ? addMonths(m.last_month, -1) : m.last_month
}

export function initialState(m: Manifest): AppState {
  return {
    area: null,
    from: m.harmonized_coverage[0],
    to: lastComplete(m),
    source: 'harmonized',
    scaleTo: 'range',
    palette: 'inferno',
    tool: 'pan',
    basemap: 'day',
    labels: true,
    view: 'explore',
  }
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setArea': return { ...s, area: a.area, tool: 'pan' }
    case 'setRange': return a.from <= a.to ? { ...s, from: a.from, to: a.to } : { ...s, from: a.to, to: a.from }
    case 'setSource': return { ...s, source: a.source }
    case 'setScaleTo': return { ...s, scaleTo: a.scaleTo }
    case 'setPalette': return { ...s, palette: a.palette }
    case 'setTool': return { ...s, tool: a.tool }
    case 'setBasemap': return { ...s, basemap: a.basemap }
    case 'setLabels': return { ...s, labels: a.labels }
    case 'setView': return { ...s, view: a.view }
  }
}

export interface QuickRange { label: string; from: YearMonth; to: YearMonth }

/** One-click ranges. All end at the latest complete month. */
export function quickRanges(m: Manifest): QuickRange[] {
  const last = lastComplete(m)
  const first = m.harmonized_coverage[0]
  const clamp = (ym: YearMonth) => (ym < first ? first : ym)
  const { year } = parseYm(last)
  return [
    { label: 'Last 12 months', from: clamp(addMonths(last, -11)), to: last },
    { label: 'This year', from: clamp(formatYm(year, 1)), to: last },
    { label: 'Last 5 years', from: clamp(formatYm(year - 4, 1)), to: last },
    { label: 'VIIRS era (2012 on)', from: clamp('2012-01'), to: last },
    { label: 'Whole record', from: first, to: last },
  ]
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/state/appState.test.ts`
Expected: `Tests  4 passed (4)`

- [ ] **Step 5: Create the data source and hooks**

`src/dataSource.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { DATASET } from './config'
import { createDataSource } from './lib/data'

export const dataSource = createDataSource(`${import.meta.env.BASE_URL}data/${DATASET}/`)
```

`src/hooks/useDataset.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useState } from 'react'
import type { DataSource } from '../lib/data'
import type { Manifest, OverviewFile, ReportedFile } from '../lib/types'

export interface Dataset {
  manifest: Manifest | null
  overview: OverviewFile | null
  reported: ReportedFile | null
  error: string | null
}

export function useDataset(ds: DataSource): Dataset {
  const [state, setState] = useState<Dataset>({ manifest: null, overview: null, reported: null, error: null })
  useEffect(() => {
    let alive = true
    Promise.all([ds.manifest(), ds.overview().catch(() => null), ds.reported()])
      .then(([manifest, overview, reported]) => { if (alive) setState({ manifest, overview, reported, error: null }) })
      .catch((e: unknown) => { if (alive) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) })) })
    return () => { alive = false }
  }, [ds])
  return state
}
```

`src/hooks/useAreaData.ts`
```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useState } from 'react'
import { aggregate, coverageOf, selectCells, type AreaSeries, type Selection } from '../lib/aggregate'
import type { Area } from '../lib/area'
import type { DataSource } from '../lib/data'
import { tilesForBbox } from '../lib/grid'
import type { Manifest } from '../lib/types'

export interface AreaData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  selection: Selection | null
  series: AreaSeries | null
  coverage: 'none' | 'partial' | 'full'
  error: string | null
}

const IDLE: AreaData = { status: 'idle', selection: null, series: null, coverage: 'none', error: null }

export function useAreaData(ds: DataSource, manifest: Manifest | null, area: Area | null): AreaData {
  const [state, setState] = useState<AreaData>(IDLE)
  useEffect(() => {
    if (!manifest || !area) { setState(IDLE); return }
    let alive = true
    const coverage = coverageOf(manifest, area)
    setState((s) => ({ ...s, status: 'loading', coverage, error: null }))
    const ids = tilesForBbox(area.bbox, manifest.tile_deg).filter((id) => manifest.tiles.includes(id))
    Promise.all(ids.map((id) => ds.tile(id)))
      .then((tiles) => {
        if (!alive) return
        const selection = selectCells(area, tiles, manifest.grid_deg)
        setState({ status: 'ready', selection, series: aggregate(manifest, selection), coverage, error: null })
      })
      .catch((e: unknown) => {
        if (alive) setState({ ...IDLE, status: 'error', coverage, error: e instanceof Error ? e.message : String(e) })
      })
    return () => { alive = false }
  }, [ds, manifest, area])
  return state
}
```

- [ ] **Step 6: Commit**

```bash
git add src/state src/dataSource.ts src/hooks
git commit -m "demo: app state reducer, quick ranges, dataset and area hooks"
```

### Task 11: The globe

**Files:** Create `src/components/GlobeMap.tsx`

- [ ] **Step 1: Create `src/components/GlobeMap.tsx`.** It contains the two MapLibre 6 fixes from section 0: the named import and the explicit worker URL. Don't remove them.

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useRef, useState } from 'react'
import { Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TerraDraw, TerraDrawCircleMode, TerraDrawFreehandMode, TerraDrawPolygonMode, TerraDrawRectangleMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { areaFromPolygon, type Area } from '../lib/area'
import { areaToFeatures } from '../lib/mapFeatures'

// MapLibre 6 finds its worker relative to its own file, which Vite moves. Point at it explicitly.
setWorkerUrl(workerUrl)

export type DrawTool = 'pan' | 'circle' | 'rectangle' | 'polygon' | 'freehand'
export type Basemap = 'day' | 'night'

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const gibs = (layer: string, level: number, ext: string, date = '') =>
  `${GIBS}/${layer}/default/${date ? date + '/' : ''}GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    day: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [gibs('BlueMarble_ShadedRelief_Bathymetry', 8, 'jpeg')],
      attribution: 'Imagery: NASA GIBS (Blue Marble)' },
    night: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [gibs('VIIRS_Black_Marble', 8, 'png', '2016-01-01')],
      attribution: 'Imagery: NASA GIBS (Black Marble)' },
    features: { type: 'raster', tileSize: 256, maxzoom: 13, tiles: [gibs('Reference_Features_15m', 13, 'png')] },
    labels: { type: 'raster', tileSize: 256, maxzoom: 13, tiles: [gibs('Reference_Labels_15m', 13, 'png')],
      attribution: 'Reference layers: NASA GIBS, © OpenStreetMap contributors' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#07173F' } },
    { id: 'day', type: 'raster', source: 'day' },
    { id: 'night', type: 'raster', source: 'night', layout: { visibility: 'none' } },
    { id: 'features', type: 'raster', source: 'features' },
    { id: 'labels', type: 'raster', source: 'labels' },
  ],
}

const TOOL_LABEL: Record<Exclude<DrawTool, 'pan'>, string> = {
  circle: 'Drawn circle', rectangle: 'Drawn rectangle', polygon: 'Drawn polygon', freehand: 'Drawn freehand area',
}

export interface GlobeMapProps {
  area: Area | null
  cells: GeoJSON.FeatureCollection
  overview: GeoJSON.FeatureCollection
  tool: DrawTool
  basemap: Basemap
  labels: boolean
  /** Called once when the user finishes drawing a shape. */
  onDrawn: (area: Area) => void
}

export function GlobeMap({ area, cells, overview, tool, basemap, labels, onDrawn }: GlobeMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const onDrawnRef = useRef(onDrawn)
  onDrawnRef.current = onDrawn
  const toolRef = useRef(tool)
  toolRef.current = tool
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // Create the map once. Strict mode mounts twice in dev; the cleanup removes the first map.
  useEffect(() => {
    let map: MLMap
    try {
      map = new MLMap({ container: container.current!, style: structuredClone(MAP_STYLE), center: [10, 15], zoom: 1.4, attributionControl: { compact: true } })
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
      return
    }
    mapRef.current = map
    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right')
    map.on('load', () => {
      map.addSource('overview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'overview', type: 'fill', source: 'overview', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.4 } }, 'features')
      map.addSource('cells', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.85 } }, 'features')
      map.addLayer({ id: 'cells-outline', type: 'line', source: 'cells', paint: { 'line-color': '#07173F', 'line-width': 0.5 } }, 'features')
      map.addSource('area', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'area', type: 'line', source: 'area', paint: { 'line-color': '#EAFE07', 'line-width': 2.5 } })

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawCircleMode({ projection: 'globe', drawInteraction: 'click-move-or-drag' }),
          new TerraDrawRectangleMode({ drawInteraction: 'click-move-or-drag' }),
          new TerraDrawPolygonMode(),
          new TerraDrawFreehandMode(),
        ],
      })
      draw.start()
      draw.on('finish', (id) => {
        const f = draw.getSnapshotFeature(id)
        const t = toolRef.current
        if (f && f.geometry.type === 'Polygon' && t !== 'pan') {
          onDrawnRef.current(areaFromPolygon(f.geometry as GeoJSON.Polygon, TOOL_LABEL[t]))
        }
        // Defer the clear: Terra Draw is still inside its own event handler here.
        setTimeout(() => draw.clear(), 0)
      })
      drawRef.current = draw
      setReady(true)
    })
    map.on('error', (e) => console.warn('Map error', e.error))
    return () => {
      drawRef.current?.stop()
      drawRef.current = null
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !drawRef.current) return
    drawRef.current.setMode(tool === 'pan' ? 'static' : tool)
  }, [ready, tool])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('overview') as GeoJSONSource | undefined)?.setData(overview)
  }, [ready, overview])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('cells') as GeoJSONSource | undefined)?.setData(cells)
  }, [ready, cells])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('area') as GeoJSONSource | undefined)?.setData(areaToFeatures(area?.geometry ?? null))
    if (area) {
      const [w, s, e, n] = area.bbox
      map.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 6, duration: 1200 })
    }
  }, [ready, area])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setLayoutProperty('day', 'visibility', basemap === 'day' ? 'visible' : 'none')
    map.setLayoutProperty('night', 'visibility', basemap === 'night' ? 'visible' : 'none')
    map.setLayoutProperty('labels', 'visibility', labels ? 'visible' : 'none')
    map.setLayoutProperty('features', 'visibility', labels ? 'visible' : 'none')
  }, [ready, basemap, labels])

  if (failed) {
    return (
      <div className="map-fallback" role="note">
        The 3D globe could not start ({failed}). It needs WebGL2. Presets and typed coordinates still work, and every chart below is unaffected.
      </div>
    )
  }
  return <div ref={container} className="globe" role="region" aria-label="Globe map. Use the area tools or the coordinate form to choose an area." />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GlobeMap.tsx
git commit -m "demo: MapLibre globe with NASA GIBS imagery, data layers and Terra Draw tools"
```

### Task 12: Area controls, legend and summary

**Files:** Create `src/components/CoordinateForm.tsx`, `src/components/CoordinateForm.test.tsx`, `src/components/AreaPanel.tsx`, `src/components/Legend.tsx`, `src/components/AreaSummary.tsx`

- [ ] **Step 1: Write the failing test** `src/components/CoordinateForm.test.tsx`

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CoordinateForm } from './CoordinateForm'

describe('CoordinateForm', () => {
  it('submits a valid box', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.type(screen.getByLabelText('West'), '-8.7')
    await userEvent.type(screen.getByLabelText('South'), '49.8')
    await userEvent.type(screen.getByLabelText('East'), '1.8')
    await userEvent.type(screen.getByLabelText('North'), '60.9')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(onArea).toHaveBeenCalledTimes(1)
    expect(onArea.mock.calls[0][0].bbox).toEqual([-8.7, 49.8, 1.8, 60.9])
  })
  it('shows a friendly error and does not submit', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.type(screen.getByLabelText('West'), '5')
    await userEvent.type(screen.getByLabelText('South'), '50')
    await userEvent.type(screen.getByLabelText('East'), '1')
    await userEvent.type(screen.getByLabelText('North'), '60')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/West must be less than east/)
    expect(onArea).not.toHaveBeenCalled()
  })
  it('builds a circle from a point', async () => {
    const onArea = vi.fn()
    render(<CoordinateForm onArea={onArea} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Point + radius' }))
    await userEvent.type(screen.getByLabelText('Latitude'), '51.5')
    await userEvent.type(screen.getByLabelText('Longitude'), '-0.1')
    await userEvent.click(screen.getByRole('button', { name: 'Use these coordinates' }))
    expect(onArea.mock.calls[0][0].source).toBe('point')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/CoordinateForm.test.tsx`
Expected: FAIL, `Failed to resolve import "./CoordinateForm"`.

- [ ] **Step 3: Implement**

`src/components/CoordinateForm.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The keyboard route to choosing an area. Drawing on the globe is never the only way.
import { useState, type FormEvent } from 'react'
import { areaFromBbox, areaFromPoint, checkSize, validateBbox, validatePoint, type Area } from '../lib/area'
import type { Bbox } from '../lib/grid'

type Mode = 'bbox' | 'point'
const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export function CoordinateForm({ onArea }: { onArea: (a: Area) => void }) {
  const [mode, setMode] = useState<Mode>('bbox')
  const [v, setV] = useState({ w: '', s: '', e: '', n: '', lat: '', lon: '', r: '50' })
  const [error, setError] = useState<string | null>(null)
  const field = (k: keyof typeof v, label: string, hint: string) => (
    <label>
      {label}
      <input type="text" inputMode="decimal" value={v[k]} aria-describedby="coord-hint"
        onChange={(ev) => setV({ ...v, [k]: ev.target.value })} placeholder={hint} />
    </label>
  )

  function submit(ev: FormEvent) {
    ev.preventDefault()
    let err: string | null
    let area: Area | null = null
    if (mode === 'bbox') {
      const box: Bbox = [num(v.w), num(v.s), num(v.e), num(v.n)]
      err = validateBbox(box)
      if (!err) area = areaFromBbox(box)
    } else {
      const [lat, lon, r] = [num(v.lat), num(v.lon), num(v.r)]
      err = validatePoint(lat, lon, r)
      if (!err) area = areaFromPoint(lat, lon, r)
    }
    if (!err && area) err = checkSize(area)
    setError(err)
    if (!err && area) onArea(area)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Enter coordinates">
      <fieldset>
        <legend className="small">Coordinate type</legend>
        <label><input type="radio" name="coord-mode" checked={mode === 'bbox'} onChange={() => setMode('bbox')} /> Box</label>
        <label><input type="radio" name="coord-mode" checked={mode === 'point'} onChange={() => setMode('point')} /> Point + radius</label>
      </fieldset>
      <p id="coord-hint" className="small muted">Decimal degrees. Latitude −90 to 90, longitude −180 to 180.</p>
      {mode === 'bbox' ? (
        <div className="row">
          {field('w', 'West', '-8.7')}{field('s', 'South', '49.8')}{field('e', 'East', '1.8')}{field('n', 'North', '60.9')}
        </div>
      ) : (
        <div className="row">
          {field('lat', 'Latitude', '51.5')}{field('lon', 'Longitude', '-0.1')}{field('r', 'Radius (km)', '50')}
        </div>
      )}
      <p className="error" role="alert">{error ?? ''}</p>
      <button type="submit" className="btn">Use these coordinates</button>
    </form>
  )
}
```

`src/components/AreaPanel.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { Circle, Hand, Polygon, Scribble, Square } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { areaFromPreset, type Area } from '../lib/area'
import type { Preset } from '../lib/types'
import { CoordinateForm } from './CoordinateForm'
import type { DrawTool } from './GlobeMap'

const TOOLS: { tool: DrawTool; label: string; icon: ReactNode }[] = [
  { tool: 'pan', label: 'Move globe', icon: <Hand aria-hidden /> },
  { tool: 'circle', label: 'Circle', icon: <Circle aria-hidden /> },
  { tool: 'rectangle', label: 'Rectangle', icon: <Square aria-hidden /> },
  { tool: 'polygon', label: 'Polygon', icon: <Polygon aria-hidden /> },
  { tool: 'freehand', label: 'Freehand', icon: <Scribble aria-hidden /> },
]

const HELP: Record<DrawTool, string> = {
  pan: 'Drag to turn the globe, scroll to zoom.',
  circle: 'Click the centre, then click again (or drag) to set the size.',
  rectangle: 'Click one corner, then the opposite corner (or drag).',
  polygon: 'Click each corner. Click the first point again to finish.',
  freehand: 'Click, move to draw around the area, click again to finish.',
}

export interface AreaPanelProps {
  presets: Preset[]
  area: Area | null
  tool: DrawTool
  onTool: (t: DrawTool) => void
  onArea: (a: Area) => void
  /** Why the last drawn shape was rejected, if it was. */
  error?: string | null
}

export function AreaPanel({ presets, area, tool, onTool, onArea, error }: AreaPanelProps) {
  const presetValue = area?.source === 'preset' ? area.presetId ?? '' : ''
  return (
    <fieldset>
      <legend>1. Choose an area</legend>
      <label>
        Preset region
        <select value={presetValue} onChange={(e) => {
          const p = presets.find((x) => x.id === e.target.value)
          if (p) onArea(areaFromPreset(p))
        }}>
          <option value="">Choose a region…</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <p className="small" style={{ marginTop: '0.75rem' }}>Or draw on the globe:</p>
      <div className="tools" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map((t) => (
          <button key={t.tool} type="button" className="btn" aria-pressed={tool === t.tool} onClick={() => onTool(t.tool)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <p className="small muted" aria-live="polite">{HELP[tool]}</p>
      {error && <p className="error small" role="alert">{error}</p>}
      <details>
        <summary>Or type coordinates</summary>
        <CoordinateForm onArea={onArea} />
      </details>
    </fieldset>
  )
}
```

`src/components/Legend.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { NO_DATA_FILL, ZERO_FILL, type CountScale } from '../lib/colorScale'

export function Legend({ scale, title, id, showNrt = false }: { scale: CountScale; title: string; id?: string; showNrt?: boolean }) {
  return (
    <div className="legend" id={id} aria-label={title}>
      <strong>{title}</strong>
      <span><span className="swatch" style={{ background: `repeating-linear-gradient(45deg, ${NO_DATA_FILL} 0 3px, #2a3554 3px 6px)` }} />No sensor / not yet</span>
      <span><span className="swatch" style={{ background: ZERO_FILL }} />0</span>
      {scale.colors.map((c, i) => (
        <span key={c + i}><span className="swatch" style={{ background: c }} />{scale.labels[i]}</span>
      ))}
      {showNrt && <>
        <span><span className="swatch" style={{ border: '1.5px dotted #fff' }} />Near real-time: provisional</span>
        <span><span className="swatch" style={{ outline: '2px solid var(--neon-yellow)', outlineOffset: '-2px' }} />Month to date</span>
      </>}
    </div>
  )
}
```

`src/components/AreaSummary.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import type { Area } from '../lib/area'
import type { AreaData } from '../hooks/useAreaData'

export function AreaSummary({ area, data, gridDeg }: { area: Area | null; data: AreaData; gridDeg: number }) {
  if (!area) return <p className="muted">No area chosen yet. Pick a preset, draw on the globe, or type coordinates.</p>
  const km2 = Math.round(area.areaKm2).toLocaleString('en-GB')
  return (
    <div aria-live="polite">
      <p><strong>{area.label}</strong>: {km2} km². {data.selection ? `${data.selection.cells.length} grid cells with detections (${gridDeg}° cells, counted when the cell centre is inside the area).` : ''}</p>
      {data.status === 'loading' && <p className="muted">Loading data for this area…</p>}
      {data.status === 'error' && <p className="error">Could not load data: {data.error}</p>}
      {data.coverage === 'none' && <p className="notice">No data is loaded for this area yet. This is not the same as "no fires".</p>}
      {data.coverage === 'partial' && <p className="notice">Part of this area is outside the loaded data, so totals may be too low.</p>}
      {data.selection?.fallback && <p className="notice">No {gridDeg}° grid-cell centre lies inside this area, so we show the cell that contains its centre.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/CoordinateForm.test.tsx`
Expected: `Tests  3 passed (3)`

- [ ] **Step 5: Commit**

```bash
git add src/components/CoordinateForm.tsx src/components/CoordinateForm.test.tsx src/components/AreaPanel.tsx src/components/Legend.tsx src/components/AreaSummary.tsx
git commit -m "demo: presets, drawing tools, typed coordinates, legend, area summary"
```

### Task 13: Wire App (Checkpoint 2 version)

**Files:** Replace `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Checkpoint 2 version: globe, area selection and area summary. Replaced at checkpoints 3 and 4.
import { useMemo, useReducer, useState } from 'react'
import { AboutPage } from './components/AboutPage'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { Footer } from './components/Footer'
import { GlobeMap } from './components/GlobeMap'
import { Header } from './components/Header'
import { Legend } from './components/Legend'
import { MockBanner } from './components/MockBanner'
import { RAMP } from './config'
import { dataSource } from './dataSource'
import { useAreaData } from './hooks/useAreaData'
import { useDataset } from './hooks/useDataset'
import { cellTotals } from './lib/aggregate'
import { areaFromPreset, validateDrawn } from './lib/area'
import { buildCountScale } from './lib/colorScale'
import { cellsToFeatures, EMPTY_FC, overviewToFeatures } from './lib/mapFeatures'
import { labelYm } from './lib/months'
import type { Manifest } from './lib/types'
import { initialState, reducer, type AppState } from './state/appState'

export default function App() {
  const { manifest, overview, reported, error } = useDataset(dataSource)
  if (error) return <p className="error" role="alert" style={{ padding: '2rem' }}>Could not load the dataset: {error}</p>
  if (!manifest) return <p style={{ padding: '2rem' }}>Loading data…</p>
  return <Explorer manifest={manifest} overview={overview} reported={reported} />
}

function Explorer({ manifest: m, overview }: { manifest: Manifest } & Pick<ReturnType<typeof useDataset>, 'overview' | 'reported'>) {
  const [s, dispatch] = useReducer(reducer, m, (mm): AppState => {
    const init = initialState(mm)
    return mm.presets[0] ? { ...init, area: areaFromPreset(mm.presets[0]) } : init
  })
  const data = useAreaData(dataSource, m, s.area)
  const [drawError, setDrawError] = useState<string | null>(null)
  const series = data.series
  const i0 = series ? series.months.indexOf(s.from) : -1
  const i1 = series ? series.months.indexOf(s.to) : -1

  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.grid_deg, scale), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.grid_deg])
  const overviewFc = useMemo(() => (overview ? overviewToFeatures(overview, s.palette) : EMPTY_FC), [overview, s.palette])

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to main content</a>
      {m.mock && <MockBanner />}
      <Header view={s.view} onView={(view) => dispatch({ type: 'setView', view })} />
      {s.view === 'about' ? <AboutPage manifest={m} /> : (
        <main className="explore" id="main">
          <aside className="controls" aria-label="Choose an area and months">
            <AreaPanel presets={m.presets} area={s.area} tool={s.tool} error={drawError}
              onTool={(tool) => dispatch({ type: 'setTool', tool })}
              onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
          </aside>
          <section className="map-col" aria-label="Map">
            <div className="globe-wrap">
              <GlobeMap area={s.area} cells={cells} overview={overviewFc} tool={s.tool} basemap={s.basemap} labels={s.labels}
                onDrawn={(area) => {
                  const err = validateDrawn(area)
                  setDrawError(err)
                  dispatch(err ? { type: 'setTool', tool: 'pan' } : { type: 'setArea', area })
                }} />
            </div>
            {mapScale && <Legend scale={mapScale} title={`Hotspots per ${m.grid_deg}° cell, ${labelYm(s.from)} to ${labelYm(s.to)} (bins fit these months)`} />}
            <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
          </section>
          <section className="results" id="results" aria-label="Results" tabIndex={-1}>
            <p className="muted">The burning calendar arrives at checkpoint 3.</p>
          </section>
        </main>
      )}
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck, test, lint**

Run: `npx tsc -b && npm test && npx oxlint`
Expected: no tsc output; `Tests  49 passed (49)`; oxlint shows warnings only (React advice about refs and setState-in-effect), no errors.

- [ ] **Step 3: Run it and check by hand**

Run: `npm run dev` and open the printed URL (keep the tab in front).
Check:
- [ ] The red "MOCK DATA, NOT REAL" banner shows.
- [ ] The globe shows Blue Marble imagery and flies to "Southern Africa savanna (mock)", whose cells are coloured with a yellow outline.
- [ ] The preset dropdown, set to "United Kingdom (mock)", flies to the UK.
- [ ] Circle: drag on the globe and the summary reads "Drawn circle: … km²". Do the same with Rectangle, Polygon and Freehand.
- [ ] Zoom out fully and draw a huge circle: a red message explains the size limit, and the area does not change.
- [ ] "Or type coordinates": West `5`, East `1` shows the 180° message; a valid box works; Point + radius works.
- [ ] A box over South America says "No data is loaded for this area yet".
- [ ] "About & methods" opens, "Explore" comes back.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "demo: checkpoint 2, globe with four ways to choose an area"
```

#### ✅ CHECKPOINT 2: Globe and area. Stop and review with Aziz
Show the check list above live. Agree the look (brand colours, layout) before building more on it. Add a row to `docs/AI_USE.md`. Tag `cp2-globe`.

---

### Checkpoint 3: Months, display options and the burning calendar

### Task 14: Month range and display options

**Files:** Create `src/components/TimeRangePicker.tsx`, `src/components/TimeRangePicker.test.tsx`, `src/components/DisplayOptions.tsx`

- [ ] **Step 1: Write the failing test** `src/components/TimeRangePicker.test.tsx`

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeRangePicker } from './TimeRangePicker'

const props = {
  first: '2000-11', last: '2026-11', from: '2000-11', to: '2026-11',
  quick: [{ label: 'Last 12 months', from: '2025-12', to: '2026-11' }],
}

describe('TimeRangePicker', () => {
  it('applies a quick range', async () => {
    const onChange = vi.fn()
    render(<TimeRangePicker {...props} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Last 12 months' }))
    expect(onChange).toHaveBeenCalledWith('2025-12', '2026-11')
  })
  it('changes the start year and clamps to the data', async () => {
    const onChange = vi.fn()
    render(<TimeRangePicker {...props} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('From year'), '2019')
    expect(onChange).toHaveBeenCalledWith('2019-11', '2026-11')
    await userEvent.selectOptions(screen.getByLabelText('To month'), '12')
    expect(onChange).toHaveBeenLastCalledWith('2000-11', '2026-11')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/TimeRangePicker.test.tsx`
Expected: FAIL, `Failed to resolve import "./TimeRangePicker"`.

- [ ] **Step 3: Implement**

`src/components/TimeRangePicker.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useId } from 'react'
import { formatYm, MONTH_LONG, parseYm, type YearMonth } from '../lib/months'
import type { QuickRange } from '../state/appState'

export interface TimeRangePickerProps {
  first: YearMonth
  last: YearMonth
  from: YearMonth
  to: YearMonth
  quick: QuickRange[]
  onChange: (from: YearMonth, to: YearMonth) => void
}

function MonthSelect({ label, value, first, last, onChange }: {
  label: string; value: YearMonth; first: YearMonth; last: YearMonth; onChange: (ym: YearMonth) => void
}) {
  const id = useId()
  const { year, month } = parseYm(value)
  const y0 = parseYm(first).year
  const y1 = parseYm(last).year
  const clamp = (ym: YearMonth) => (ym < first ? first : ym > last ? last : ym)
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="small">{label}</span>
      <div className="row">
        <label className="sr-only" htmlFor={`${id}-m`}>{label} month</label>
        <select id={`${id}-m`} value={month} onChange={(e) => onChange(clamp(formatYm(year, Number(e.target.value))))}>
          {MONTH_LONG.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        <label className="sr-only" htmlFor={`${id}-y`}>{label} year</label>
        <select id={`${id}-y`} value={year} onChange={(e) => onChange(clamp(formatYm(Number(e.target.value), month)))}>
          {Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  )
}

export function TimeRangePicker({ first, last, from, to, quick, onChange }: TimeRangePickerProps) {
  return (
    <fieldset>
      <legend>2. Choose months</legend>
      <div className="row">
        <MonthSelect label="From" value={from} first={first} last={last} onChange={(ym) => onChange(ym, to)} />
        <MonthSelect label="To" value={to} first={first} last={last} onChange={(ym) => onChange(from, ym)} />
      </div>
      <div className="chips" aria-label="Quick ranges">
        {quick.map((q) => (
          <button key={q.label} type="button" className="btn" aria-pressed={q.from === from && q.to === to} onClick={() => onChange(q.from, q.to)}>
            {q.label}
          </button>
        ))}
      </div>
      <p className="small muted">All months are UTC. Colours rescale to the months you choose.</p>
    </fieldset>
  )
}
```

`src/components/DisplayOptions.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { PALETTES, type PaletteId } from '../lib/colorScale'
import { SERIES_KEYS, SERIES_LABELS, type SeriesKey } from '../lib/types'
import type { ScaleTo } from '../state/appState'
import type { Basemap } from './GlobeMap'

export interface DisplayOptionsProps {
  source: SeriesKey
  scaleTo: ScaleTo
  palette: PaletteId
  basemap: Basemap
  labels: boolean
  onSource: (s: SeriesKey) => void
  onScaleTo: (s: ScaleTo) => void
  onPalette: (p: PaletteId) => void
  onBasemap: (b: Basemap) => void
  onLabels: (l: boolean) => void
}

export function DisplayOptions(p: DisplayOptionsProps) {
  return (
    <fieldset>
      <legend>3. Display</legend>
      <fieldset>
        <legend className="small">Data</legend>
        {SERIES_KEYS.map((k) => (
          <label key={k}>
            <input type="radio" name="source" checked={p.source === k} onChange={() => p.onSource(k)} /> {SERIES_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="small">Calendar colours scaled to</legend>
        <label><input type="radio" name="scale" checked={p.scaleTo === 'range'} onChange={() => p.onScaleTo('range')} /> The months I chose</label>
        <label><input type="radio" name="scale" checked={p.scaleTo === 'record'} onChange={() => p.onScaleTo('record')} /> The whole record</label>
      </fieldset>
      <label>
        Colour ramp
        <select value={p.palette} onChange={(e) => p.onPalette(e.target.value as PaletteId)}>
          {(Object.keys(PALETTES) as PaletteId[]).map((id) => <option key={id} value={id}>{PALETTES[id].label}</option>)}
        </select>
      </label>
      <label>
        Globe imagery
        <select value={p.basemap} onChange={(e) => p.onBasemap(e.target.value as Basemap)}>
          <option value="day">Blue Marble (day)</option>
          <option value="night">Black Marble (night lights)</option>
        </select>
      </label>
      <label><input type="checkbox" checked={p.labels} onChange={(e) => p.onLabels(e.target.checked)} /> Borders and place names</label>
    </fieldset>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/TimeRangePicker.test.tsx`
Expected: `Tests  2 passed (2)`

- [ ] **Step 5: Commit**

```bash
git add src/components/TimeRangePicker.tsx src/components/TimeRangePicker.test.tsx src/components/DisplayOptions.tsx
git commit -m "demo: month range picker with quick ranges, display options"
```

### Task 15: Burning calendar

**Files:** Create `src/components/BurningCalendar.tsx`, `src/components/BurningCalendar.test.tsx`

- [ ] **Step 1: Write the failing test** `src/components/BurningCalendar.test.tsx` (it also tests `textClass` from Task 6)

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildCountScale } from '../lib/colorScale'
import { monthRange } from '../lib/months'
import { BurningCalendar } from './BurningCalendar'

const months = monthRange('2011-01', '2012-12')
const values = months.map((ym) => (ym < '2011-03' ? null : ym === '2011-06' ? 0 : 10))
const scale = buildCountScale(values, { method: 'quantile', bins: 4, palette: 'inferno' })

function setup(onFocusMonth = vi.fn()) {
  render(
    <BurningCalendar months={months} values={values} from="2011-01" to="2012-12" scale={scale}
      statusOf={(ym) => (ym === '2012-12' ? 'partial' : 'standard')} baselineYears={[2011, 2012]}
      seriesLabel="harmonized" legendId="lg" onFocusMonth={onFocusMonth} />,
  )
  return onFocusMonth
}

describe('BurningCalendar', () => {
  it('has one row per year and labels every month', () => {
    setup()
    expect(screen.getByRole('rowheader', { name: '2011' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '2012' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Jan 2011: no data/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Jun 2011: 0 hotspots/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Dec 2012: 10 hotspots.*Month to date/)).toBeInTheDocument()
  })
  it('moves focus with the arrow keys', () => {
    const onFocusMonth = setup()
    const last = screen.getByLabelText(/Dec 2012/)
    last.focus()
    fireEvent.keyDown(last, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByLabelText(/Dec 2011/))
    expect(onFocusMonth).toHaveBeenLastCalledWith('2011-12')
  })
  it('shows numbers when the table view is on', async () => {
    setup()
    await userEvent.click(screen.getByLabelText(/Show numbers/))
    expect(screen.getByLabelText(/Jul 2011/)).toHaveTextContent('10')
  })
})

describe('textClass', () => {
  it('picks the text colour with more contrast', async () => {
    const { textClass } = await import('../lib/contrast')
    expect(textClass('#da4e3c')).toBe('dark-text') // black on this red: 5.0:1, white only 4.1:1
    expect(textClass('#07173f')).toBe('light-text')
    expect(textClass('#fcffa4')).toBe('dark-text')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/BurningCalendar.test.tsx`
Expected: FAIL, `Failed to resolve import "./BurningCalendar"`.

- [ ] **Step 3: Implement `src/components/BurningCalendar.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Years x months. An HTML table, not a canvas, so screen readers and keyboards get the same numbers.
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { fmtCount, type CountScale } from '../lib/colorScale'
import { textClass } from '../lib/contrast'
import { quantile } from '../lib/indices'
import { formatYm, labelYm, MONTH_SHORT, parseYm, type YearMonth } from '../lib/months'
import { STATUS_LABELS, type MonthStatus } from '../lib/status'

export interface BurningCalendarProps {
  months: YearMonth[]
  values: (number | null)[]
  from: YearMonth
  to: YearMonth
  scale: CountScale
  statusOf: (ym: YearMonth) => MonthStatus
  baselineYears: [number, number]
  seriesLabel: string
  legendId: string
  onFocusMonth?: (ym: YearMonth) => void
}

function toHex(color: string): string {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color)
  return m ? '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('') : color
}

export function BurningCalendar(p: BurningCalendarProps) {
  const index = useMemo(() => new Map(p.months.map((ym, i) => [ym, i])), [p.months])
  const y0 = parseYm(p.from).year
  const y1 = parseYm(p.to).year
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
  const [showNumbers, setShowNumbers] = useState(false)
  const [active, setActive] = useState<YearMonth>(p.to)
  const tableRef = useRef<HTMLTableElement>(null)

  const valueOf = (ym: YearMonth) => {
    const i = index.get(ym)
    return i === undefined ? null : p.values[i]
  }
  const inRange = (ym: YearMonth) => ym >= p.from && ym <= p.to

  const yearTotals = years.map((y) => {
    let t: number | null = null
    for (let m = 1; m <= 12; m++) {
      const ym = formatYm(y, m)
      const v = valueOf(ym)
      if (inRange(ym) && v !== null) t = (t ?? 0) + v
    }
    return t
  })
  const maxTotal = Math.max(1, ...yearTotals.map((t) => t ?? 0))
  const medians = Array.from({ length: 12 }, (_, i) => {
    const vals = p.months
      .map((ym, j) => ({ ...parseYm(ym), v: p.values[j] }))
      .filter((x) => x.month === i + 1 && x.year >= p.baselineYears[0] && x.year <= p.baselineYears[1] && x.v !== null)
      .map((x) => x.v as number)
      .sort((a, b) => a - b)
    return vals.length ? quantile(vals, 0.5) : null
  })

  function describe(ym: YearMonth): string {
    const v = valueOf(ym)
    const status = p.statusOf(ym)
    if (v === null) return `${labelYm(ym)}: no data (${STATUS_LABELS[status]}).`
    return `${labelYm(ym)}: ${fmtCount(v)} hotspots detected, ${p.seriesLabel}. ${STATUS_LABELS[status]}.${inRange(ym) ? '' : ' Outside the chosen months.'}`
  }

  function move(ev: KeyboardEvent<HTMLTableElement>) {
    const { year, month } = parseYm(active)
    const delta: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    let next: YearMonth | null = null
    if (delta[ev.key]) {
      const [dy, dm] = delta[ev.key]
      const ny = year + dy
      const nm = month + dm
      if (ny >= y0 && ny <= y1 && nm >= 1 && nm <= 12) next = formatYm(ny, nm)
    } else if (ev.key === 'Home') next = formatYm(year, 1)
    else if (ev.key === 'End') next = formatYm(year, 12)
    if (!next) return
    ev.preventDefault()
    setActive(next)
    p.onFocusMonth?.(next)
    tableRef.current?.querySelector<HTMLElement>(`[data-ym="${next}"]`)?.focus()
  }

  const activeInView = parseYm(active).year >= y0 && parseYm(active).year <= y1 ? active : p.to

  return (
    <div>
      <label className="small"><input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} /> Show numbers in cells (table view)</label>
      <div className="calendar-wrap">
        <table className="calendar" ref={tableRef} onKeyDown={move} aria-describedby={p.legendId}>
          <caption className="sr-only">
            Burning calendar: hotspots detected per month, {p.from} to {p.to}, {p.seriesLabel}. Use arrow keys to move between months.
          </caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Year</span></th>
              {MONTH_SHORT.map((m) => <th key={m} scope="col">{m}</th>)}
              <th scope="col">Year total</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y, yi) => (
              <tr key={y}>
                <th scope="row">{y}</th>
                {MONTH_SHORT.map((_, mi) => {
                  const ym = formatYm(y, mi + 1)
                  const v = valueOf(ym)
                  const status = p.statusOf(ym)
                  const fill = p.scale.colorOf(v)
                  const cls = ['c',
                    v === null ? 'nodata' : v === 0 ? 'zero' : '',
                    inRange(ym) ? '' : 'outside',
                    status === 'nrt' ? 'nrt' : '', status === 'partial' ? 'partial' : '',
                    v !== null ? textClass(toHex(fill)) : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td key={ym} data-ym={ym} className={cls} style={{ background: fill }}
                      tabIndex={ym === activeInView ? 0 : -1} aria-label={describe(ym)}
                      onFocus={() => { setActive(ym); p.onFocusMonth?.(ym) }}
                      onMouseEnter={() => p.onFocusMonth?.(ym)}>
                      {showNumbers && v !== null ? fmtCount(v) : ''}
                    </td>
                  )
                })}
                <td className="total">
                  <span className="bar" style={{ width: `${((yearTotals[yi] ?? 0) / maxTotal) * 4}rem` }} aria-hidden />
                  {yearTotals[yi] === null ? '' : fmtCount(yearTotals[yi] as number)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Median {p.baselineYears[0]}–{p.baselineYears[1]}</th>
              {medians.map((v, i) => {
                const fill = p.scale.colorOf(v)
                return (
                  <td key={i} className={`c ${v === null ? 'nodata' : textClass(toHex(fill))}`} style={{ background: fill }}>
                    {v === null ? '' : fmtCount(v)}
                  </td>
                )
              })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/BurningCalendar.test.tsx`
Expected: `Tests  4 passed (4)`

- [ ] **Step 5: Commit**

```bash
git add src/components/BurningCalendar.tsx src/components/BurningCalendar.test.tsx
git commit -m "demo: accessible burning calendar with keyboard navigation and table view"
```

### Task 16: Wire App (Checkpoint 3 version)

**Files:** Replace `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Checkpoint 3 version: adds months, display options and the burning calendar. Replaced at checkpoint 4.
import { useEffect, useMemo, useReducer, useState } from 'react'
import { AboutPage } from './components/AboutPage'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { BurningCalendar } from './components/BurningCalendar'
import { DisplayOptions } from './components/DisplayOptions'
import { Footer } from './components/Footer'
import { GlobeMap } from './components/GlobeMap'
import { Header } from './components/Header'
import { Legend } from './components/Legend'
import { MockBanner } from './components/MockBanner'
import { TimeRangePicker } from './components/TimeRangePicker'
import { RAMP } from './config'
import { dataSource } from './dataSource'
import { useAreaData } from './hooks/useAreaData'
import { useDataset } from './hooks/useDataset'
import { cellTotals } from './lib/aggregate'
import { areaFromPreset, validateDrawn } from './lib/area'
import { buildCountScale } from './lib/colorScale'
import { summarizeMonth } from './lib/indices'
import { cellsToFeatures, EMPTY_FC, overviewToFeatures } from './lib/mapFeatures'
import { labelYm, type YearMonth } from './lib/months'
import { monthStatus, sensorsIn } from './lib/status'
import { SERIES_LABELS, type Manifest } from './lib/types'
import { initialState, quickRanges, reducer, type AppState } from './state/appState'

export default function App() {
  const { manifest, overview, reported, error } = useDataset(dataSource)
  if (error) return <p className="error" role="alert" style={{ padding: '2rem' }}>Could not load the dataset: {error}</p>
  if (!manifest) return <p style={{ padding: '2rem' }}>Loading data…</p>
  return <Explorer manifest={manifest} overview={overview} reported={reported} />
}

function Explorer({ manifest: m, overview }: { manifest: Manifest } & Pick<ReturnType<typeof useDataset>, 'overview' | 'reported'>) {
  const [s, dispatch] = useReducer(reducer, m, (mm): AppState => {
    const init = initialState(mm)
    return mm.presets[0] ? { ...init, area: areaFromPreset(mm.presets[0]) } : init
  })
  const data = useAreaData(dataSource, m, s.area)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [hoverMonth, setHoverMonth] = useState<YearMonth | null>(null)
  useEffect(() => setHoverMonth(null), [s.area, s.source])

  const series = data.series
  const i0 = series ? series.months.indexOf(s.from) : -1
  const i1 = series ? series.months.indexOf(s.to) : -1
  const values = useMemo(() => series?.values[s.source] ?? [], [series, s.source])
  const seriesLabel = SERIES_LABELS[s.source]

  const calendarScale = useMemo(() => buildCountScale(
    s.scaleTo === 'range' && i0 >= 0 ? values.slice(i0, i1 + 1) : values,
    { ...RAMP, palette: s.palette },
  ), [values, i0, i1, s.scaleTo, s.palette])

  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.grid_deg, scale), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.grid_deg])

  const overviewFc = useMemo(() => (overview ? overviewToFeatures(overview, s.palette) : EMPTY_FC), [overview, s.palette])

  const showResults = series && data.status === 'ready' && data.coverage !== 'none' && i0 >= 0 && i1 >= 0

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to main content</a>
      {m.mock && <MockBanner />}
      <Header view={s.view} onView={(view) => dispatch({ type: 'setView', view })} />
      {s.view === 'about' ? <AboutPage manifest={m} /> : (
        <main className="explore" id="main">
          <aside className="controls" aria-label="Choose an area and months">
            <AreaPanel presets={m.presets} area={s.area} tool={s.tool} error={drawError}
              onTool={(tool) => dispatch({ type: 'setTool', tool })}
              onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
            <TimeRangePicker first={m.harmonized_coverage[0]} last={m.last_month} from={s.from} to={s.to}
              quick={quickRanges(m)} onChange={(from, to) => dispatch({ type: 'setRange', from, to })} />
            <DisplayOptions source={s.source} scaleTo={s.scaleTo} palette={s.palette} basemap={s.basemap} labels={s.labels}
              onSource={(source) => dispatch({ type: 'setSource', source })}
              onScaleTo={(scaleTo) => dispatch({ type: 'setScaleTo', scaleTo })}
              onPalette={(palette) => dispatch({ type: 'setPalette', palette })}
              onBasemap={(basemap) => dispatch({ type: 'setBasemap', basemap })}
              onLabels={(labels) => dispatch({ type: 'setLabels', labels })} />
          </aside>
          <section className="map-col" aria-label="Map">
            <div className="globe-wrap">
              <GlobeMap area={s.area} cells={cells} overview={overviewFc} tool={s.tool} basemap={s.basemap} labels={s.labels}
                onDrawn={(area) => {
                  const err = validateDrawn(area)
                  setDrawError(err)
                  dispatch(err ? { type: 'setTool', tool: 'pan' } : { type: 'setArea', area })
                }} />
            </div>
            {mapScale && <Legend scale={mapScale} title={`Hotspots per ${m.grid_deg}° cell, ${labelYm(s.from)} to ${labelYm(s.to)} (bins fit these months)`} />}
            <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
          </section>
          <section className="results" id="results" aria-label="Results" tabIndex={-1}>
            {!showResults ? <p className="muted">Results appear here once an area with data is chosen.</p> : (
              <>
                <section className="card" id="calendar" aria-labelledby="cal-title">
                  <header><h2 id="cal-title">Burning calendar</h2></header>
                  <Legend id="cal-legend" scale={calendarScale} showNrt
                    title={s.scaleTo === 'range' ? `Hotspots per month (bins fit ${labelYm(s.from)} to ${labelYm(s.to)})` : 'Hotspots per month (bins fit the whole record)'} />
                  <BurningCalendar months={series.months} values={values} from={s.from} to={s.to} scale={calendarScale}
                    statusOf={(ym) => monthStatus(m, ym)} baselineYears={m.baseline_years} seriesLabel={seriesLabel}
                    legendId="cal-legend" onFocusMonth={setHoverMonth} />
                  <CellDetail ym={hoverMonth} values={values} months={series.months} manifest={m} seriesLabel={seriesLabel} />
                </section>
                <p className="muted">Summary, charts and download arrive at checkpoint 4.</p>
              </>
            )}
          </section>
        </main>
      )}
      <Footer />
    </div>
  )
}

function CellDetail({ ym, values, months, manifest, seriesLabel }: {
  ym: YearMonth | null; values: (number | null)[]; months: YearMonth[]; manifest: Manifest; seriesLabel: string
}) {
  if (!ym) return <p className="cell-detail muted small">Hover or use the arrow keys on the calendar to see one month in detail.</p>
  const sum = summarizeMonth(values, months, ym, manifest.baseline_years)
  const sensors = sensorsIn(manifest, ym).map((x) => x.label).join(', ') || 'none'
  return (
    <p className="cell-detail" aria-live="polite">
      <strong>{labelYm(ym)}</strong>: {sum.value === null ? 'no data' : `${Math.round(sum.value).toLocaleString('en-GB')} hotspots detected`} ({seriesLabel}).{' '}
      {sum.rank && sum.vsMedianPct !== null && `Rank ${sum.rank.rank} of ${sum.rank.of} for this calendar month; ${Math.round(100 + sum.vsMedianPct)}% of the ${manifest.baseline_years[0]}–${manifest.baseline_years[1]} median (${Math.round(sum.baseline!.median)}). `}
      Sensors: {sensors}.
    </p>
  )
}
```

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc -b && npm test`
Expected: `Tests  55 passed (55)`

- [ ] **Step 3: Check by hand** (`npm run dev`)
- [ ] The calendar shows years 2000 to 2026. Nov 2026 has a yellow outline (month to date). Jul to Oct 2026 have dotted borders (NRT). Nov 2000 to Feb 2001 for "VIIRS S-NPP only" are hatched.
- [ ] "Last 5 years": the calendar shrinks to 2022 to 2026, the legend edges change, and the map colours change. **This is the "colours relative to the time range" requirement.**
- [ ] "Calendar colours scaled to: whole record" makes recent years look different again.
- [ ] Tab into the calendar, then use the arrow keys: the focus moves and the detail line updates.
- [ ] "Show numbers in cells" prints the values.
- [ ] Switch the data to MODIS, then to VIIRS S-NPP: the values change and pre-2012 VIIRS cells are hatched.
- [ ] The colour ramp setting switches inferno and cividis.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "demo: checkpoint 3, months, display options and burning calendar"
```

#### ✅ CHECKPOINT 3: Calendar and colour ramps. Stop and review with Aziz
Decide together whether quantile or log bins read better (section 2.2). On real data this is re-checked at Checkpoint 6. Add a row to `docs/AI_USE.md`. Tag `cp3-calendar`.

---

### Checkpoint 4: Indices, charts, download, sharing

### Task 17: Summary cards (verdict and indices)

**Files:** Create `src/components/KpiRow.tsx`, `src/components/KpiRow.test.tsx`

- [ ] **Step 1: Write the failing test** `src/components/KpiRow.test.tsx`

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { summarizeMonth, yearToDate } from '../lib/indices'
import { monthRange } from '../lib/months'
import { KpiRow } from './KpiRow'

const months = monthRange('2003-01', '2006-12')
const series = months.map((ym) => (ym.endsWith('-08') ? (Number(ym.slice(0, 4)) - 2002) * 10 : 1))

describe('KpiRow', () => {
  it('states the verdict, the number behind it and the baseline', () => {
    render(
      <KpiRow from="2003-01" to="2006-08" total={123} monthsWithData={44} seriesLabel="Harmonized (MODIS + VIIRS)"
        focus={summarizeMonth(series, months, '2006-08', [2003, 2006])} focusStatus="standard"
        ytd={yearToDate(series, months, '2006-08', [2003, 2006])} baselineYears={[2003, 2006]} sensorsLine="Sensors: MODIS." />,
    )
    expect(screen.getByText('Well above typical')).toBeInTheDocument()
    expect(screen.getByText(/100th percentile of 3 Augusts/)).toBeInTheDocument()
    expect(screen.getByText(/Compared with 2003 to 2006/)).toBeInTheDocument()
    expect(screen.getByText(/not fires or burned area/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/KpiRow.test.tsx`
Expected: FAIL, `Failed to resolve import "./KpiRow"`.

- [ ] **Step 3: Implement `src/components/KpiRow.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fmtCount } from '../lib/colorScale'
import { VERDICT_LABELS, type MonthSummary, type YearToDate } from '../lib/indices'
import { longLabelYm, MONTH_LONG, parseYm, type YearMonth } from '../lib/months'
import { STATUS_LABELS, type MonthStatus } from '../lib/status'

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`
const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}

export interface KpiRowProps {
  from: YearMonth
  to: YearMonth
  total: number | null
  monthsWithData: number
  seriesLabel: string
  focus: MonthSummary
  focusStatus: MonthStatus
  ytd: YearToDate | null
  baselineYears: [number, number]
  sensorsLine: string
}

export function KpiRow(p: KpiRowProps) {
  const f = p.focus
  const calName = MONTH_LONG[parseYm(f.month).month - 1]
  const n = f.baseline?.values.length ?? 0
  const [y0, y1] = p.baselineYears
  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title">Summary</h2>
      <div className="kpis">
        <div className="kpi">
          <div className="small muted">Hotspots detected, {p.from} to {p.to}</div>
          <div className="value">{p.total === null ? 'n/a' : fmtCount(p.total)}</div>
          <div className="small">{p.monthsWithData > 0 && p.total !== null ? `${fmtCount(p.total / p.monthsWithData)} per month on average` : ''}</div>
        </div>
        <div className="kpi">
          <div className="small muted">{longLabelYm(f.month)} ({STATUS_LABELS[p.focusStatus]})</div>
          <div className="value">{f.value === null ? 'n/a' : fmtCount(f.value)}</div>
          {f.verdict && f.percentile !== null
            ? <div><span className="verdict">{VERDICT_LABELS[f.verdict]}</span> <span className="small">{ordinal(Math.round(f.percentile))} percentile of {n} {calName}s</span></div>
            : <div className="small">Not enough baseline years to compare.</div>}
        </div>
        <div className="kpi">
          <div className="small muted">vs multi-year average for {calName}</div>
          <div className="value">{f.vsMeanPct === null ? 'n/a' : pct(f.vsMeanPct)}</div>
          {f.baseline && <div className="small">Average {fmtCount(f.baseline.mean)}, median {fmtCount(f.baseline.median)} ({f.vsMedianPct === null ? '' : pct(f.vsMedianPct)}){f.z !== null ? `, z = ${f.z.toFixed(1)}` : ''}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">Year to date (January to {calName})</div>
          <div className="value">{p.ytd ? pct(p.ytd.anomalyPct) : 'n/a'}</div>
          {p.ytd && <div className="small">{fmtCount(p.ytd.current)} vs typical {fmtCount(p.ytd.typical)}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">Rank among {calName}s</div>
          <div className="value">{f.rank ? ordinal(f.rank.rank) : 'n/a'}</div>
          {f.rank && <div className="small">busiest of {f.rank.of} ({y0} to {y1} plus {parseYm(f.month).year})</div>}
        </div>
      </div>
      {p.focusStatus === 'partial' && <p className="notice">{longLabelYm(f.month)} is not finished yet, so its total is lower than a full month would be. Compare with care.</p>}
      <p className="caption">
        Compared with {y0} to {y1}, same calendar month, leaving out {parseYm(f.month).year} itself. {p.seriesLabel}. {p.sensorsLine}
        {' '}Counts are satellite hotspot detections, not fires or burned area.
      </p>
    </section>
  )
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/components/KpiRow.test.tsx`
Expected: `Tests  1 passed (1)`

- [ ] **Step 5: Commit**

```bash
git add src/components/KpiRow.tsx src/components/KpiRow.test.tsx
git commit -m "demo: summary cards with verdict, anomaly, year to date and rank"
```

### Task 18: Season and anomaly charts

**Files:** Create `src/components/PlotFigure.tsx`, `src/components/SeasonalChart.tsx`, `src/components/AnomalyChart.tsx`

- [ ] **Step 1: Create the files**

`src/components/PlotFigure.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Renders an Observable Plot chart inside React. Plot builds plain SVG; we swap it on every change.
import { useEffect, useRef } from 'react'

export function PlotFigure({ make, label }: { make: () => SVGSVGElement | HTMLElement; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = make()
    // Plot labels inner <g> groups; inside role="img" those labels are invalid ARIA. The figure label covers it.
    el.querySelectorAll('[aria-label]').forEach((n) => n.removeAttribute('aria-label'))
    el.setAttribute('role', 'img')
    el.setAttribute('aria-label', label)
    ref.current?.replaceChildren(el)
    return () => el.remove()
  }, [make, label])
  return <div className="figure" ref={ref} />
}
```

`src/components/SeasonalChart.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// NSIDC-style season chart: the focus year against the baseline median, middle 50% and middle 80%.
import * as Plot from '@observablehq/plot'
import { useCallback } from 'react'
import { sameMonthBaseline } from '../lib/indices'
import { MONTH_SHORT, parseYm, type YearMonth } from '../lib/months'
import { PlotFigure } from './PlotFigure'

export interface SeasonalChartProps {
  months: YearMonth[]
  values: (number | null)[]
  focusYear: number
  baselineYears: [number, number]
  seriesLabel: string
  width?: number
}

export function SeasonalChart({ months, values, focusYear, baselineYears, seriesLabel, width = 860 }: SeasonalChartProps) {
  const make = useCallback(() => {
    const bands = Array.from({ length: 12 }, (_, i) => {
      const b = sameMonthBaseline(values, months, i + 1, baselineYears, focusYear)
      return b ? { m: i + 1, p10: b.p10, p25: b.p25, med: b.median, p75: b.p75, p90: b.p90 } : null
    }).filter((x) => x !== null)
    const yearLine = (year: number) =>
      months.map((ym, i) => ({ ...parseYm(ym), v: values[i] }))
        .filter((x) => x.year === year && x.v !== null)
        .map((x) => ({ m: x.month, v: x.v as number }))
    const focus = yearLine(focusYear)
    const prev = yearLine(focusYear - 1)
    return Plot.plot({
      width, height: 320, marginLeft: 56,
      style: { background: 'transparent', color: '#ffffff', fontSize: '12px' },
      x: { domain: [1, 12], ticks: 12, tickFormat: (m: number) => MONTH_SHORT[m - 1], label: null },
      y: { grid: true, label: 'Hotspots detected', zero: true },
      marks: [
        Plot.areaY(bands, { x: 'm', y1: 'p10', y2: 'p90', fill: '#2e96f5', fillOpacity: 0.2, curve: 'monotone-x' }),
        Plot.areaY(bands, { x: 'm', y1: 'p25', y2: 'p75', fill: '#2e96f5', fillOpacity: 0.4, curve: 'monotone-x' }),
        Plot.line(bands, { x: 'm', y: 'med', stroke: '#ffffff', strokeDasharray: '5,4', curve: 'monotone-x' }),
        Plot.line(prev, { x: 'm', y: 'v', stroke: '#c9d3ea', strokeWidth: 1, strokeOpacity: 0.7, curve: 'monotone-x' }),
        Plot.line(focus, { x: 'm', y: 'v', stroke: '#eafe07', strokeWidth: 2.5, curve: 'monotone-x' }),
        Plot.dot(focus, { x: 'm', y: 'v', fill: '#eafe07', r: 3.5, tip: true, title: (d: { m: number; v: number }) => `${MONTH_SHORT[d.m - 1]} ${focusYear}: ${Math.round(d.v)}` }),
        Plot.text(focus.slice(-1), { x: 'm', y: 'v', text: () => String(focusYear), dx: 8, textAnchor: 'start', fill: '#eafe07', fontWeight: 700 }),
      ],
    })
  }, [months, values, focusYear, baselineYears, width])
  const [y0, y1] = baselineYears
  return (
    <figure className="card" id="seasons">
      <header><h2>{focusYear} against a typical year</h2></header>
      <PlotFigure make={make} label={`Line chart of monthly hotspots in ${focusYear} against the ${y0} to ${y1} median and ranges.`} />
      <figcaption className="caption">
        Yellow: {focusYear}. Grey: {focusYear - 1}. Dashed white: median of {y0} to {y1} (leaving out {focusYear}).
        Dark band: middle 50% of years. Light band: middle 80% of years. {seriesLabel}.
      </figcaption>
    </figure>
  )
}
```

`src/components/AnomalyChart.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Historical comparison: each month's anomaly against the multi-year average for that calendar month.
import * as Plot from '@observablehq/plot'
import { useCallback, useState } from 'react'
import { ANOMALY_COLORS, ANOMALY_LABELS, anomalyColor } from '../lib/colorScale'
import { monthlyAnomalies } from '../lib/indices'
import { addMonths, labelYm, type YearMonth } from '../lib/months'
import { PlotFigure } from './PlotFigure'

export interface AnomalyChartProps {
  months: YearMonth[]
  values: (number | null)[]
  i0: number
  i1: number
  baselineYears: [number, number]
  seriesLabel: string
  width?: number
}

const CLIP = 200
const toDate = (ym: YearMonth) => new Date(`${ym}-01T00:00:00Z`)

export function AnomalyChart({ months, values, i0, i1, baselineYears, seriesLabel, width = 860 }: AnomalyChartProps) {
  const [reference, setReference] = useState<'mean' | 'median'>('mean')
  const make = useCallback(() => {
    const data = monthlyAnomalies(values, months, i0, i1, baselineYears, reference).map((a) => ({
      ...a,
      start: toDate(a.month),
      end: toDate(addMonths(a.month, 1)),
      y: Math.max(-CLIP, Math.min(CLIP, a.anomalyPct)),
      color: anomalyColor(a.anomalyPct),
    }))
    return Plot.plot({
      width, height: 300, marginLeft: 56,
      style: { background: 'transparent', color: '#ffffff', fontSize: '12px' },
      x: { type: 'utc', label: null },
      y: { label: `% vs ${reference === 'mean' ? 'average' : 'median'}`, grid: true, domain: [-100, CLIP] },
      marks: [
        Plot.rectY(data, {
          x1: 'start', x2: 'end', y: 'y', fill: 'color', inset: 0.5, tip: true,
          title: (d: (typeof data)[number]) => `${labelYm(d.month)}: ${Math.round(d.value)} hotspots, ${Math.round(d.anomalyPct)}% vs ${Math.round(d.reference)}`,
        }),
        Plot.ruleY([0], { stroke: '#ffffff' }),
      ],
    })
  }, [months, values, i0, i1, baselineYears, reference, width])
  const [y0, y1] = baselineYears
  return (
    <figure className="card" id="anomalies">
      <header>
        <h2>Anomalies against the multi-year {reference === 'mean' ? 'average' : 'median'}</h2>
        <label className="small">Compare with{' '}
          <select value={reference} onChange={(e) => setReference(e.target.value as 'mean' | 'median')}>
            <option value="mean">average (mean)</option>
            <option value="median">median (robust to extreme years)</option>
          </select>
        </label>
      </header>
      <PlotFigure make={make} label={`Bar chart of monthly anomalies from ${months[i0]} to ${months[i1]}.`} />
      <div className="legend" aria-label="Anomaly colours">
        {ANOMALY_COLORS.map((c, i) => <span key={c}><span className="swatch" style={{ background: c }} />{ANOMALY_LABELS[i]}</span>)}
      </div>
      <figcaption className="caption">
        Each bar is one month compared with the same calendar month in {y0} to {y1}, leaving out its own year. Blue: fewer hotspots than usual. Red: more.
        Bars are cut at +{CLIP}%; hover for the exact value. Months with fewer than 5 typical hotspots use 5 as the divisor. {seriesLabel}.
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no output. Charts are checked visually in Task 22 and by e2e in Task 23.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlotFigure.tsx src/components/SeasonalChart.tsx src/components/AnomalyChart.tsx
git commit -m "demo: season chart with percentile bands and monthly anomaly chart"
```

### Task 19: Sensor overlap and detected-vs-reported charts

**Files:** Create `src/components/OverlapChart.tsx`, `src/components/ReportedChart.tsx`

- [ ] **Step 1: Create the files**

`src/components/OverlapChart.tsx` (the core evidence for judges: the stitched raw record jumps in 2012 and the harmonized one does not)
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// The core evidence: raw MODIS and raw VIIRS disagree; the stitched raw record jumps in 2012; harmonized does not.
import * as Plot from '@observablehq/plot'
import { useCallback } from 'react'
import type { AreaSeries } from '../lib/aggregate'
import { parseYm } from '../lib/months'
import { SERIES_KEYS } from '../lib/types'
import { PlotFigure } from './PlotFigure'

// Okabe-Ito colours (safe for colour-vision deficiency) plus a dash pattern and a symbol per line.
const STYLE: Record<string, { label: string; color: string; dash: string; symbol: string }> = {
  harmonized: { label: 'Harmonized', color: '#ffffff', dash: '', symbol: 'circle' },
  modis: { label: 'MODIS raw', color: '#E69F00', dash: '6,3', symbol: 'square' },
  viirs_snpp: { label: 'VIIRS S-NPP raw', color: '#56B4E9', dash: '2,3', symbol: 'triangle' },
  viirs_noaa20: { label: 'VIIRS NOAA-20 raw', color: '#009E73', dash: '8,3,2,3', symbol: 'diamond' },
  stitched: { label: 'Raw record stitched (MODIS to 2011, then VIIRS)', color: '#CC79A7', dash: '1,0', symbol: 'cross' },
}

interface Row { key: string; year: number; v: number }

/** Yearly totals per series. A year counts only when all 12 months exist for that series. */
export function yearlyTotals(s: AreaSeries): Row[] {
  const rows: Row[] = []
  const acc = new Map<string, { sum: number; n: number }>()
  const add = (key: string, year: number, v: number | null) => {
    if (v === null) return
    const k = `${key}|${year}`
    const a = acc.get(k) ?? { sum: 0, n: 0 }
    acc.set(k, { sum: a.sum + v, n: a.n + 1 })
  }
  s.months.forEach((ym, i) => {
    const { year } = parseYm(ym)
    for (const key of SERIES_KEYS) add(key, year, s.values[key][i])
    add('stitched', year, year < 2012 ? s.values.modis[i] : s.values.viirs_snpp[i] ?? s.values.viirs_noaa20[i])
  })
  for (const [k, a] of acc) {
    const [key, year] = k.split('|')
    if (a.n === 12) rows.push({ key, year: Number(year), v: a.sum })
  }
  return rows.sort((a, b) => a.year - b.year)
}

export function OverlapChart({ series, width = 860 }: { series: AreaSeries; width?: number }) {
  const make = useCallback(() => {
    const rows = yearlyTotals(series)
    const keys = Object.keys(STYLE).filter((k) => rows.some((r) => r.key === k))
    return Plot.plot({
      width, height: 360, marginLeft: 64, marginRight: 20,
      style: { background: 'transparent', color: '#ffffff', fontSize: '12px' },
      x: { label: null, tickFormat: 'd' },
      y: { label: 'Hotspots detected per year', grid: true, zero: true },
      marks: [
        Plot.ruleX([2012], { stroke: '#c9d3ea', strokeDasharray: '3,3' }),
        Plot.text([2012], { x: (d: number) => d, frameAnchor: 'top', dy: 6, dx: 4, textAnchor: 'start', text: () => 'VIIRS S-NPP starts', fill: '#c9d3ea' }),
        ...keys.flatMap((k) => {
          const d = rows.filter((r) => r.key === k)
          const st = STYLE[k]
          return [
            Plot.line(d, { x: 'year', y: 'v', stroke: st.color, strokeWidth: k === 'harmonized' ? 3 : 1.75, strokeDasharray: st.dash }),
            Plot.dot(d, { x: 'year', y: 'v', stroke: st.color, fill: k === 'harmonized' ? st.color : 'none', symbol: () => st.symbol, r: 3,
              tip: true, title: (r: Row) => `${st.label}, ${r.year}: ${Math.round(r.v).toLocaleString('en-GB')}` }),
          ]
        }),
      ],
    })
  }, [series, width])
  return (
    <figure className="card" id="sensors">
      <header><h2>Why harmonize: one record, two instruments</h2></header>
      <PlotFigure make={make} label="Line chart of yearly hotspot totals for raw MODIS, raw VIIRS, the stitched raw record and the harmonized record." />
      <div className="legend" aria-label="Lines">
        {Object.entries(STYLE).map(([k, st]) => (
          <span key={k}><span className="swatch" style={{ background: 'none', borderTop: `3px ${st.dash ? 'dashed' : 'solid'} ${st.color}`, height: 0 }} />{st.label}</span>
        ))}
      </div>
      <figcaption className="caption">
        Whole record for this area, full calendar years only. VIIRS detects smaller fires than MODIS, so joining the raw records makes a false jump in 2012 (pink).
        The harmonized line puts every year on one scale.
      </figcaption>
    </figure>
  )
}
```

`src/components/ReportedChart.tsx`
```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// "Number of fires detected and reported": satellite detections next to fires reported on the ground,
// shown only for preset regions that have a published ground statistic. Context only; never replaces FIRMS.
import * as Plot from '@observablehq/plot'
import { useCallback } from 'react'
import { addMonths, monthRange, type YearMonth } from '../lib/months'
import type { ReportedSeries } from '../lib/types'
import { PlotFigure } from './PlotFigure'

export interface ReportedChartProps {
  reported: ReportedSeries
  months: YearMonth[]
  detected: (number | null)[]
  from: YearMonth
  to: YearMonth
  width?: number
}

const toDate = (ym: YearMonth) => new Date(`${ym}-01T00:00:00Z`)

export function ReportedChart({ reported, months, detected, from, to, width = 860 }: ReportedChartProps) {
  const make = useCallback(() => {
    const rMonths = monthRange(reported.first_month, addMonths(reported.first_month, reported.values.length - 1))
    const rows: { date: Date; v: number; panel: string }[] = []
    rMonths.forEach((ym, i) => {
      const v = reported.values[i]
      if (ym >= from && ym <= to && v !== null) rows.push({ date: toDate(ym), v, panel: `Reported: ${reported.unit}` })
    })
    months.forEach((ym, i) => {
      const v = detected[i]
      if (ym >= from && ym <= to && v !== null) rows.push({ date: toDate(ym), v, panel: 'Detected: satellite hotspots' })
    })
    return Plot.plot({
      width, height: 380, marginLeft: 64,
      style: { background: 'transparent', color: '#ffffff', fontSize: '12px' },
      fy: { label: null },
      x: { type: 'utc', label: null },
      y: { grid: true, label: null },
      facet: { data: rows, y: 'panel', marginRight: 0 },
      marks: [
        Plot.lineY(rows, { x: 'date', y: 'v', fy: 'panel', stroke: (d: { panel: string }) => (d.panel.startsWith('Detected') ? '#eafe07' : '#56B4E9'), strokeWidth: 1.5 }),
        Plot.frame({ stroke: '#ffffff', strokeOpacity: 0.2 }),
      ],
    })
  }, [reported, months, detected, from, to, width])
  return (
    <figure className="card" id="reported">
      <header><h2>Fires detected and fires reported</h2></header>
      <PlotFigure make={make} label="Two line charts: satellite hotspot detections and fires reported on the ground, by month." />
      <figcaption className="caption">
        Top and bottom use different units and scales. Ground reports count incidents attended; satellites count hot pixels.
        They are not expected to match, but busy seasons should line up. Source: {reported.source} ({reported.licence}). <a href={reported.url}>Data page</a>.
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/OverlapChart.tsx src/components/ReportedChart.tsx
git commit -m "demo: MODIS vs VIIRS overlap chart and detected vs reported chart"
```

### Task 20: Download button

**Files:** Create `src/components/ExportButton.tsx`

- [ ] **Step 1: Create `src/components/ExportButton.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { DownloadSimple } from '@phosphor-icons/react'
import type { AreaSeries } from '../lib/aggregate'
import type { Area } from '../lib/area'
import { buildCsv, csvFilename } from '../lib/csv'
import type { Manifest } from '../lib/types'

export function ExportButton({ manifest, area, series, i0, i1 }: {
  manifest: Manifest; area: Area; series: AreaSeries; i0: number; i1: number
}) {
  function download() {
    const csv = buildCsv(manifest, area, series, i0, i1)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = csvFilename(area, series.months[i0], series.months[i1])
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="card" id="download">
      <h2>Download</h2>
      <p>Monthly hotspot counts for this area and these months, with every sensor, the data status and a provenance header.</p>
      <button className="btn" onClick={download}><DownloadSimple aria-hidden /> Download CSV</button>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportButton.tsx
git commit -m "demo: CSV download button"
```

### Task 21: Shareable links

**Files:** Create `src/state/urlState.ts`, `src/state/urlState.test.ts`; modify `src/state/appState.ts`

- [ ] **Step 1: Write the failing test** `src/state/urlState.test.ts`

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { describe, expect, it } from 'vitest'
import { areaFromBbox, areaFromPreset } from '../lib/area'
import type { Manifest } from '../lib/types'
import { initialState } from './appState'
import { applyUrl, parseHash, toHash } from './urlState'

const m = {
  harmonized_coverage: ['2000-11', '2026-11'], last_month: '2026-11', month_to_date: true,
  presets: [{ id: 'uk', name: 'UK', bbox: [-8, 50, 2, 59] }],
} as unknown as Manifest

describe('urlState', () => {
  it('round-trips a preset view', () => {
    const s = { ...initialState(m), area: areaFromPreset({ id: 'uk', name: 'UK', bbox: [-8, 50, 2, 59] }), from: '2022-01', to: '2026-10' }
    const h = toHash(s)
    expect(h).toBe('#area=preset:uk&from=2022-01&to=2026-10&src=harmonized')
    expect(parseHash(h)).toEqual({ presetId: 'uk', from: '2022-01', to: '2026-10', source: 'harmonized' })
  })
  it('shares other areas as a box', () => {
    const s = { ...initialState(m), area: areaFromBbox([1.123456, 2, 3, 4]) }
    expect(parseHash(toHash(s)).bbox).toEqual([1.1235, 2, 3, 4])
  })
  it('ignores junk', () => {
    expect(parseHash('#area=box:9,9,1,1&from=2020-13&src=nope&view=x')).toEqual({})
  })
  it('applies a link on top of the current state and drops months outside the data', () => {
    const s = applyUrl(m, parseHash('#area=preset:uk&from=1990-01&to=2024-12&src=modis'), initialState(m))
    expect(s.area?.presetId).toBe('uk')
    expect([s.from, s.to, s.source]).toEqual(['2000-11', '2024-12', 'modis'])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/state/urlState.test.ts`
Expected: FAIL, `Failed to resolve import "./urlState"`.

- [ ] **Step 3: Implement `src/state/urlState.ts`**

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Shareable links: area, months and data source live in the URL hash.
// Example: #area=preset:uk&from=2022-01&to=2026-10&src=harmonized
// Drawn and point areas are shared as their bounding box.
import { areaFromBbox, areaFromPreset, validateBbox } from '../lib/area'
import type { Bbox } from '../lib/grid'
import type { YearMonth } from '../lib/months'
import { SERIES_KEYS, type Manifest, type SeriesKey } from '../lib/types'
import type { AppState, View } from './appState'

export interface UrlState {
  presetId?: string
  bbox?: Bbox
  from?: YearMonth
  to?: YearMonth
  source?: SeriesKey
  view?: View
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/

export function parseHash(hash: string): UrlState {
  const q = new URLSearchParams(hash.replace(/^#/, ''))
  const out: UrlState = {}
  const area = q.get('area') ?? ''
  if (area.startsWith('preset:')) out.presetId = area.slice(7)
  if (area.startsWith('box:')) {
    const box = area.slice(4).split(',').map(Number) as Bbox
    if (box.length === 4 && validateBbox(box) === null) out.bbox = box
  }
  const from = q.get('from')
  const to = q.get('to')
  if (from && YM.test(from)) out.from = from
  if (to && YM.test(to)) out.to = to
  const src = q.get('src')
  if (src && (SERIES_KEYS as readonly string[]).includes(src)) out.source = src as SeriesKey
  if (q.get('view') === 'about') out.view = 'about'
  return out
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4

export function toHash(s: AppState): string {
  const q = new URLSearchParams()
  if (s.area?.presetId) q.set('area', `preset:${s.area.presetId}`)
  else if (s.area) q.set('area', `box:${s.area.bbox.map(r4).join(',')}`)
  q.set('from', s.from)
  q.set('to', s.to)
  q.set('src', s.source)
  if (s.view === 'about') q.set('view', 'about')
  return '#' + q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',')
}

/** Apply what the URL asks for on top of a state, ignoring anything outside the data. */
export function applyUrl(m: Manifest, u: UrlState, base: AppState): AppState {
  const preset = m.presets.find((p) => p.id === u.presetId)
  const area = u.bbox ? areaFromBbox(u.bbox) : preset ? areaFromPreset(preset) : base.area
  const inData = (ym?: YearMonth) => (ym && ym >= m.harmonized_coverage[0] && ym <= m.last_month ? ym : undefined)
  const from = inData(u.from) ?? base.from
  const to = inData(u.to) ?? base.to
  return {
    ...base, area,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    source: u.source ?? base.source,
    view: u.view ?? base.view,
  }
}
```

- [ ] **Step 4: Add the `applyUrl` action to `src/state/appState.ts`** (three edits)

After the line `import type { Manifest, SeriesKey } from '../lib/types'` add:
```ts
import { applyUrl, type UrlState } from './urlState'
```
After the line `  | { type: 'setView'; view: View }` add:
```ts
  | { type: 'applyUrl'; manifest: Manifest; url: UrlState }
```
After the line `    case 'setView': return { ...s, view: a.view }` add:
```ts
    case 'applyUrl': return applyUrl(a.manifest, a.url, s)
```

- [ ] **Step 5: Run the state tests**

Run: `npx vitest run src/state`
Expected: `Tests  8 passed (8)`

- [ ] **Step 6: Commit**

```bash
git add src/state
git commit -m "demo: shareable links for area, months and data source"
```

### Task 22: Wire App (final version)

**Files:** Replace `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useMemo, useReducer, useState } from 'react'
import { AboutPage } from './components/AboutPage'
import { AnomalyChart } from './components/AnomalyChart'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { BurningCalendar } from './components/BurningCalendar'
import { DisplayOptions } from './components/DisplayOptions'
import { ExportButton } from './components/ExportButton'
import { Footer } from './components/Footer'
import { GlobeMap } from './components/GlobeMap'
import { Header } from './components/Header'
import { KpiRow } from './components/KpiRow'
import { Legend } from './components/Legend'
import { MockBanner } from './components/MockBanner'
import { OverlapChart } from './components/OverlapChart'
import { ReportedChart } from './components/ReportedChart'
import { SeasonalChart } from './components/SeasonalChart'
import { TimeRangePicker } from './components/TimeRangePicker'
import { RAMP } from './config'
import { dataSource } from './dataSource'
import { useAreaData } from './hooks/useAreaData'
import { useDataset } from './hooks/useDataset'
import { cellTotals } from './lib/aggregate'
import { areaFromPreset, validateDrawn } from './lib/area'
import { buildCountScale } from './lib/colorScale'
import { summarizeMonth, yearToDate } from './lib/indices'
import { cellsToFeatures, EMPTY_FC, overviewToFeatures } from './lib/mapFeatures'
import { labelYm, parseYm, type YearMonth } from './lib/months'
import { monthStatus, sensorsIn } from './lib/status'
import { SERIES_LABELS, type Manifest } from './lib/types'
import { initialState, quickRanges, reducer, type AppState } from './state/appState'
import { applyUrl, parseHash, toHash } from './state/urlState'

export default function App() {
  const { manifest, overview, reported, error } = useDataset(dataSource)
  if (error) return <p className="error" role="alert" style={{ padding: '2rem' }}>Could not load the dataset: {error}</p>
  if (!manifest) return <p style={{ padding: '2rem' }}>Loading data…</p>
  return <Explorer manifest={manifest} overview={overview} reported={reported} />
}

function Explorer({ manifest: m, overview, reported }: { manifest: Manifest } & Pick<ReturnType<typeof useDataset>, 'overview' | 'reported'>) {
  const [s, dispatch] = useReducer(reducer, m, (mm): AppState => {
    const init = initialState(mm)
    const withPreset = mm.presets[0] ? { ...init, area: areaFromPreset(mm.presets[0]) } : init
    return applyUrl(mm, parseHash(window.location.hash), withPreset)
  })
  // Keep the link shareable, and follow links pasted into the same tab.
  useEffect(() => { window.history.replaceState(null, '', toHash(s)) }, [s])
  useEffect(() => {
    const onHash = () => dispatch({ type: 'applyUrl', manifest: m, url: parseHash(window.location.hash) })
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [m])
  const data = useAreaData(dataSource, m, s.area)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [hoverMonth, setHoverMonth] = useState<YearMonth | null>(null)
  useEffect(() => setHoverMonth(null), [s.area, s.source])

  const series = data.series
  const i0 = series ? series.months.indexOf(s.from) : -1
  const i1 = series ? series.months.indexOf(s.to) : -1
  const values = useMemo(() => series?.values[s.source] ?? [], [series, s.source])
  const seriesLabel = SERIES_LABELS[s.source]

  const calendarScale = useMemo(() => buildCountScale(
    s.scaleTo === 'range' && i0 >= 0 ? values.slice(i0, i1 + 1) : values,
    { ...RAMP, palette: s.palette },
  ), [values, i0, i1, s.scaleTo, s.palette])

  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.grid_deg, scale), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.grid_deg])

  const overviewFc = useMemo(() => (overview ? overviewToFeatures(overview, s.palette) : EMPTY_FC), [overview, s.palette])

  const focus = series ? summarizeMonth(values, series.months, s.to, m.baseline_years) : null
  const ytd = series ? yearToDate(values, series.months, s.to, m.baseline_years) : null
  let total: number | null = null
  let monthsWithData = 0
  for (let i = i0; i >= 0 && i <= i1; i++) {
    const v = values[i]
    if (v !== null && v !== undefined) { total = (total ?? 0) + v; monthsWithData++ }
  }
  const reportedForArea = reported?.series.find((r) => r.preset_id === s.area?.presetId) ?? null
  const showResults = series && data.status === 'ready' && data.coverage !== 'none' && i0 >= 0 && i1 >= 0
  const sensorsLine = `Sensors in ${labelYm(s.to)}: ${sensorsIn(m, s.to).map((x) => x.label).join(', ') || 'none'}.`

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to main content</a>
      {m.mock && <MockBanner />}
      <Header view={s.view} onView={(view) => dispatch({ type: 'setView', view })} />
      {s.view === 'about' ? <AboutPage manifest={m} /> : (
        <main className="explore" id="main">
          <aside className="controls" aria-label="Choose an area and months">
            <AreaPanel presets={m.presets} area={s.area} tool={s.tool} error={drawError}
              onTool={(tool) => dispatch({ type: 'setTool', tool })}
              onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
            <TimeRangePicker first={m.harmonized_coverage[0]} last={m.last_month} from={s.from} to={s.to}
              quick={quickRanges(m)} onChange={(from, to) => dispatch({ type: 'setRange', from, to })} />
            <DisplayOptions source={s.source} scaleTo={s.scaleTo} palette={s.palette} basemap={s.basemap} labels={s.labels}
              onSource={(source) => dispatch({ type: 'setSource', source })}
              onScaleTo={(scaleTo) => dispatch({ type: 'setScaleTo', scaleTo })}
              onPalette={(palette) => dispatch({ type: 'setPalette', palette })}
              onBasemap={(basemap) => dispatch({ type: 'setBasemap', basemap })}
              onLabels={(labels) => dispatch({ type: 'setLabels', labels })} />
          </aside>
          <section className="map-col" aria-label="Map">
            <div className="globe-wrap">
              <GlobeMap area={s.area} cells={cells} overview={overviewFc} tool={s.tool} basemap={s.basemap} labels={s.labels}
                onDrawn={(area) => {
                  const err = validateDrawn(area)
                  setDrawError(err)
                  dispatch(err ? { type: 'setTool', tool: 'pan' } : { type: 'setArea', area })
                }} />
            </div>
            {mapScale && <Legend scale={mapScale} title={`Hotspots per ${m.grid_deg}° cell, ${labelYm(s.from)} to ${labelYm(s.to)} (bins fit these months)`} />}
            <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
          </section>
          <section className="results" id="results" aria-label="Results" tabIndex={-1}>
            <nav className="section-nav" aria-label="Result sections">
              <a href="#summary">Summary</a><a href="#calendar">Calendar</a><a href="#seasons">Seasons</a>
              <a href="#anomalies">Anomalies</a><a href="#sensors">Sensors</a>{reportedForArea && <a href="#reported">Reported</a>}<a href="#download">Download</a>
            </nav>
            {!showResults ? <p className="muted">Results appear here once an area with data is chosen.</p> : (
              <>
                <div className="card" id="summary">
                  <KpiRow from={s.from} to={s.to} total={total} monthsWithData={monthsWithData} seriesLabel={seriesLabel}
                    focus={focus!} focusStatus={monthStatus(m, s.to)} ytd={ytd} baselineYears={m.baseline_years} sensorsLine={sensorsLine} />
                </div>
                <section className="card" id="calendar" aria-labelledby="cal-title">
                  <header><h2 id="cal-title">Burning calendar</h2></header>
                  <Legend id="cal-legend" scale={calendarScale} showNrt
                    title={s.scaleTo === 'range' ? `Hotspots per month (bins fit ${labelYm(s.from)} to ${labelYm(s.to)})` : 'Hotspots per month (bins fit the whole record)'} />
                  <BurningCalendar months={series.months} values={values} from={s.from} to={s.to} scale={calendarScale}
                    statusOf={(ym) => monthStatus(m, ym)} baselineYears={m.baseline_years} seriesLabel={seriesLabel}
                    legendId="cal-legend" onFocusMonth={setHoverMonth} />
                  <CellDetail ym={hoverMonth} values={values} months={series.months} manifest={m} seriesLabel={seriesLabel} />
                </section>
                <SeasonalChart months={series.months} values={values} focusYear={parseYm(s.to).year} baselineYears={m.baseline_years} seriesLabel={seriesLabel} />
                <AnomalyChart months={series.months} values={values} i0={i0} i1={i1} baselineYears={m.baseline_years} seriesLabel={seriesLabel} />
                <OverlapChart series={series} />
                {reportedForArea && <ReportedChart reported={reportedForArea} months={series.months} detected={series.values.harmonized} from={s.from} to={s.to} />}
                {s.area && <ExportButton manifest={m} area={s.area} series={series} i0={i0} i1={i1} />}
              </>
            )}
          </section>
        </main>
      )}
      <Footer />
    </div>
  )
}

function CellDetail({ ym, values, months, manifest, seriesLabel }: {
  ym: YearMonth | null; values: (number | null)[]; months: YearMonth[]; manifest: Manifest; seriesLabel: string
}) {
  if (!ym) return <p className="cell-detail muted small">Hover or use the arrow keys on the calendar to see one month in detail.</p>
  const sum = summarizeMonth(values, months, ym, manifest.baseline_years)
  const sensors = sensorsIn(manifest, ym).map((x) => x.label).join(', ') || 'none'
  return (
    <p className="cell-detail" aria-live="polite">
      <strong>{labelYm(ym)}</strong>: {sum.value === null ? 'no data' : `${Math.round(sum.value).toLocaleString('en-GB')} hotspots detected`} ({seriesLabel}).{' '}
      {sum.rank && sum.vsMedianPct !== null && `Rank ${sum.rank.rank} of ${sum.rank.of} for this calendar month; ${Math.round(100 + sum.vsMedianPct)}% of the ${manifest.baseline_years[0]}–${manifest.baseline_years[1]} median (${Math.round(sum.baseline!.median)}). `}
      Sensors: {sensors}.
    </p>
  )
}
```

- [ ] **Step 2: Typecheck, test, lint**

Run: `npx tsc -b && npm test && npx oxlint`
Expected: `Tests  60 passed (60)`; oxlint shows warnings only.

- [ ] **Step 3: Check by hand** (`npm run dev`)
- [ ] Summary cards show "October 2026 (Near real-time: provisional)", a verdict word with its percentile, the anomaly vs average and median, year to date, rank, and a caption naming 2003 to 2025 and the sensors.
- [ ] Set To = November 2026: a notice says the month is not finished.
- [ ] Season chart: yellow 2026 line, dashed median, two blue bands.
- [ ] Anomaly chart: blue and red bars. "Compare with median" changes the bars.
- [ ] Overlap chart: the pink stitched line jumps in 2012 and the white harmonized line does not.
- [ ] UK preset: the "Fires detected and fires reported" chart appears. It is absent for the other presets.
- [ ] Download CSV: the file opens in a spreadsheet, the header lines start with `#`, and there is one row per month.
- [ ] Copy the URL, open it in a new private window: the same area, months and data load.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "demo: checkpoint 4, indices, charts, download and share link"
```

#### ✅ CHECKPOINT 4: Feature complete. Stop and review with Aziz
Walk through the success criteria in HANDOVER section 2. Agree the UI copy (HANDOVER section 9 words: "hotspots detected", baseline named everywhere). Add a row to `docs/AI_USE.md`. Tag `cp4-features`.

---

### Checkpoint 5: Ready to publish

### Task 23: End-to-end and accessibility tests

**Files:** Create `playwright.config.ts`, `e2e/app.spec.ts`

- [ ] **Step 1: Install the test browser** (one-off download, about 100 MB)

Run: `npx playwright install chromium`

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4173',
    // Headless Chromium has no GPU: SwiftShader gives MapLibre the WebGL2 it needs.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build:demo && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
```

- [ ] **Step 3: Create `e2e/app.spec.ts`**

```ts
// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible()
})

test('loads with no login and shows the mock banner on demo builds', async ({ page }) => {
  await expect(page.getByText('MOCK DATA, NOT REAL')).toBeVisible()
  await expect(page.getByText(/Data: NASA FIRMS/)).toBeVisible()
})

test('a preset gives the calendar, verdict and charts', async ({ page }) => {
  await page.getByLabel('Preset region').selectOption('uk')
  await expect(page.locator('.map-col').getByText('United Kingdom (mock)')).toBeVisible()
  await expect(page.getByRole('rowheader', { name: '2003', exact: true })).toBeVisible()
  await expect(page.getByText(/percentile of \d+ Octobers/)).toBeVisible()
  await expect(page.getByRole('img', { name: /yearly hotspot totals/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fires detected and fires reported' })).toBeVisible()
})

test('typed coordinates: valid box works, invalid box explains why', async ({ page }) => {
  await page.getByText('Or type coordinates').click()
  await page.getByLabel('West', { exact: true }).fill('5')
  await page.getByLabel('South', { exact: true }).fill('50')
  await page.getByLabel('East', { exact: true }).fill('1')
  await page.getByLabel('North', { exact: true }).fill('60')
  await page.getByRole('button', { name: 'Use these coordinates' }).click()
  await expect(page.getByRole('alert')).toContainText('West must be less than east')
  await page.getByLabel('West', { exact: true }).fill('-6')
  await page.getByLabel('East', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Use these coordinates' }).click()
  await expect(page.locator('.map-col').getByText(/Box W -6, S 50, E 1, N 60/)).toBeVisible()
})

test('an area outside the loaded data says so instead of showing zeros', async ({ page }) => {
  await page.getByText('Or type coordinates').click()
  await page.getByLabel('West', { exact: true }).fill('-60')
  await page.getByLabel('South', { exact: true }).fill('-10')
  await page.getByLabel('East', { exact: true }).fill('-50')
  await page.getByLabel('North', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Use these coordinates' }).click()
  await expect(page.getByText(/No data is loaded for this area yet/)).toBeVisible()
})

test('drawing a circle on the globe selects an area', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Drawing is checked on desktop; phones use presets and typed coordinates.')
  await page.waitForTimeout(2000) // let the globe finish flying to the first preset
  await page.getByRole('button', { name: 'Circle' }).click()
  const box = (await page.locator('.globe canvas').boundingBox())!
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 50, y + 30, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.map-col').getByText('Drawn circle')).toBeVisible()
})

test('changing months rescales the calendar and keyboard moves between months', async ({ page }) => {
  await page.getByRole('button', { name: 'Last 5 years' }).click()
  await expect(page.getByText(/bins fit Jan 2022 to Oct 2026/)).toBeVisible()
  await page.mouse.move(0, 0) // hover also updates the detail line; keep the pointer out of the way
  const cell = page.getByLabel(/^Oct 2026:/)
  await cell.focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByLabel(/^Oct 2025:/)).toBeFocused()
  await expect(page.locator('.cell-detail')).toContainText('Oct 2025')
})

test('CSV download has provenance and one row per month', async ({ page }) => {
  await page.getByRole('button', { name: 'Last 12 months' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
  const text = readFileSync((await download.path())!, 'utf8')
  expect(text).toContain('# Counts are satellite hotspot detections, not fires or burned area.')
  expect(text).toContain('MOCK DATA, NOT REAL')
  expect(text.split('\n').filter((l) => /^\d{4},/.test(l))).toHaveLength(12)
})

test('the link restores the same view, also when pasted into an open tab', async ({ page }) => {
  await page.goto('/#area=preset:uk&from=2022-01&to=2024-12&src=modis')
  await expect(page.getByLabel('Preset region')).toHaveValue('uk')
  await expect(page.getByLabel('MODIS only (raw)')).toBeChecked()
  await expect(page.getByText('Hotspots detected, 2022-01 to 2024-12')).toBeVisible()
})

test('no automatic accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).exclude('.globe').analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
})
```

- [ ] **Step 4: Run**

Run: `npm run test:e2e`
Expected: `17 passed`, with 1 skipped (drawing is skipped on the phone profile). It builds the demo first, so the first run takes about 30 s.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "demo: end-to-end tests on desktop and phone with axe accessibility scan"
```

### Task 24: Documentation

**Files:** Create `demo/README.md`, `docs/DATA_CONTRACT.md`; replace `docs/REFERENCES.md`; modify `docs/AI_USE.md`, root `README.md`

- [ ] **Step 1: Create `demo/README.md`**

````markdown
# Hotspot Calendar (demo build)

The full web app, running on **synthetic mock data** until the real FIRMS pipeline output arrives.

```bash
npm install
npm run dev          # generates mock data, starts http://localhost:5173
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end + accessibility (Playwright)
npm run build:demo   # static build WITH mock data and the red banner
npm run build        # production build: refuses mock data
```

Real data: put Andre's files in `public/data/<name>/` (format in `../docs/DATA_CONTRACT.md`) and build with
`VITE_DATASET=<name> npm run build`. Tunable numbers are in `src/config.ts`.

Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Imagery: NASA GIBS. Not an official warning service.
Parts of this code were generated with AI assistance (Claude) and reviewed by the team; see `../docs/AI_USE.md`.
````

- [ ] **Step 2: Create `docs/DATA_CONTRACT.md`** for Andre and Pierre: copy section 2.3 of this plan, then the full text of `demo/src/lib/types.ts`, then this checklist:
  - [ ] `manifest.json` has `"mock": false`, real `generated_at`, `sensors` with FIRMS versions and first/last months read from the files (S-NPP end and NOAA-21 start: HANDOVER 13.5).
  - [ ] `nrt_from` is the first month that is still NRT in the downloaded files.
  - [ ] Every tile listed in `tiles` exists; cell ids use `grid_deg`; series arrays have one value per month from `first_month` to `last_month`.
  - [ ] `null` only where a sensor was not operating; `0` where it operated and saw nothing.
  - [ ] `coverage` lists every processed box.
  - [ ] `harmonized_low/high` either present for every cell or absent everywhere.

- [ ] **Step 3: Replace `docs/REFERENCES.md`**

```markdown
# References

## Data and imagery
| Source | Product / version | Licence / terms | URL |
| --- | --- | --- | --- |
| NASA FIRMS | MODIS C6.1 (Terra + Aqua) active fire, 1 km | NASA open data, no restriction; credit NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/ |
| NASA FIRMS | VIIRS 375 m active fire (Suomi NPP, NOAA-20) | NASA open data, no restriction; credit NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/ |
| NASA GIBS | BlueMarble_ShadedRelief_Bathymetry, VIIRS_Black_Marble (2016) | NASA open data; credit NASA GIBS | https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api |
| NASA GIBS | Reference_Features_15m, Reference_Labels_15m | Derived from OpenStreetMap; © OpenStreetMap contributors (ODbL) | https://www.openstreetmap.org/copyright |

## Software (exact versions in demo/package-lock.json)
| Library | Version | Licence | URL |
| --- | --- | --- | --- |
| React, React DOM | 19.3.1 | MIT | https://react.dev |
| Vite, @vitejs/plugin-react | 8.3.8, 6.3.0 | MIT | https://vite.dev |
| TypeScript | 7.0.2 | Apache-2.0 | https://www.typescriptlang.org |
| MapLibre GL JS | 6.18.0 | BSD-3-Clause | https://maplibre.org |
| Terra Draw, terra-draw-maplibre-gl-adapter | 1.39.0, 1.5.0 | MIT | https://terradraw.io |
| Observable Plot | 0.6.19 | ISC | https://observablehq.com/plot |
| d3-scale, d3-scale-chromatic | 4.0.3, 3.1.1 | ISC (ColorBrewer schemes: Apache-2.0) | https://d3js.org |
| Turf (@turf/area, bbox, bbox-polygon, boolean-point-in-polygon, circle) | 7.4.0 | MIT | https://turfjs.org |
| Fontsource Fira Sans, Overpass | 5.3.0 | SIL OFL 1.1 | https://fontsource.org |
| Phosphor Icons (React) | 2.1.10 | MIT | https://phosphoricons.com |
| Vitest, jsdom | 5.1.0, 31.0.1 | MIT | https://vitest.dev |
| Testing Library (react, jest-dom, user-event) | 16.3.3, 7.0.1, 14.6.10 | MIT | https://testing-library.com |
| Playwright | 1.65.1 | Apache-2.0 | https://playwright.dev |
| axe-core for Playwright | 4.14.0 | MPL-2.0 | https://github.com/dequelabs/axe-core-npm |
| oxlint | 1.93.0 | MIT | https://oxc.rs |

## Colour and design
| Item | Source | Licence |
| --- | --- | --- |
| inferno ramp | Smith & van der Walt, matplotlib colormaps (via d3-scale-chromatic) | CC0 |
| cividis ramp | Nuñez, Anderton & Renslow 2018, https://doi.org/10.1371/journal.pone.0199239 | CC0 (via d3-scale-chromatic) |
| RdBu diverging scheme | Cynthia Brewer, ColorBrewer | Apache-2.0 |
| Okabe-Ito categorical colours | Okabe & Ito 2008, Color Universal Design | free use, cite |
| Brand palette, fonts, icon guidance | NASA Space Apps Brand Guidelines, https://www.spaceappschallenge.org/brand/ | Space Apps terms |

## Papers and guides
See HANDOVER.md section 14 until the final list is written.
```

- [ ] **Step 4: Append to `docs/AI_USE.md`** one row per checkpoint actually completed, for example:
```markdown
| 2026-11-14 | demo/ (all files listed in the plan) | Implementation plan and code generated with Claude from docs/superpowers/plans/2026-11-14-hotspot-calendar-demo.md; reviewed by Aziz at each checkpoint |
```

- [ ] **Step 5: Update the root `README.md`**: under "Repository layout" add a line `/demo       The web app (runs on mock data until the pipeline delivers)`, and add a "Run the app" section pointing to `demo/README.md`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/azizbenjilani/Nasa "
git add demo/README.md docs README.md
git commit -m "docs: demo README, data contract, references and AI-use log"
```

### Task 25: Manual QA (an hour; ideal for Guido)

**Files:** none (record results in the PR description or `docs/QA.md` if Aziz wants a file)

- [ ] Chrome DevTools, Rendering, "Emulate vision deficiencies": protanopia, deuteranopia, tritanopia and achromatopsia (greyscale). The calendar, map and anomaly bars are still readable: hatches, outlines and numbers carry the meaning.
- [ ] Keyboard only: Tab through the controls, choose a preset, type a box, move in the calendar with the arrows, download the CSV. A focus ring is always visible.
- [ ] Phone (real device on the same Wi-Fi with `npm run dev -- --host`, or DevTools device mode): controls stack under the globe and nothing overflows sideways.
- [ ] Private window, no login: `npm run build:demo && npx vite preview` loads.
- [ ] Spot check (HANDOVER 12): for the UK preset, Oct 2025, the calendar number = the CSV row = the season chart point (hover).
- [ ] Copy: no "fires" alone, no "unprecedented", "safe", "confirmed", "live" or "warning" except in "not a warning service".

### Task 26: Demo deploy (only with Aziz's hosting choice, TO CONFIRM 6)

- [ ] Build: `npm run build:demo` (the mock banner stays on).
- [ ] Deploy `demo/dist/` to the chosen free static host. `base: './'` already makes it path-independent.
- [ ] Open the URL in a private window and on a phone.

#### ✅ CHECKPOINT 5: Ready to publish. Stop and review with Aziz
`npm test` (60), `npm run test:e2e` (17), QA list signed off, docs present. Tag `cp5-ready`. Push when Aziz says so.

---

### Checkpoint 6 (when the real data arrives)

### Task 27: Switch to real data

- [ ] Put Andre's output in `demo/public/data/<name>/`. Validate against `docs/DATA_CONTRACT.md`. The app's `validateManifest` names any broken field on screen.
- [ ] `VITE_DATASET=<name> npm run dev`: the mock banner is gone and the presets are the real ones.
- [ ] Tune `RAMP` (section 2.2): for two presets, compare the legend edges for 1 month, 12 months and the whole record; pick `quantile` or `log` and the bin count.
- [ ] Set `MIN_DENOMINATOR`, `VERDICT_THRESHOLDS` and `MAX_AREA_KM2` with Pierre. Check the tile size of the biggest preset; if any tile is over about 2 MB gzipped, raise it with Andre (section 2.3).
- [ ] Replace the About page method text source: Pierre's `method` and `validation` in the manifest.
- [ ] Set `reported.json` from the real ground statistic (TO CONFIRM 4) with its licence, or omit the file.
- [ ] Update `e2e/app.spec.ts` preset ids and month names to the real data. Keep a mock run in CI: `VITE_DATASET=_mock` with `ALLOW_MOCK=1`.
- [ ] `VITE_DATASET=<name> npm run build`: passes, and `dist/data/_mock` is removed.
- [ ] Optional: rename `demo/` to `app/` (`git mv demo app`) and update paths in docs.

---

## 6. Known limits of this plan (deliberate)

- Boxes crossing the 180° line are rejected with a message (no antimeridian splitting).
- Area edges are approximate to one grid cell (cell centre rule, stated in the UI).
- The uncertainty band for an area is the sum of cell bands, which is conservative. Pierre may supply a better one.
- The mock data has 1° cells over 4 regions. Real data will likely be 0.25° over more of the globe, so watch tile sizes (section 2.3).
- oxlint leaves warnings about the React "latest ref" pattern and async loading in effects. They are deliberate and harmless.
- Not built yet, from HANDOVER F4 "Should": the trend test (Sen's slope + Mann–Kendall on annual harmonized totals) and peak month / season length. Add them after Checkpoint 4 only if time allows, as pure functions in `indices.ts` with tests first, shown as a "Long-term trend" card. Run the trend on harmonized data only.
- Accepted minor engine limits (Checkpoint 1 verifier):
  - `coverageOf` samples points, so a coverage gap narrower than about a tenth of the area can be missed.
  - A circle whose bounding box touches coverage, but not the circle itself, reports "partial" instead of "none".
  - Manifest validation doesn't check span order or the `baseline_years` types.
  - Very large thin slivers (over 20,000 candidate cell centres) skip the centre-cell fallback.
- Stretch items from HANDOVER section 8 (fire-event clustering, day/night split, more presets) are out of scope.

## Appendix: Which Claude model for which part

| Part of the hackathon | Model | Why |
| --- | --- | --- |
| Planning, architecture, data-contract talks, hard debugging (globe, WebGL, state) | **Opus 5.5** (high effort) | Best judgement per cost ($4 / $20 per million tokens). It found and fixed the MapLibre 6 pitfalls in this plan. |
| Executing this plan task by task (it is fully specified) | **Sonnet 5.5** | Fast and cheaper ($2 / $10). Every step has exact code and expected output, so little judgement is needed. |
| Repetitive edits: docs, references table, AI log, copy fixes, test locator tweaks | **Haiku 5.5** | Very cheap ($0.10 / $0.50) and quick for well-defined text edits. |
| Checkpoint reviews ("does this match the plan and the brief?") | **Opus 5.5**, fresh session | An independent reader catches what the builder missed. |
| One final pre-submission audit of claims, copy and limits | **Fable 5.2** (optional) | The most capable model ($8 / $40), worth one careful pass on wording that judges will read. |
| Sunday afternoon bug fixes under time pressure | **Opus 5.5 with /fast** | Up to 2.5× faster output at 2× price. Worth it when minutes matter. |
| The harmonization method itself | **No model** | Space Apps rules: AI must not come up with the solution idea. Pierre and Andre own it. |
