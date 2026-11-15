# Hotspot Calendar

A map-first web app for the NASA Space Apps 2026 challenge **Harmonization of MODIS and VIIRS Hot Spots**.
Pick any area on a 3D globe and see a monthly calendar of satellite fire detections from the early 2000s to now,
with MODIS and VIIRS on one scale, how the latest month compares with previous years, and downloads.

It runs on **synthetic mock data** (red banner) until the real FIRMS pipeline output arrives.

## What you can do

- **Area:** a preset region, a circle, rectangle, polygon or freehand shape drawn on the globe, or typed coordinates (box or point + radius).
- **Dates:** drag the two handles on a 2000–2026 bar coloured by the area's monthly hotspots, pick a quick range, or type months.
- **Layers:** harmonized record or raw MODIS / VIIRS S-NPP / VIIRS NOAA-20, colour ramp (inferno or cividis), day or night imagery, labels.
- **Calendar:** years × months burning calendar with year totals and the typical-year row; keyboard and table view.
- **Trends:** the chosen year against a typical year, and monthly anomalies against the multi-year average or median.
- **Sensors:** raw MODIS vs raw VIIRS vs harmonized, showing the false 2012 jump in the stitched raw record.
- **Reported:** satellite detections next to fires reported on the ground (presets with a published statistic).
- **Download:** CSV of the monthly numbers with a provenance header, SVG images of every chart, and a shareable link.
- **More info:** the verdict for the latest month (percentile, rank, anomaly, year to date).

## Run

```bash
npm install
npm run dev          # generates mock data, starts http://localhost:5173
npm test             # unit tests (Vitest), 74
npm run test:e2e     # end-to-end + accessibility on desktop and phone (Playwright), 25
npm run build:demo   # static build WITH mock data and the red banner
npm run build        # production build: refuses mock data
```

The first `npm run test:e2e` needs the test browser: `npx playwright install chromium`.

## Real data

Put the pipeline output in `public/data/<name>/` (format: [`../docs/DATA_CONTRACT.md`](../docs/DATA_CONTRACT.md);
writer: [`../docs/write_app_data.py`](../docs/write_app_data.py)) and run or build with `VITE_DATASET=<name>`.
Tunable numbers (colour bins, anomaly floor, verdict thresholds, area limit) are in `src/config.ts`.

## Code map

```
src/lib/          pure logic, unit tested: months, grid, data loader, areas, aggregation, indices, colours, CSV, downloads
src/state/        app state and shareable links
src/hooks/        dataset and area loading
src/components/   GlobeMap, panels (Area, Dates, Layers), BurningCalendar, charts, KpiRow, AboutPage
src/components/shell/  top bar, feature boxes, side drawers, bottom strip, guide
scripts/          mock data generator, build guard
e2e/              Playwright tests
```

Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Imagery: NASA GIBS. Labels: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors.
A historical record of satellite detections, not an official warning service.
Parts of this code were generated with AI assistance (Claude) and reviewed by the team; see [`../docs/AI_USE.md`](../docs/AI_USE.md).
