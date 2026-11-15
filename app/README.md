# Hotspot Calendar

A map-first web app for the NASA Space Apps 2026 challenge **Harmonization of MODIS and VIIRS Hot Spots**.
It shows the team's harmonized fire record for mainland Italy, Sicily, Sardinia and California on a 3D globe: a monthly burning
calendar from July 2002 to now with MODIS and VIIRS on one scale, where the fires were on a 5 km grid, how the latest month compares
with 2003 to 2025, and downloads.

Numbers are **fire cell-days** on the Aqua MODIS scale: 5 km squares with at least one fire detection in a day or night pass.

## What you can do

- **Area:** one of the four regions or All of Italy (also by clicking a region on the globe); a circle, rectangle, polygon or freehand
  shape drawn inside a region; or typed coordinates (box or point + radius). Regions use the record itself, with its 90% range; drawn
  shapes add up the 5 km cells inside them (an estimate for the harmonized line, exact for raw sensors).
- **Globe:** regions tinted by how the latest chosen month compares with usual; the chosen area's 5 km fire cells coloured by the chosen months.
- **Dates:** drag the two handles on a 2002–2026 bar coloured by the area's monthly activity, or type months (pencil button).
- **Layers:** harmonized record or raw Aqua MODIS / S-NPP VIIRS / NOAA-20 VIIRS, colour ramp (inferno or cividis), day or night imagery, labels.
  An optional switch shows every cleaned detection at its native pixel size, coloured by satellite (raw data, not harmonized).
- **Calendar:** years × months burning calendar with year totals and the typical-year row; incomplete, provisional and unfinished months marked; keyboard and table view.
- **Trends:** the chosen year against a typical year (with its 90% range), and monthly anomalies against the multi-year median or mean.
- **Sensors:** raw MODIS vs raw VIIRS vs harmonized, showing the false jump in a naive splice, and the region's conversion factors.
- **Download:** CSV of the monthly numbers (range, source, raw counts, comparison) with a provenance header, SVG images of every chart, and a shareable link.
- **More info:** the verdict for the latest month (percentile, rank, difference from the median, robust z, year to date). The unfinished
  month is compared with the same days of earlier years.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest), including the app against all 1,168 rows of Pierre's calendar_anomalies.csv
npm run test:e2e     # end-to-end + accessibility on desktop and phone (Playwright)
npm run build        # production build (refuses data marked mock)
```

The first `npm run test:e2e` needs the test browser: `npx playwright install chromium`.

## Refreshing the data

After a new pipeline run:

```bash
npm run import-data -- --cells <path to Andrea's cell_days.csv>
```

It reads Pierre's outputs from `../pipeline/harmonized_outputs_REAL/` and the outlines from `../pipeline/region_outlines/`, checks that
everything adds up, and rewrites `public/data/real/`. Format and checks: [`../docs/DATA_CONTRACT.md`](../docs/DATA_CONTRACT.md).
The optional detections layer has its own importer, from Andrea's `detections_clean.parquet`:

```bash
npm run import-detections -- --parquet <path to detections_clean.parquet>
```

Tunable numbers (colour bins, the median below which differences are shown as numbers, verdict thresholds, shape size limit) are in `src/config.ts`.

## Code map

```
src/lib/          pure logic, unit tested: months, grid, data loader, areas, aggregation, indices, colours, CSV, downloads
src/state/        app state and shareable links
src/hooks/        dataset and area loading
src/components/   GlobeMap, panels (Area, Dates, Layers), BurningCalendar, charts, FactorTable, KpiRow, AboutPage
src/components/shell/  top bar, feature boxes, side drawers, bottom strip, guide
scripts/          import-data (pipeline outputs → app files), import-detections (raw detections → map layer), build guard
e2e/              Playwright tests
```

Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Region outlines: ISTAT, US Census TIGER 2010. Imagery: NASA GIBS.
Labels: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors. A historical record of satellite detections, not an official warning service.
Parts of this code were generated with AI assistance (Claude) and reviewed by the team; see [`../docs/AI_USE.md`](../docs/AI_USE.md).
