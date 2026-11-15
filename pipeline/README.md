# Pipeline outputs used by the app

The app's data (`app/public/data/real/`) is built from these files by `app/scripts/import-data.ts`
(see [docs/DATA_CONTRACT.md](../docs/DATA_CONTRACT.md)).

| Folder | From | What |
|---|---|---|
| `harmonized_outputs_REAL/` | Pierre (Person B), run of 15 Nov 2026 on Andrea's table, data to 13 Nov 2026 | The harmonized monthly record, calendar anomalies, month-to-date comparison, conversion factors, missing days, validation tables and figures, `METHOD.md` and `RESULTS.md`. Copied unchanged. |
| `cleaning/` | Andrea (Person A), version 1.1 | The cleaning pipeline that turns the raw FIRMS downloads into the 5 km `cell_days` table and `detections_clean.parquet`: `build_cell_days.py` (with `grid.py`, `regions.py`, `geometry.py`, `cell_days.sql`), its checks and tests, and the validation scripts (including `validate_independent.py`, a second implementation of the same rules). How to run it: `cleaning/README.md`. `geo/` holds the boundary sources (ISTAT, US Census TIGER 2010, Natural Earth). Copied unchanged from `SpaceApps2026_Andrea_main.zip` (`03_pipeline_code/pipeline`). |
| `region_outlines/` | Andrea (Person A) | `region_outlines_all_four_regions.geojson` (the four study regions: land outline and sea-margin extent) and `regions.py`, the point-to-region rule that made it. Copied unchanged. |

Not in the repository, because of size: Andrea's `cell_days.csv` (48 MB, version 1.1: one row per 5 km cell × local day ×
satellite × day/night), the six FIRMS archive downloads and the intermediate files. They are in the team's shared drive as
`SpaceApps2026_Andrea_main.zip` (the table is `02_handover_table_v1.1/cell_days.csv`), `SpaceApps2026_Andrea_raw_downloads.zip` and
`SpaceApps2026_Andrea_intermediate_data.zip`. To rebuild the app's data:

```bash
cd app
npm run import-data -- --cells <path to cell_days.csv>
```

Both pipelines were written with AI assistance (Claude) from the team's decisions; see `harmonized_outputs_REAL/METHOD.md` and
Andrea's handover document.
