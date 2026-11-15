"""build_cell_days.py - FIRMS points -> cleaned cell_days handover table (Person A).

Usage:  python3 build_cell_days.py <folder with FIRMS csv/zip files> <output folder>

Steps (each one is logged with row counts to <out>/cleaning_log.json):
  1 load      all fire_archive_* (standard, SP) and fire_nrt_* (NRT) CSVs; label satellite and version
  2 versions  per satellite and request, NRT kept only for UTC dates after the last SP date; exact duplicates
              dropped; an NRT row that repeats an SP row (same satellite and position, within 10 min) dropped
  3 region    point -> italy_mainland / sicily / sardinia / california (regions.py); others dropped
  4 grid      5 km cell_id with the shared function (grid.py)
  5 heat      drop (a) each product's own type 1/2/3 flags, (b) everything within 1 km of a static spot
              (a 1 km square flagged by any satellite in >= 6 distinct months), (c) the Etna and Stromboli boxes
  6 confidence  drop MODIS < 30 and VIIRS low; classes nominal / high
  7 time      local solar date (UTC + lon/15 h); day/night recomputed from the solar zenith angle
  8 zone      scan angle and scan_zone from (scan, track) (geometry.py)
  9 dedup     (a) bow-tie: within one pass, drop a detection closer than half a pixel to a better one
                  (better = smaller scan angle, then larger FRP, then higher confidence, then SP over NRT;
                   exact ties after that broken by latitude, longitude, time, so file order never matters)
              (b) overlapping orbits: one pass per cell x local day x satellite x day/night, the one nearest track
 10 collapse  one row per region, cell_id, date_local, satellite, daynight
"""
import glob, json, os, re, sys, zipfile, io
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from grid import cell_id                     # noqa: E402
from regions import assign_region            # noqa: E402
from geometry import scan_zone, calibrate, SENSOR       # noqa: E402

KEEP_SATS = ("AQUA", "SNPP", "NOAA20")
MODIS_CONF_MIN, MODIS_CONF_HIGH = 30, 80
SZA_DAY_MAX = 85.0                           # day if solar zenith angle < 85 deg (MODIS C6 convention)
PASS_GAP_MIN = 30.0                          # detections > 30 min apart belong to different passes
STATIC_MIN_MONTHS = 6                        # a static spot is flagged in >= 6 distinct months
STATIC_RADIUS_M = 1000.0                     # ... and masks everything within 1 km of its centre
NRT_REPEAT_MIN = 10.0                        # an NRT row at an SP row's position within 10 min is the same detection
# Volcano boxes (lat_min, lat_max, lon_min, lon_max). Etna: summit 37.75 N 15.00 E, box covers the summit
# craters and the lava-flow fields of 2001-2026 (about 9 km each way). Stromboli: the whole island.
BOXES = {"etna": (37.67, 37.83, 14.89, 15.11), "stromboli": (38.76, 38.83, 15.17, 15.26)}
OUT_COLS = ["region", "cell_id", "cell_lat", "cell_lon", "date_local", "satellite", "sensor", "daynight",
            "scan_zone", "n_detections", "frp_sum_mw", "frp_max_mw", "conf_max", "data_version"]
KEY = ["region", "cell_id", "date_local", "satellite", "daynight"]


# ---------------------------------------------------------------- 1. load
def _iter_csvs(folder):
    for p in sorted(glob.glob(os.path.join(folder, "**", "*"), recursive=True)):
        low = p.lower()
        if low.endswith(".csv"):
            yield os.path.basename(p), open(p, "rb").read()
        elif low.endswith(".zip"):
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if n.lower().endswith(".csv"):
                        yield os.path.basename(p) + "/" + os.path.basename(n), z.read(n)


SAT_MAP = {"aqua": "AQUA", "a": "AQUA", "terra": "TERRA", "t": "TERRA", "n": "SNPP", "npp": "SNPP", "snpp": "SNPP",
           "suomi npp": "SNPP", "suomi-npp": "SNPP", "n20": "NOAA20", "noaa-20": "NOAA20", "noaa20": "NOAA20",
           "j1": "NOAA20", "1": "NOAA20", "n21": "NOAA21", "noaa-21": "NOAA21", "j2": "NOAA21"}


def _file_sat_hint(name):
    n = name.upper()
    if "J1V" in n or "NOAA20" in n or "NOAA-20" in n: return "NOAA20"
    if "J2V" in n or "NOAA21" in n: return "NOAA21"
    if "SV-C2" in n or "SUOMI" in n or "SNPP" in n or "VNP" in n: return "SNPP"
    return None


def _request_id(name):
    """One FIRMS archive request = one zip (DL_FIRE_<tag>_<number>.zip) holding fire_archive_* and fire_nrt_*.
    Loose CSVs are grouped by their trailing request number."""
    if "/" in name:
        return name.split("/")[0]
    m = re.search(r"_(\d+)\.csv$", name)
    return m.group(1) if m else name


def load(folder):
    frames, files = [], []
    for name, raw in _iter_csvs(folder):
        df = pd.read_csv(io.BytesIO(raw), dtype={"acq_time": str, "confidence": str, "version": str,
                                                  "satellite": str, "daynight": str})
        if df.empty:
            files.append({"file": name, "rows": 0}); continue
        # Sensor from the file tag (M-C61 = MODIS, SV-C2 / J1V-C2 = VIIRS) cross-checked with the columns.
        # FIRMS archive VIIRS files reuse the MODIS column names (brightness, bright_t31), so columns alone
        # cannot tell the sensors apart; the instrument column says MODIS, VIIRS or SNPP.
        tag = name.upper()
        sensor = "MODIS" if "M-C61" in tag or "MODIS" in tag else ("VIIRS" if any(k in tag for k in ("SV-C2", "J1V", "J2V", "VIIRS")) else None)
        if sensor is None:
            sensor = "VIIRS" if "bright_ti4" in df.columns else None
        inst = set(df["instrument"].astype(str).str.upper()) if "instrument" in df.columns else set()
        if sensor is None or (sensor == "MODIS" and inst - {"MODIS"}) or (sensor == "VIIRS" and inst & {"MODIS"}):
            raise ValueError(f"{name}: cannot tell MODIS from VIIRS (file tag, instrument {inst})")
        sat = df["satellite"].astype(str).str.strip().str.lower().map(SAT_MAP)
        hint = _file_sat_hint(name)
        if sensor == "VIIRS" and hint is not None:
            if sat.notna().any() and (sat.dropna() != hint).any():
                raise ValueError(f"{name}: satellite column {set(df.satellite)} disagrees with file name ({hint})")
            sat = sat.fillna(hint)
        if sat.isna().any():
            raise ValueError(f"{name}: unknown satellite codes {set(df.satellite[sat.isna()])}")
        out = pd.DataFrame({
            "latitude": df.latitude.astype(float), "longitude": df.longitude.astype(float),
            "scan": df.scan.astype(float), "track": df.track.astype(float),
            "acq_date": df.acq_date.astype(str), "acq_time": df.acq_time.astype(str).str.zfill(4),
            "satellite": sat.values, "sensor": sensor, "confidence": df.confidence.astype(str).str.strip(),
            "version": df.version.astype(str).str.strip(), "frp": df.frp.astype(float),
            "daynight_firms": df.daynight.astype(str).str.strip(),
            "type": pd.to_numeric(df["type"], errors="coerce") if "type" in df.columns else np.nan,
            "source_file": name, "request": _request_id(name)})
        out["data_version"] = np.where(out.version.str.upper().str.contains("NRT"), "NRT", "SP")
        if out[["latitude", "longitude", "scan", "track", "frp"]].isna().any().any():
            raise ValueError(f"{name}: missing latitude/longitude/scan/track/frp values")
        frames.append(out)
        files.append({"file": name, "rows": len(out), "sensor": sensor,
                      "satellites": sorted(out.satellite.unique().tolist()),
                      "versions": sorted(out.version.unique().tolist()),
                      "dates": [out.acq_date.min(), out.acq_date.max()]})
    if not frames:
        raise SystemExit("no FIRMS CSV files found")
    return pd.concat(frames, ignore_index=True), files


# ---------------------------------------------------------------- 7. solar time
def solar(df):
    """Local mean solar time (UTC + lon/15 h) for the local date, and the geometric solar zenith angle
    from NREL's Solar Position Algorithm (pvlib.solarposition.spa_python, accuracy about 0.0003 deg).
    The zenith angle is a function of local apparent solar time (hour angle), latitude and date."""
    import pvlib
    utc = pd.to_datetime(df.acq_date + " " + df.acq_time.str[:2] + ":" + df.acq_time.str[2:], utc=True)
    local = utc + pd.to_timedelta(df.longitude.values / 15.0, unit="h")          # local mean solar time
    sza = pvlib.solarposition.spa_python(pd.DatetimeIndex(utc), df.latitude.values, df.longitude.values)["zenith"].values
    return utc, local, sza


# ---------------------------------------------------------------- 9a. passes and bow-tie duplicates
def pass_ids(df):
    """Per satellite AND per area (Italy = EPSG:3035, California = EPSG:3310), sort by UTC time; a gap
    > 30 min starts a new pass. One orbit can cross California and then Italy about 25 min later, so
    passes must be grouped per area. Within one area a pass lasts a few minutes, and the same satellite
    returns no sooner than about 70 min later (both measured on the data and logged)."""
    pid = np.empty(len(df), np.int64); base = 0
    area = df.cell_id.str[:4]
    for _, idx in df.groupby([df.satellite, area]).indices.items():
        t = df.utc_min.values[idx]; order = np.argsort(t, kind="stable")
        new = np.r_[True, np.diff(t[order]) > PASS_GAP_MIN]
        p = np.cumsum(new) - 1 + base
        pid[idx[order]] = p; base = p.max() + 1
    return pid


def bowtie_dedup(df):
    """Within one pass, detection j duplicates a better detection i if their centres are closer than
    half the smallest pixel dimension of the two: d < 0.5 * min(scan_i, track_i, scan_j, track_j).
    Distinct pixels of one scan are at least one sample apart (>= min(scan, track)), so this never
    merges two genuinely different pixels. 'Better' = smaller scan angle, then larger FRP, then higher
    confidence, then SP over NRT; what is still tied (twins often repeat FRP) is ordered by latitude,
    longitude and time, a total order on distinct detections, so the result never depends on file order.
    Greedy suppression in that order keeps a set of mutually non-duplicate detections."""
    keep = np.ones(len(df), bool)
    for _, idx in df.groupby("pass_id").indices.items():
        if len(idx) < 2: continue
        sub = df.iloc[idx]
        xy = np.column_stack([sub.x_m.values, sub.y_m.values]) / 1000.0
        pmin = np.minimum(sub.scan.values, sub.track.values)
        pairs = cKDTree(xy).query_pairs(0.5 * pmin.max(), output_type="ndarray")
        if len(pairs) == 0: continue
        d = np.linalg.norm(xy[pairs[:, 0]] - xy[pairs[:, 1]], axis=1)
        thr = 0.5 * np.minimum(pmin[pairs[:, 0]], pmin[pairs[:, 1]])
        pairs = pairs[d < thr]
        if len(pairs) == 0: continue
        # best first: smallest angle, largest FRP, higher confidence, SP before NRT, then position and time
        order = np.lexsort((sub.utc_min.values, sub.longitude.values, sub.latitude.values,
                            (sub.data_version == "NRT").values.astype(int), -sub.conf_rank.values,
                            -sub.frp.values, sub.theta.values))
        rank = np.empty(len(idx), int); rank[order] = np.arange(len(idx))
        nbr = {}
        for a, b in pairs:
            nbr.setdefault(a, []).append(b); nbr.setdefault(b, []).append(a)
        alive = np.ones(len(idx), bool)
        for i in order:
            if not alive[i] or i not in nbr: continue
            for j in nbr[i]:
                if rank[j] > rank[i]: alive[j] = False
        keep[idx[~alive]] = False
    return keep


# ---------------------------------------------------------------- main
def run(in_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    log = {"steps": []}
    def step(name, n, note="", frame=None):
        by = {} if frame is None else frame[frame.satellite.isin(KEEP_SATS)].satellite.value_counts().to_dict()
        log["steps"].append({"step": name, "rows": int(n), "note": note, "by_satellite": by})
        print(f"{name:<44}{n:>10}  {note}")

    df, files = load(in_dir); log["files"] = files
    step("1 loaded (all satellites, SP + NRT)", len(df), frame=df)

    # 2. versions: per satellite and per FIRMS request, NRT only after the last SP date of that request
    sp = df[df.data_version == "SP"].groupby(["satellite", "request"]).acq_date.max()
    nrt0 = df[df.data_version == "NRT"].groupby(["satellite", "request"]).acq_date.min()
    log["sp_last_date"] = {f"{k[0]} {k[1]}": v for k, v in sp.items()}
    log["nrt_first_date"] = {f"{k[0]} {k[1]}": v for k, v in nrt0.items()}
    cut = pd.Series(list(zip(df.satellite, df.request))).map(sp).fillna("").values
    df = df[(df.data_version == "SP").values | (df.acq_date.values > cut)]
    step("2a NRT kept only after the last SP date", len(df), frame=df)
    df = df.drop_duplicates(["satellite", "latitude", "longitude", "acq_date", "acq_time"])
    step("2b exact duplicate records removed", len(df), frame=df)
    # 2c. a pass that crosses UTC midnight at the SP/NRT boundary is listed in both files (SP at 23:59, NRT
    #     at 00:01 the next day), so the date cut keeps both copies; drop the NRT copy
    tmin = (pd.to_datetime(df.acq_date).values.astype("datetime64[m]").astype(np.int64)
            + df.acq_time.str[:2].astype(int).values * 60 + df.acq_time.str[2:].astype(int).values)
    df = df.assign(_t=tmin)
    nrt = df[df.data_version == "NRT"].reset_index()
    rep = nrt.merge(df[df.data_version == "SP"][["satellite", "latitude", "longitude", "_t"]],
                    on=["satellite", "latitude", "longitude"], suffixes=("", "_sp"))
    rep = rep[(rep._t - rep._t_sp).abs() <= NRT_REPEAT_MIN]
    log["nrt_repeats_of_sp_by_satellite"] = rep.drop_duplicates("index").groupby("satellite").size().to_dict()
    df = df.drop(index=rep["index"].unique()).drop(columns="_t")
    step("2c NRT repeats of SP detections removed", len(df), frame=df)
    df = df[df.satellite.isin(KEEP_SATS + ("TERRA",))].reset_index(drop=True)   # Terra only feeds the mask

    # 3. region
    df["region"] = assign_region(df.longitude.values, df.latitude.values)
    df = df[df.region.notna()].reset_index(drop=True)
    step("3 inside the four regions (+3 nmi sea margin)", len(df), frame=df)
    raw = df[df.satellite.isin(KEEP_SATS)].assign(year=df.acq_date.str[:4])
    raw.groupby(["region", "satellite", "year"]).size().rename("raw_detections").reset_index().to_csv(
        os.path.join(out_dir, "raw_counts_by_year.csv"), index=False)
    raw[["region", "satellite", "acq_date", "latitude", "longitude", "frp", "confidence", "version"]].to_parquet(
        os.path.join(out_dir, "raw_in_regions.parquet"), index=False)
    del raw

    # 4. grid
    ids, clon, clat = cell_id(df.longitude.values, df.latitude.values, df.region.values)
    df["cell_id"], df["cell_lon"], df["cell_lat"] = ids, clon, clat
    from grid import _FWD
    df["x_m"] = np.nan; df["y_m"] = np.nan
    for e in (3035, 3310):
        m = df.cell_id.str.startswith(f"{e}_").values
        x, y = _FWD[e].transform(df.longitude.values[m], df.latitude.values[m])
        df.loc[m, "x_m"] = x; df.loc[m, "y_m"] = y

    # 5. heat sources (non-vegetation heat), three location rules plus each product's own flag:
    #  a) drop every detection its own product flags as type 1 (volcano), 2 (static land source) or 3 (offshore)
    #  b) static spots: 1 km squares of the shared grid where flagged detections (any satellite, incl. Terra,
    #     any confidence) occur in >= 6 distinct calendar months; drop EVERY detection of every satellite
    #     within 1 km of a static spot's centre (catches NRT rows, which carry no flag, and scatter around a source)
    #  c) the Etna and Stromboli boxes, for every satellite
    #  The agreed 5 km cell mask was tested and rejected: it removes 27-38% of the vegetation detections
    #  in mainland Italy, because many MODIS type-2 flags are one-off detections (see the cleaning note).
    flagged = df["type"].isin([1, 2, 3]).values
    df["spot"] = (df.cell_id.str.split("_").str[0] + "_" + np.floor(df.x_m / 1000).astype(np.int64).astype(str)
                  + "_" + np.floor(df.y_m / 1000).astype(np.int64).astype(str))
    fs = (df[flagged].assign(ym=df.acq_date.str[:7]).groupby("spot")
          .agg(months=("ym", "nunique"), x=("x_m", "mean"), y=("y_m", "mean"), epsg=("cell_id", lambda c: c.iloc[0][:4])))
    static = fs[fs.months >= STATIC_MIN_MONTHS]
    near = np.zeros(len(df), bool)
    for e in ("3035", "3310"):
        S = static[static.epsg == e]; m = df.cell_id.str.startswith(e + "_").values
        if len(S) and m.any():
            dist, _ = cKDTree(np.c_[S.x.values, S.y.values]).query(np.c_[df.x_m.values[m], df.y_m.values[m]])
            near[m] = dist <= STATIC_RADIUS_M
    in_box = np.zeros(len(df), bool)
    for b, (la0, la1, lo0, lo1) in BOXES.items():
        mb = df.latitude.between(la0, la1).values & df.longitude.between(lo0, lo1).values
        log[f"box_{b}_rows"] = int(mb.sum()); in_box |= mb
    log["static_spots"] = static.reset_index()[["spot", "months"]].to_dict("records")
    log["static_spot_count_by_epsg"] = static.epsg.value_counts().to_dict()
    sat_ok = df.satellite.isin(KEEP_SATS).values
    reason = np.where(flagged, "own_flag", np.where(near, "static_spot", np.where(in_box, "volcano_box", "")))
    log["heat_removed_by_reason_satellite"] = (pd.DataFrame({"r": reason, "s": df.satellite})[sat_ok & (reason != "")]
                                               .groupby(["r", "s"]).size().unstack(fill_value=0).to_dict())
    log["own_flag_outside_location_rules_by_satellite"] = df[sat_ok & flagged & ~near & ~in_box].groupby("satellite").size().to_dict()
    n_before = int(sat_ok.sum())
    df = df[sat_ok & ~flagged & ~near & ~in_box]
    assert not df["type"].isin([1, 2, 3]).any(), "a type 1/2/3 detection survived"
    df = df.drop(columns="spot").reset_index(drop=True)
    step("5 heat sources removed (flags, static spots, volcano boxes)", len(df),
         f"{len(static)} static spots, -{n_before - len(df)} rows", frame=df)

    # 6. confidence
    conf = df.confidence.str.lower()
    num = pd.to_numeric(conf, errors="coerce")
    is_mod = (df.sensor == "MODIS").values
    cls = np.where(is_mod, np.where(num >= MODIS_CONF_HIGH, "high", np.where(num >= MODIS_CONF_MIN, "nominal", "low")),
                   conf.str[0].map({"l": "low", "n": "nominal", "h": "high"}).values)
    if pd.isna(cls).any() or (is_mod & np.isnan(num.values)).any():
        raise ValueError(f"unreadable confidence values: {set(conf[pd.isna(cls)])}")
    df["conf"] = cls
    df = df[df.conf != "low"].reset_index(drop=True)
    df["conf_rank"] = (df.conf == "high").astype(int)
    step("6 low confidence removed", len(df), frame=df)

    # 7. time
    utc, local, sza = solar(df)
    # minutes since 1970 - computed from a Timedelta, so it does not depend on pandas' datetime resolution
    df["utc_min"] = ((utc - pd.Timestamp("1970-01-01", tz="UTC")) / pd.Timedelta(minutes=1)).values
    df["date_local"] = local.dt.strftime("%Y-%m-%d").values
    df["local_hour"] = (local.dt.hour + local.dt.minute / 60.0).values
    df["sza"] = sza
    df["daynight"] = np.where(sza < SZA_DAY_MAX, "D", "N")
    agree = (df.daynight == df.daynight_firms)
    log["daynight_agreement_with_firms"] = df.assign(a=agree).groupby("satellite").a.mean().round(5).to_dict()
    step("7 local solar date and day/night set", len(df), frame=df)

    # 8. scan angle and zone
    df["theta"] = np.nan; df["scan_zone"] = 0; df["fit_rmse_km"] = np.nan
    log["nadir_size_km_fitted"] = {}
    for sat, idx in df.groupby("satellite").indices.items():
        nadir = calibrate(sat, df.scan.values[idx], df.track.values[idx]) if len(idx) >= 1000 else None
        log["nadir_size_km_fitted"][sat] = None if nadir is None else {"scan": round(nadir[0], 4), "track": round(nadir[1], 4)}
        log.setdefault("nadir_size_km_fitted_exact", {})[sat] = None if nadir is None else [float(nadir[0]), float(nadir[1])]
        th, z, rm = scan_zone(sat, df.scan.values[idx], df.track.values[idx], nadir=nadir)
        df.loc[idx, "theta"] = th; df.loc[idx, "scan_zone"] = z; df.loc[idx, "fit_rmse_km"] = rm
    log["zone_fit_rmse_km_p99"] = df.groupby("satellite").fit_rmse_km.quantile(0.99).round(4).to_dict()
    log["zone_fit_rmse_km_max"] = df.groupby("satellite").fit_rmse_km.max().round(4).to_dict()

    # 9a. passes and bow-tie duplicates
    df["pass_id"] = pass_ids(df)
    ps = df.groupby(["satellite", "pass_id"]).utc_min.agg(["min", "max"]).reset_index()
    ps["area"] = df.groupby("pass_id").cell_id.first().str[:4].reindex(ps.pass_id).values
    ps = ps.sort_values(["satellite", "area", "min"])
    gap = ps.groupby(["satellite", "area"])["min"].shift(-1) - ps["max"]
    log["pass_span_max_min"] = (ps["max"] - ps["min"]).groupby(ps.satellite).max().to_dict()
    log["pass_gap_min_min"] = gap.dropna().groupby(ps.satellite).min().to_dict()
    assert max(log["pass_span_max_min"].values()) < PASS_GAP_MIN, "a pass lasts longer than the gap threshold"
    assert all(v > PASS_GAP_MIN for v in log["pass_gap_min_min"].values()), "two passes closer than the threshold"
    df[["satellite", "region", "pass_id", "utc_min", "x_m", "y_m", "scan", "track", "theta", "frp"]].to_parquet(
        os.path.join(out_dir, "before_dedup.parquet"), index=False)
    keep = bowtie_dedup(df)
    log["removed_bowtie_by_satellite"] = df[~keep].groupby("satellite").size().to_dict()
    df = df[keep].reset_index(drop=True)
    step("9a bow-tie duplicates removed", len(df), frame=df)

    # 9b. overlapping orbits: one pass per key, the one nearest track (smallest scan angle), then earliest
    best = (df.groupby(KEY + ["pass_id"]).agg(th=("theta", "min"), t=("utc_min", "min")).reset_index()
              .sort_values(KEY + ["th", "t"]).drop_duplicates(KEY))
    n_multi = int((df.groupby(KEY).pass_id.nunique() > 1).sum())
    df = df.merge(best[KEY + ["pass_id"]], on=KEY + ["pass_id"], how="inner")
    log["keys_seen_by_two_or_more_passes"] = n_multi
    step("9b second passes of the same day removed", len(df), f"{n_multi} cell-days had >1 pass", frame=df)

    # 10. collapse
    g = df.sort_values("theta").groupby(KEY, sort=True)
    out = g.agg(cell_lat=("cell_lat", "first"), cell_lon=("cell_lon", "first"), sensor=("sensor", "first"),
                scan_zone=("scan_zone", "first"), n_detections=("frp", "size"), frp_sum_mw=("frp", "sum"),
                frp_max_mw=("frp", "max"), conf_rank=("conf_rank", "max"),
                data_version=("data_version", "first"), n_versions=("data_version", "nunique")).reset_index()
    assert (out.n_versions == 1).all()
    out["conf_max"] = np.where(out.conf_rank == 1, "high", "nominal")
    out["cell_lat"] = out.cell_lat.round(5); out["cell_lon"] = out.cell_lon.round(5)
    out["frp_sum_mw"] = out.frp_sum_mw.round(2); out["frp_max_mw"] = out.frp_max_mw.round(2)
    out = out[OUT_COLS].sort_values(["region", "date_local", "satellite", "cell_id", "daynight"]).reset_index(drop=True)
    step("10 handover rows (cell x day x satellite x D/N)", len(out))

    df.to_parquet(os.path.join(out_dir, "detections_clean.parquet"), index=False)
    out.to_csv(os.path.join(out_dir, "cell_days.csv"), index=False)
    json.dump(log, open(os.path.join(out_dir, "cleaning_log.json"), "w"), indent=1, default=str)
    return out, df, log


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2])
