# Data contract: pipeline → Hotspot Calendar app (version 2)

What the app reads from `demo/public/data/<name>/`. Since 15 Nov 2026 it is written by the importer, not by hand:

```bash
cd demo
npm run import-data -- --cells <path to Andrea's cell_days.csv>
#   --pipeline <folder>   Pierre's outputs (default ../pipeline/harmonized_outputs_REAL)
#   --outlines <geojson>  region outlines (default ../pipeline/region_outlines/region_outlines_all_four_regions.geojson)
#   --out <folder>        (default public/data/real)
```

Run it again after any new pipeline run. It stops, writing nothing, if the inputs do not add up: regions or months missing, `H` outside
its range, a partial month that is not the last one, days by source that differ between regions, a measured month that the cells do not
rebuild exactly, or raw counts per satellite that differ from Pierre's. On the 15 Nov run: 904 of 904 measured months rebuilt exactly,
and raw counts matched in 1,172 of 1,172 region-months.

## Inputs

| From | File | Used for |
|---|---|---|
| Pierre | `harmonized_monthly.csv` | the record: `H`, `H_pred_lo/hi`, raw counts per satellite, days per source, `partial_month` |
| Pierre | `current_month_to_date.csv` | the unfinished month against the same days of every year |
| Pierre | `factors.csv` | converting each S-NPP / NOAA-20 cell-day to the Aqua scale for the map, and the Sensors panel table |
| Pierre | `missing_days.csv` | which satellite the record uses on each day |
| Pierre | `validation_loyo.csv`, `validation_seams.csv`, `validation_chain_stress.csv` | headline validation numbers in About |
| Andrea | `cell_days.csv` (v1.1) | one row per 5 km cell × local day × satellite × day/night |
| Andrea | `region_outlines_all_four_regions.geojson` | the `kind: land` outline of each region |

## Files

| File | Size (15 Nov run) | Loaded |
|---|---|---|
| `manifest.json` | 5 KB | at start |
| `regions.json` | 31 KB | at start |
| `outlines.json` | 88 KB | at start (optional: without it, regions are drawn as boxes) |
| `cells/<region>.json` | 0.1 to 2 MB (1 MB gzipped in all) | when an area touches the region |
| `reported.json` | optional | ground-reported fires; the Reported panel shows only if it exists |

### manifest.json

```ts
{
  schema_version: 2, mock: boolean, dataset_name: string,
  first_month: 'YYYY-MM', last_month: 'YYYY-MM',  // 2002-07 .. 2026-11
  month_to_date: boolean, last_day: 'YYYY-MM-DD',  // true, 2026-11-13
  nrt_from: 'YYYY-MM',                              // near-real-time (provisional) from 2026-08
  baseline_years: [2003, 2025], harmonized_coverage: ['YYYY-MM', 'YYYY-MM'],
  unit: 'fire cell-days', cell_km: 5,
  sensors: [{ key: 'modis' | 'viirs_snpp' | 'viirs_noaa20', label, source, version, first_month, last_month }],
  days: { aqua: number[], snpp: number[], noaa20: number[], none: number[] },  // per month: days by the satellite the record uses
  regions: [{ id, name, bbox: [w, s, e, n], area_km2, cells }],
  groups: [{ id: 'italy', name: 'All of Italy', regions: ['italy_mainland', 'sicily', 'sardinia'] }],
  method: { name, version, reference_scale, fit_window },
  validation: { loyo_male_naive, loyo_male, loyo_r2, coverage90, seams: [{ seam, step_pct, lo90_pct, hi90_pct, no_step }], chain_ratio },
  generated_at: string
}
```

### regions.json

```ts
{
  series: { [regionId]: {          // one value per month, first_month..last_month
    harmonized: number[],          // Pierre's H
    low: number[], high: number[], // H_pred_lo / H_pred_hi (equal to H in measured Aqua months)
    modis: (number | null)[], viirs_snpp: (number | null)[], viirs_noaa20: (number | null)[]  // raw cell-days, null before launch
  } },
  mtd: { month: 'YYYY-MM', day: number, years: number[],
         series: { [regionId]: { values: number[], low: number[], high: number[] } } } | null,
  factors: { [regionId]: [{ model: 'snpp_to_aqua' | 'noaa20_to_snpp' | 'noaa20_to_aqua', season: 'fire' | 'off', daynight: 'D' | 'N', factor, low, high }] }
}
```

### outlines.json

A GeoJSON FeatureCollection, one MultiPolygon per region with properties `{ id, name }`: Andrea's land outlines (ISTAT regions for
Italy, US Census TIGER 2010 for California), simplified to about 400 m for the web.

### cells/&lt;region&gt;.json

```ts
{
  region: string,
  cells: [id, lat, lon][],    // Andrea's cell_id and cell centre
  entries: number[],          // [cell index, month index, harmonized, aqua, snpp, noaa20] repeated, sorted by cell then month
  mtd: number[]               // [cell index, year index (into regions.json mtd.years), harmonized] repeated
}
```

Cells and months that are not listed are 0. Raw counts are all of that satellite's cell-days (as in Pierre's `raw_*` columns).
The harmonized value follows Pierre's source rule day by day:

1. For each day, take the satellite the record uses (Aqua to 30 Jun 2021, S-NPP to 1 Nov 2026, NOAA-20 after; a missing satellite-day
   falls to the next source, as in METHOD.md section 0).
2. Count each of that satellite's cell-days as 1 (Aqua) or as Pierre's factor for its region, season and day/night (S-NPP → Aqua, or the
   NOAA-20 → Aqua chain).
3. Scale every region-month so its cells add up exactly to Pierre's `H`. This carries the model's fire-size term, which the factor table
   leaves out. Before scaling, converted months were within 0.65 to 1.33 of `H` (median 0.99).

So a whole region always shows Pierre's numbers, and a drawn shape inside a region is an estimate: the region's conversion applied to
part of it. The app says so and shows no 90% range for drawn shapes.

## Rules the app relies on

- `null` means the sensor was not flying; 0 means it flew and saw nothing.
- A count of 0 is not "no fire": cloud, smoke and gaps between passes hide fires.
- Only the last month may be partial, and it is compared with the same days of earlier years (`regions.json` `mtd`), never with whole months.
- A production build refuses a dataset with `mock: true` (`scripts/check-data.mjs`).

The app's TypeScript types for all of this are in [`demo/src/lib/types.ts`](../demo/src/lib/types.ts).
Version 1 (10° tiles of a global grid, written by `write_app_data.py`) was used by the mock-data demo before the real data arrived; it is retired.
