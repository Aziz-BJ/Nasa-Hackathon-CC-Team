"""validate_agreement.py - does cleaning make MODIS and VIIRS comparable, and does the result look like real fire data?
Compares RAW points (inside the four regions, nothing else removed) with the CLEANED detections.
Usage: python3 validate_agreement.py <raw-in-regions parquet with cell_id> <detections_clean.parquet> <out folder>"""
import json, os, sys
import numpy as np, pandas as pd

raw_p, clean_p, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
KEEP = ["AQUA", "SNPP", "NOAA20"]
raw = pd.read_parquet(raw_p)
# heat-source mask recomputed on the raw points (own flag, static spot within 1 km, volcano boxes) for the named-fire test
from scipy.spatial import cKDTree
raw["spot"] = raw.cell_id.str[:4] + "_" + np.floor(raw.x / 1000).astype(np.int64).astype(str) + "_" + np.floor(raw.y / 1000).astype(np.int64).astype(str)
fl = raw["type"].isin([1, 2, 3])
sp = raw[fl].assign(ym=raw.acq_date.str[:7]).groupby("spot").agg(m=("ym", "nunique"), x=("x", "mean"), y=("y", "mean"), e=("cell_id", lambda c: c.iloc[0][:4]))
sp = sp[sp.m >= 6]
near = np.zeros(len(raw), bool)
for e in ("3035", "3310"):
    S = sp[sp.e == e]; m = raw.cell_id.str.startswith(e + "_").values
    near[m] = cKDTree(np.c_[S.x, S.y]).query(np.c_[raw.x.values[m], raw.y.values[m]])[0] <= 1000
box = (raw.latitude.between(37.67, 37.83) & raw.longitude.between(14.89, 15.11)) | (raw.latitude.between(38.76, 38.83) & raw.longitude.between(15.17, 15.26))
raw["heat_removed"] = fl.values | near | box.values
raw["own_flag_only"] = fl.values & ~near & ~box.values          # removed only because the product flagged it
raw = raw[raw.satellite.isin(KEEP)].copy()
utc = pd.to_datetime(raw.acq_date + " " + raw.acq_time.str[:2] + ":" + raw.acq_time.str[2:], utc=True)
raw["date_local"] = (utc + pd.to_timedelta(raw.longitude / 15, unit="h")).dt.strftime("%Y-%m-%d")
raw["daynight"] = raw.daynight_firms
cl = pd.read_parquet(clean_p)
for d in (raw, cl):
    d["area"] = np.where(d.region == "california", "California", "Italy")
    d["ym"] = d.date_local.str[:7]; d["mon"] = d.date_local.str[5:7].astype(int); d["yr"] = d.date_local.str[:4].astype(int)
R = {}

# ---- M1 monthly agreement Aqua vs S-NPP (full overlap 2013-2025), raw vs cleaned
def monthly(d):
    m = d[(d.yr >= 2013) & (d.yr <= 2025)].groupby(["area", "ym", "mon", "satellite"]).size().unstack(fill_value=0)
    return m.reset_index()
M = {"raw": monthly(raw), "clean": monthly(cl)}
m1 = {}
by_month_rows = []
for k, m in M.items():
    for a, g in m.groupby("area"):
        la, ls = np.log1p(g.AQUA), np.log1p(g.SNPP)
        ratio = (g.SNPP / g.AQUA.replace(0, np.nan))
        cm = ratio.groupby(g.mon).median()
        m1[f"{k}_{a}"] = {"corr_log_monthly_counts": round(float(np.corrcoef(la, ls)[0, 1]), 3),
                          "median_ratio": round(float(ratio.median()), 2),
                          "ratio_iqr_over_median": round(float((ratio.quantile(.75) - ratio.quantile(.25)) / ratio.median()), 2),
                          "calendar_month_ratio_max_over_min": round(float(cm.max() / cm.min()), 2),
                          "months_with_aqua_zero": int((g.AQUA == 0).sum())}
        for mon, v in cm.items():
            by_month_rows.append({"version": k, "area": a, "month": int(mon), "snpp_over_aqua": round(float(v), 2)})
R["M1_monthly_aqua_vs_snpp"] = m1
pd.DataFrame(by_month_rows).to_csv(os.path.join(out, "ratio_by_calendar_month.csv"), index=False)

# ---- M2 night share
R["M2_night_share"] = {k: (d.groupby(["area", "satellite"]).daynight.apply(lambda s: round(float((s == "N").mean()), 3))
                           .unstack().to_dict(orient="index")) for k, d in (("raw", raw), ("clean", cl))}

# ---- M3 NOAA-20 vs S-NPP (2019-2025)
m3 = {}
for k, d in (("raw", raw), ("clean", cl)):
    g = d[(d.yr >= 2019) & (d.yr <= 2025)].groupby(["area", "ym", "satellite"]).size().unstack(fill_value=0)
    r = (g.NOAA20 / g.SNPP.replace(0, np.nan)).groupby(level=0)
    m3[k] = {a: {"median": round(float(v.median()), 3), "p10": round(float(v.quantile(.1)), 3), "p90": round(float(v.quantile(.9)), 3)} for a, v in r}
    cd = d[(d.yr >= 2019) & (d.yr <= 2025)][["cell_id", "date_local", "daynight", "satellite"]].drop_duplicates()
    s = {sat: set(map(tuple, cd[cd.satellite == sat][["cell_id", "date_local", "daynight"]].values)) for sat in ("SNPP", "NOAA20")}
    inter = len(s["SNPP"] & s["NOAA20"])
    m3[k]["cellday_jaccard"] = round(inter / len(s["SNPP"] | s["NOAA20"]), 3)
R["M3_noaa20_vs_snpp"] = m3

# ---- M4 co-located cell-day agreement, Aqua vs S-NPP, same local day and day/night (2013-2025)
m4 = {}
for k, d in (("raw", raw), ("clean", cl)):
    cd = d[(d.yr >= 2013) & (d.yr <= 2025)][["cell_id", "date_local", "daynight", "satellite"]].drop_duplicates()
    for dn in ("D", "N"):
        s = {sat: set(map(tuple, cd[(cd.satellite == sat) & (cd.daynight == dn)][["cell_id", "date_local"]].values)) for sat in ("AQUA", "SNPP")}
        inter = len(s["AQUA"] & s["SNPP"])
        m4[f"{k}_{dn}"] = {"aqua_celldays": len(s["AQUA"]), "snpp_celldays": len(s["SNPP"]),
                          "P(snpp | aqua)": round(inter / len(s["AQUA"]), 3), "P(aqua | snpp)": round(inter / len(s["SNPP"]), 3)}
R["M4_colocated_celldays"] = m4

# ---- M5 persistent cells: active in >= 24 distinct months, and their share of night detections
m5 = {}
for k, d in (("raw", raw), ("clean", cl)):
    act = d.groupby("cell_id").ym.nunique()
    pers = set(act[act >= 24].index)
    n = d[d.daynight == "N"]
    m5[k] = {"cells_active_24plus_months": len(pers),
             "share_of_night_detections_in_them": round(float(n.cell_id.isin(pers).mean()), 3),
             "share_of_day_detections_in_them": round(float(d[d.daynight == "D"].cell_id.isin(pers).mean()), 3)}
R["M5_persistent_cells"] = m5

# ---- P plausibility on the cleaned data
R["P1_seasonality_share_by_month"] = (cl.groupby(["area", "mon"]).size() / cl.groupby("area").size()).round(3).unstack().to_dict(orient="index")
R["P2_local_overpass_hour"] = (cl.groupby(["satellite", "daynight"]).local_hour.describe(percentiles=[.05, .5, .95])
                               [["5%", "50%", "95%"]].round(2).reset_index().to_dict("records"))
R["P3_frp_mw_quantiles"] = (cl.groupby("satellite").frp.describe(percentiles=[.1, .5, .9, .99])[["10%", "50%", "90%", "99%"]]
                            .round(2).to_dict(orient="index"))
R["P3_raw_frp_median"] = raw.groupby("satellite").frp.median().round(2).to_dict()
zs = cl[(cl.yr >= 2013) & (cl.yr <= 2025)].groupby(["satellite", "yr"]).scan_zone.apply(lambda s: round(float((s == 1).mean()), 3)).unstack(0)
R["P4_zone1_share_by_year"] = {"min": zs.min().to_dict(), "max": zs.max().to_dict()}
R["P4_zone_share"] = cl.groupby("satellite").scan_zone.value_counts(normalize=True).round(3).unstack().to_dict(orient="index")

# named fires: raw points inside a box and date window, and how many survived each stage
FIRES = [("Montiferru, Sardinia", "sardinia", "2021-07-23", "2021-07-27", 39.95, 40.25, 8.40, 8.80),
         ("Palermo-Monreale, Sicily", "sicily", "2023-07-23", "2023-07-27", 37.85, 38.30, 12.90, 13.75),
         ("Calabria (Aspromonte), Aug 2021", "italy_mainland", "2021-08-08", "2021-08-16", 37.95, 38.35, 15.75, 16.25),
         ("Camp Fire, California", "california", "2018-11-08", "2018-11-25", 39.60, 40.00, -121.90, -121.30),
         ("August Complex, California", "california", "2020-08-17", "2020-11-11", 39.40, 40.40, -123.40, -122.40),
         ("Dixie Fire, California", "california", "2021-07-13", "2021-10-25", 39.80, 40.60, -121.50, -120.60),
         ("Thomas Fire, California", "california", "2017-12-04", "2018-01-12", 34.30, 34.65, -119.60, -119.10)]
fr = []
for name, reg, a, b, la0, la1, lo0, lo1 in FIRES:
    row = {"fire": name, "dates": f"{a} to {b}"}
    for sat in KEEP:
        r_ = raw[(raw.satellite == sat) & raw.acq_date.between(a, b) & raw.latitude.between(la0, la1) & raw.longitude.between(lo0, lo1)]
        c_ = cl[(cl.satellite == sat) & cl.acq_date.between(a, b) & cl.latitude.between(la0, la1) & cl.longitude.between(lo0, lo1)]
        row[f"{sat}_raw"] = len(r_); row[f"{sat}_clean"] = len(c_)
        row[f"{sat}_heat_removed"] = int(r_.heat_removed.sum())
    fr.append(row)
pd.DataFrame(fr).to_csv(os.path.join(out, "named_fires.csv"), index=False)
R["P5_named_fires"] = fr

# ---- M6 detections removed only by their own product flag (outside static spots and volcano boxes):
#      how many have an unflagged detection of the same satellite within 2 km and about 5 min (same pass)?
#      a large share = flags on the edges of real fires (e.g. VIIRS "offshore" type 3 at lake and coast pixels)
raw["t"] = (pd.to_datetime(raw.acq_date).values.astype("datetime64[m]").astype(np.int64)
            + raw.acq_time.str[:2].astype(int).values * 60 + raw.acq_time.str[2:].astype(int).values)
m6 = []
for sat in KEEP:
    a_ = raw[raw.satellite == sat]
    v_ = a_[~a_["type"].isin([1, 2, 3])]
    T = cKDTree(np.c_[v_.x / 1000, v_.y / 1000, v_.t * 0.4])         # 0.4 km per minute: 2 km ~ 5 min
    o_ = a_[a_.own_flag_only]
    near_fire = T.query_ball_point(np.c_[o_.x / 1000, o_.y / 1000, o_.t * 0.4], r=2.0, return_length=True) > 0
    for (ar, ty), g in o_.assign(nf=near_fire).groupby(["area", "type"]):
        m6.append({"satellite": sat, "area": ar, "type": int(ty), "removed": len(g),
                   "share_next_to_unflagged_fire": round(float(g.nf.mean()), 3), "night_share": round(float((g.daynight == "N").mean()), 3),
                   "frp_median_mw": round(float(g.frp.median()), 1), "raw_points_of_satellite_in_area": int(((raw.satellite == sat) & (raw.area == ar)).sum())})
pd.DataFrame(m6).to_csv(os.path.join(out, "own_flag_only.csv"), index=False)
R["M6_own_flag_only"] = m6
json.dump(R, open(os.path.join(out, "agreement.json"), "w"), indent=1, default=str)
print(json.dumps(R, indent=1, default=str)[:12000])
