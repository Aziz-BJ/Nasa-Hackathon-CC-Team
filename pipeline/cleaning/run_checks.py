"""run_checks.py - the four checks on the handover table.  python3 run_checks.py <out folder>"""
import json, os, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from grid import cell_id, _FWD
from build_cell_days import KEY

o = sys.argv[1]
cd = pd.read_csv(os.path.join(o, "cell_days.csv"), dtype={"cell_id": str, "date_local": str})
raw = pd.read_csv(os.path.join(o, "raw_counts_by_year.csv"), dtype={"year": str})
res = {}

# 1. no duplicate keys
res["1_duplicate_keys"] = int(cd.duplicated(KEY).sum())

# 2. counts per year per satellite (raw points in region vs cleaned detections and cell-days)
cd["year"] = cd.date_local.str[:4]
yr = (cd.groupby(["region", "satellite", "year"]).agg(cell_days=("n_detections", "size"),
                                                       detections=("n_detections", "sum")).reset_index()
      .merge(raw, on=["region", "satellite", "year"], how="outer").fillna(0).sort_values(["region", "year", "satellite"]))
yr.to_csv(os.path.join(o, "check_counts_by_year.csv"), index=False)
piv = yr.pivot_table(index=["region", "year"], columns="satellite", values="detections", aggfunc="sum").fillna(0)
if {"SNPP", "NOAA20"} <= set(piv.columns):
    both = piv[(piv.SNPP > 0) & (piv.NOAA20 > 0)]
    res["2_noaa20_over_snpp_by_region_year"] = (both.NOAA20 / both.SNPP).round(2).unstack(0).to_dict()
if {"SNPP", "AQUA"} <= set(piv.columns):
    both = piv[(piv.SNPP > 0) & (piv.AQUA > 0)]
    res["2_snpp_over_aqua_by_region_year"] = (both.SNPP / both.AQUA).round(2).unstack(0).to_dict()
res["2_kept_share_of_raw_by_satellite"] = (yr.groupby("satellite").detections.sum() / yr.groupby("satellite").raw_detections.sum()).round(3).to_dict()

# 3. named events visible
def event(region, start, end, lat, lon):
    sub = cd[(cd.region == region) & cd.date_local.between(start, end)]
    daily = sub.groupby(["date_local", "satellite"]).n_detections.sum().unstack(fill_value=0)
    near = sub[(np.abs(sub.cell_lat - lat) < 0.25) & (np.abs(sub.cell_lon - lon) < 0.3)]
    return {"daily_detections": daily.to_dict(orient="index"),
            "detections_within_25km_of_named_fire": near.groupby("satellite").n_detections.sum().to_dict()}
rp = os.path.join(o, "raw_in_regions.parquet")
if os.path.exists(rp):                                   # the same events in the RAW points (before cleaning)
    rw = pd.read_parquet(rp)
    for name, reg, a0, a1 in (("sardinia_2021", "sardinia", "2021-07-20", "2021-08-05"),
                              ("sicily_2023", "sicily", "2023-07-20", "2023-07-31")):
        sub = rw[(rw.region == reg) & rw.acq_date.between(a0, a1)]
        res[f"3_raw_{name}_daily_points"] = sub.groupby(["acq_date", "satellite"]).size().unstack(fill_value=0).to_dict(orient="index")
res["3_sardinia_2021_jul20_aug05"] = event("sardinia", "2021-07-20", "2021-08-05", 40.10, 8.60)      # Montiferru
res["3_sicily_2023_jul20_jul31"] = event("sicily", "2023-07-20", "2023-07-31", 38.10, 13.35)          # Palermo area
for reg in ("sardinia", "sicily"):
    m = cd[cd.region == reg].groupby(["year", "satellite"]).n_detections.sum().unstack(fill_value=0)
    res[f"3_{reg}_rank_of_target_year"] = {s: int((m[s].rank(ascending=False)).get("2021" if reg == "sardinia" else "2023", -1))
                                         for s in m.columns}

# 4. identical grid for both sensors
g = {}
g["epsg_matches_region"] = bool(((cd.region == "california") == cd.cell_id.str.startswith("3310_")).all())
ids, _, _ = cell_id(cd.cell_lon.values, cd.cell_lat.values, cd.region.values)
g["cell_id_recomputed_from_centre_same"] = float((ids == cd.cell_id.values).mean())
g["one_centre_per_cell_id"] = bool((cd.groupby("cell_id")[["cell_lat", "cell_lon"]].nunique().max() == 1).all())
off = []
for e in (3035, 3310):
    m = cd.cell_id.str.startswith(f"{e}_")
    x, y = _FWD[e].transform(cd.cell_lon[m].values, cd.cell_lat[m].values)
    off.append(np.abs(np.r_[np.mod(x, 5000), np.mod(y, 5000)] - 2500).max())
g["max_offset_of_centre_from_lattice_m"] = float(max(off))      # 0 up to the 5-decimal rounding of lat/lon
by = cd.groupby("cell_id").sensor.agg(lambda s: "+".join(sorted(set(s))))
g["cells_by_sensor"] = by.value_counts().to_dict()
res["4_identical_grid"] = g
json.dump(res, open(os.path.join(o, "checks.json"), "w"), indent=1, default=str)
print(json.dumps(res, indent=1, default=str)[:6000])
