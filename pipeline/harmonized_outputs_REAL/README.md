# MODIS + VIIRS hotspot harmonization (Person B pipeline)

Turns Person A's handover table into conversion factors, a validated **Aqua-MODIS-equivalent** monthly record,
calendar anomalies and figures. Method: `METHOD.md`. Numbers: `outputs*/RESULTS.md`.

> Written with AI assistance (Claude). Declare in the Space Apps "Use of SI" field.

## Run

```bash
pip install numpy pandas scipy statsmodels pyproj matplotlib tabulate
# real data (Person A's table; missing days = FIRMS list + data-detected outages, see METHOD.md)
python run.py --cell-days data_real/cell_days.csv --missing data_real/missing_days.csv --out outputs_real --label REAL --end 2026-11-13
python figures.py outputs_real && python report.py outputs_real
# synthetic test (known truth)
python -c "from harmonize import synth; a,b,c = synth.simulate(); a.to_csv('data/cell_days_SYNTHETIC.csv',index=False); b.to_csv('data/oracle_SYNTHETIC.csv',index=False); c.to_csv('data/missing_days.csv',index=False)"
python run.py --cell-days data/cell_days_SYNTHETIC.csv --missing data/missing_days.csv --oracle data/oracle_SYNTHETIC.csv --out outputs_synthetic
python figures.py outputs_synthetic --synthetic && python report.py outputs_synthetic
```
Full run about 15 s on a laptop.

## Inputs

`cell_days.csv` (one row per 5 km cell x local day x satellite x day/night; the agreed handover table):
`region, cell_id, cell_lat, cell_lon, date_local, satellite (AQUA|SNPP|NOAA20), sensor, daynight (D|N), scan_zone (1-3), n_detections, frp_sum_mw, frp_max_mw, conf_max, data_version (SP|NRT)`.
`run.py` validates columns, allowed values and the primary key before anything else.

`missing_days.csv` (optional): `satellite, date`. Days a satellite delivered no data (FIRMS `/api/missing_data/`).
Without it, an outage looks like "no fire" and biases the factors.

`cell_days.csv` must include `frp_sum_mw` (the model's fire-size covariate uses it).
`--end` drops an incomplete last day. Grid and scan zones come from Person A's pipeline (`grid.py`, `geometry.py`);
`harmonize/geometry.py` reproduces the grid exactly and is used here only for the opportunity shares.

## Outputs (for the app / Supabase)

| File | Contents |
|---|---|
| `harmonized_monthly.csv` | region, ym, H (point), H_pred_lo/hi (90% predictive), H_mean_lo/hi, measured/used counts by source, days by source, raw counts per satellite, partial_month |
| `harmonized_annual.csv` | annual totals with correctly correlated intervals |
| `calendar_anomalies.csv` | baseline median (leave-year-out, years stated), delta %, robust z, percentile |
| `current_month_to_date.csv` | the current partial month vs the same days in every year |
| `factors.csv` | S-NPP->Aqua, NOAA-20->S-NPP and chained NOAA-20->Aqua factors per region x season x day/night, 90% intervals |
| `validation_*.csv`, `edge_efficiency.csv`, `aqua_drift_diagnostic.csv`, `pairs_snpp_aqua.csv`, `summary.json`, `RESULTS.md`, `fig*.png` | validation evidence |

Notes for the app:
- **Units:** `H` is in "Aqua-MODIS fire cell-days"; show `H_pred_lo`/`H_pred_hi` as the uncertainty band.
- **Calendar NaNs:** `calendar_anomalies.csv` has `delta_pct` / `robust_z` = NaN where the baseline median (or MAD) is 0, typically winter months in Sardinia. Show "n/a" instead of 0%.
- **Gaps:** months with `days_none > 0` (Jul–Sep 2002) contain days with no satellite data. Grey them out or mark them.
- **Partial month:** `partial_month = true` marks November 2026 (to 13 Nov). Compare it with past years using `current_month_to_date.csv`, never with full months.
- **Provisional data:** August–November 2026 uses near-real-time (NRT) data and will change when standard data replaces it.

Suggested Supabase tables (small: well under the 500 MB free limit):

```sql
create table harmonized_monthly (
  region text not null, ym text not null,           -- 'YYYY-MM'
  h double precision not null, h_pred_lo double precision, h_pred_hi double precision,
  measured_aqua integer, snpp_used integer, noaa20_used integer,
  days_aqua integer, days_snpp integer, days_noaa20 integer, days_none integer,
  raw_aqua integer, raw_snpp integer, raw_noaa20 integer, partial_month boolean,
  primary key (region, ym));
create table calendar_anomalies (
  region text, year int, month int, h double precision, baseline_median double precision,
  baseline_years text, delta_pct double precision, robust_z double precision, percentile double precision,
  primary key (region, year, month));
create table factors (
  model text, region text, season text, daynight char(1), factor double precision,
  factor_lo90 double precision, factor_hi90 double precision, primary key (model, region, season, daynight));
```

## Layout

```
harmonize/config.py     every fixed parameter (dates, windows, geometry, cleaning, model)
harmonize/geometry.py   Proofs 1-2 geometry, scan-zone inversion, zone opportunity shares, cell_id
harmonize/model.py      aggregation, NB2/Poisson fit, hierarchical pooling, predictive draws
harmonize/harmonize.py  source assignment, conversion, chain, calendar anomalies, month-to-date
harmonize/validate.py   leave-one-year-out, leave-one-region-out, seams, diagnostics, edge efficiency
harmonize/synth.py      physics-based synthetic table with known truth (testing only)
run.py, figures.py, report.py
```
