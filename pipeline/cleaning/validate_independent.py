"""validate_independent.py - a SECOND, independent implementation of the agreed cleaning criteria.

It shares only the definitions with build_cell_days.py (region outlines, thresholds, constants),
never its code: no import from build_cell_days, grid, regions or geometry.
Where the main pipeline uses one method, this one uses another:
  data steps          pandas                          -> SQL in DuckDB
  coastal sea margin  polygon buffer containment      -> nearest-coastline-segment distance (STRtree of segments)
  static-spot radius  KD-tree                         -> 1 km spatial-hash join in SQL
  day / night         NREL SPA (pvlib)                -> NOAA textbook formula (ambiguous only if |z - 85| < 0.6 deg)
  scan zone           2-D least-squares fit           -> invert track for the angle, read the VIIRS merge factor from scan
  passes              numpy gaps                      -> SQL window function
  bow-tie pairs       KD-tree pairs                   -> 1 km spatial-hash self-join in SQL
Usage: python3 validate_independent.py <folder with FIRMS zips> <cell_days.csv to check> <out folder>
"""
import glob, json, math, os, sys, tempfile, zipfile
import numpy as np, pandas as pd, duckdb, shapely
from pyproj import Transformer

GEO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
R_E = 6378.137
ALT = {"AQUA": 705.0, "TERRA": 705.0, "SNPP": 824.0, "NOAA20": 824.0}
EDGE = {"MODIS": 55.0, "VIIRS": 56.28}
KEEP = ("AQUA", "SNPP", "NOAA20")


# ------------------------------------------------------------------ geometry by direct inversion
def g_t(theta, h):
    a = R_E + h; s = np.sin(np.radians(theta)); psi = np.arcsin(np.clip(a / R_E * s, -1, 1))
    rho = a * np.cos(np.radians(theta)) - R_E * np.cos(psi)
    return rho / h, rho / (h * np.cos(psi))


def invert(target, fn, lo, hi, iters=60):
    """Bisection for an increasing function fn on [lo, hi]."""
    lo = np.full(target.shape, lo, float); hi = np.full(target.shape, hi, float)
    for _ in range(iters):
        mid = (lo + hi) / 2; up = fn(mid) < target
        lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
    return (lo + hi) / 2


def zone_indep(sat, scan, track):
    """MODIS: angle from the scan size alone (monotonic), then the 31.6 / 44.7 deg boundaries.
    VIIRS: angle from track alone (no merging along track), then merge factor n = round(3 * scan / (S0 * g_s)),
    zone = 4 - n. Nominal nadir sizes are used on purpose (not the pipeline's fitted ones)."""
    h = ALT[sat]
    if sat in ("AQUA", "TERRA"):
        th = invert(np.maximum(scan, 1.0), lambda t: g_t(t, h)[1] * 1.0, 0.0, EDGE["MODIS"])
        return th, np.where(th < 31.6, 1, np.where(th < 44.7, 2, 3))
    th = invert(np.maximum(track / 0.375, 1.0), lambda t: g_t(t, h)[0], 0.0, EDGE["VIIRS"])
    n = np.clip(np.rint(3 * scan / (0.375 * g_t(th, h)[1])), 1, 3)
    return th, (4 - n).astype(int)


# ------------------------------------------------------------------ outlines, as segments
def load_outlines():
    it = json.load(open(os.path.join(GEO, "italy_regions_istat.geojson")))
    g = {f["properties"]["reg_name"]: shapely.geometry.shape(f["geometry"]) for f in it["features"]}
    land = {"sicily": g["Sicilia"], "sardinia": g["Sardegna"],
            "italy_mainland": shapely.union_all([v for k, v in g.items() if k not in ("Sicilia", "Sardegna")])}
    ca = json.load(open(os.path.join(GEO, "california_tiger2010.geojson")))
    land["california"] = shapely.geometry.shape(ca["features"][0]["geometry"])
    fo = json.load(open(os.path.join(GEO, "foreign_land_ne10m.geojson")))
    foreign = shapely.union_all([shapely.geometry.shape(f["geometry"]) for f in fo["features"]])
    def proj(geom, epsg):
        t = Transformer.from_crs(4326, epsg, always_xy=True)
        return shapely.make_valid(shapely.transform(geom, lambda xy: np.column_stack(t.transform(xy[:, 0], xy[:, 1]))))
    E = {"italy_mainland": 3035, "sicily": 3035, "sardinia": 3035, "california": 3310}
    P = {r: proj(land[r], E[r]) for r in land}
    return P, proj(foreign, 3035), E


def segments(geom):
    rings = shapely.get_rings(shapely.get_parts(geom))
    segs = []
    for ring in rings:
        c = shapely.get_coordinates(ring)
        segs.append(shapely.linestrings(np.stack([c[:-1], c[1:]], axis=1)))
    return np.concatenate(segs)


_OUT = None


def assign_regions(x35, y35, x33, y33, chunk=300_000):
    global _OUT
    if _OUT is None:
        P, foreign, E = load_outlines()
        trees = {r: shapely.STRtree(shapely.get_parts(P[r])) for r in P}
        segt = {r: shapely.STRtree(segments(P[r])) for r in ("italy_mainland", "sicily", "sardinia")}
        _OUT = (P, foreign, E, trees, segt, shapely.STRtree(shapely.get_parts(foreign)), shapely.STRtree(segments(foreign)))
    res = [_assign(x35[i:i + chunk], y35[i:i + chunk], x33[i:i + chunk], y33[i:i + chunk], *_OUT)
           for i in range(0, len(x35), chunk)]
    return np.concatenate([r[0] for r in res]), np.concatenate([r[1] for r in res])


def _assign(x35, y35, x33, y33, P, foreign, E, trees, segt, ftree, fseg):
    n = len(x35); out = np.full(n, None, object)
    pts = {3035: shapely.points(x35, y35), 3310: shapely.points(x33, y33)}
    # rule 1: inside a region's land (STRtree 'within' query over polygon parts)
    for r in ("italy_mainland", "sicily", "sardinia", "california"):
        idx = trees[r].query(pts[E[r]], predicate="within")[0]
        m = np.zeros(n, bool); m[idx] = True
        out[m & (out == None)] = r  # noqa: E711
    # rule 2 (Italy only): at sea, nearest region within 5556 m, not within 2000 m of foreign land
    rest = np.where(out == None)[0]  # noqa: E711
    p = pts[3035][rest]
    in_foreign = np.zeros(len(rest), bool); in_foreign[ftree.query(p, predicate="within")[0]] = True
    fi, fd = fseg.query_nearest(p, max_distance=2000.0, return_distance=True)
    near_foreign = np.zeros(len(rest), bool); near_foreign[fi[0]] = True
    best = np.full(len(rest), np.inf); who = np.full(len(rest), None, object)
    for r in ("italy_mainland", "sicily", "sardinia"):
        (qi, _), d = segt[r].query_nearest(p, max_distance=5556.0, return_distance=True)
        dd = np.full(len(rest), np.inf); np.minimum.at(dd, qi, d)
        better = dd < best; best[better] = dd[better]; who[better] = r
    ok = np.isfinite(best) & (best <= 5556.0) & ~in_foreign & ~near_foreign
    out[rest[ok]] = who[ok]
    return out, best


# ------------------------------------------------------------------ main
def main(in_dir, table_csv, out_dir):
    os.makedirs(out_dir, exist_ok=True); tmp = tempfile.mkdtemp()
    for z in sorted(glob.glob(os.path.join(in_dir, "*.zip"))):
        dst = os.path.join(tmp, os.path.basename(z)); os.makedirs(dst)
        with zipfile.ZipFile(z) as Z:
            for nme in Z.namelist():
                if nme.endswith(".csv"):
                    open(os.path.join(dst, os.path.basename(nme)), "wb").write(Z.read(nme))
    con = duckdb.connect(); con.execute("set memory_limit='2GB'; set threads=2")
    log = lambda *a: print(*a, flush=True)
    con.execute(f"""create table raw as select * from read_csv('{tmp}/*/*.csv', union_by_name=true, filename=true, all_varchar=true)""")
    con.execute("""
      create table r1 as select
        cast(latitude as double) lat, cast(longitude as double) lon, cast(scan as double) scan, cast(track as double) track,
        acq_date, lpad(acq_time, 4, '0') acq_time, cast(frp as double) frp, trim(confidence) conf_raw,
        try_cast(type as integer) typ, trim(version) version,
        case when upper(trim(satellite)) in ('AQUA','A') then 'AQUA' when upper(trim(satellite)) in ('TERRA','T') then 'TERRA'
             when upper(trim(satellite)) in ('N','SNPP','NPP') then 'SNPP' when upper(trim(satellite)) in ('N20','1','J1','NOAA-20') then 'NOAA20' end sat,
        case when filename like '%M-C61%' then 'MODIS' else 'VIIRS' end sensor,
        case when upper(version) like '%NRT%' then 'NRT' else 'SP' end dv,
        regexp_extract(filename, '([^/]+\\.zip)', 1) request
      from raw""")
    nraw = con.execute("select count(*), count(*) filter (where sat is null) from r1").fetchone()
    # versions per satellite and request, then exact duplicates
    con.execute("""
      create table r2 as with spend as (select sat, request, max(acq_date) e from r1 where dv='SP' group by all)
      select r1.* from r1 left join spend using (sat, request) where dv='SP' or e is null or acq_date > e""")
    con.execute("""create table r3 as select * exclude (rn) from (select *, row_number() over
                   (partition by sat, lat, lon, acq_date, acq_time order by dv = 'NRT', request) rn from r2) where rn = 1""")
    # an NRT row that repeats an SP row (same satellite and position, within 10 min): a pass across UTC midnight
    con.execute("""create table r4 as select * from r3 n where not (dv = 'NRT' and exists (select 1 from r3 s
                   where s.dv = 'SP' and s.sat = n.sat and s.lat = n.lat and s.lon = n.lon
                   and abs(epoch(strptime(s.acq_date || s.acq_time, '%Y-%m-%d%H%M')) - epoch(strptime(n.acq_date || n.acq_time, '%Y-%m-%d%H%M'))) <= 600))""")
    nrep = con.execute("select (select count(*) from r3) - (select count(*) from r4)").fetchone()[0]
    con.execute("drop table raw; drop table r1; drop table r2; drop table r3")
    df = con.execute("select * from r4").df(); con.execute("drop table r4"); log("loaded", len(df), "nrt repeats", nrep)
    # regions and projected coordinates
    t35 = Transformer.from_crs(4326, 3035, always_xy=True); t33 = Transformer.from_crs(4326, 3310, always_xy=True)
    x35, y35 = t35.transform(df.lon.values, df.lat.values); x33, y33 = t33.transform(df.lon.values, df.lat.values)
    df["region"], dist = assign_regions(x35, y35, x33, y33)
    df = df[df.region.notna()].copy(); log("in regions", len(df))
    ca = (df.region == "california").values
    df["x"] = np.where(ca, np.asarray(x33)[df.index], np.asarray(x35)[df.index])
    df["y"] = np.where(ca, np.asarray(y33)[df.index], np.asarray(y35)[df.index])
    df["epsg"] = np.where(ca, 3310, 3035)
    df["cell_id"] = (df.epsg.astype(str) + "_" + np.floor_divide(df.x, 5000).astype(np.int64).astype(str) + "_"
                     + np.floor_divide(df.y, 5000).astype(np.int64).astype(str))
    df["sx"] = np.floor_divide(df.x, 1000).astype(np.int64); df["sy"] = np.floor_divide(df.y, 1000).astype(np.int64)
    df = df.drop(columns=["conf_raw"]).assign(conf_raw=df.conf_raw) if False else df
    con.register("d0", df.reset_index(drop=True))
    con.execute("create table d1 as select row_number() over () - 1 id, * from d0"); con.unregister("d0")
    del df, x35, y35, x33, y33
    # heat sources in SQL: own flag, static spots (>= 6 flagged months) within 1 km (hash join), volcano boxes
    con.execute("""
      create table spots as select epsg, sx, sy, avg(x) cx, avg(y) cy from d1 where typ in (1,2,3)
      group by epsg, sx, sy having count(distinct substr(acq_date,1,7)) >= 6""")
    con.execute("""
      create table near_spot as select distinct d.id from d1 d join spots s on d.epsg = s.epsg
        and s.sx between d.sx - 2 and d.sx + 2 and s.sy between d.sy - 2 and d.sy + 2
      where (d.x - s.cx)*(d.x - s.cx) + (d.y - s.cy)*(d.y - s.cy) <= 1000.0*1000.0""")
    con.execute("""
      create table d2 as select d1.* from d1 left join near_spot n using (id)
      where sat in ('AQUA','SNPP','NOAA20') and coalesce(typ,0) not in (1,2,3) and n.id is null
        and not (lat between 37.67 and 37.83 and lon between 14.89 and 15.11)
        and not (lat between 38.76 and 38.83 and lon between 15.17 and 15.26)""")
    # confidence
    con.execute("""
      create table d3 as select *, case when sensor='MODIS' then (case when cast(conf_raw as double) >= 80 then 'high'
        when cast(conf_raw as double) >= 30 then 'nominal' else 'low' end)
        else (case lower(substr(conf_raw,1,1)) when 'h' then 'high' when 'n' then 'nominal' when 'l' then 'low' end) end conf
      from d2""")
    con.execute("delete from d3 where conf = 'low'")
    d = con.execute("select * from d3").df(); log("after heat and confidence", len(d))
    con.execute("drop table d1; drop table d2; drop table d3")
    # time: UTC minutes, local mean solar date, NOAA solar zenith
    utc = pd.to_datetime(d.acq_date + " " + d.acq_time.str[:2] + ":" + d.acq_time.str[2:], utc=True)
    d["tmin"] = ((utc - pd.Timestamp("1970-01-01", tz="UTC")) // pd.Timedelta(minutes=1)).astype(np.int64)
    d["date_local"] = (utc + pd.to_timedelta(d.lon * 240.0, unit="s")).dt.strftime("%Y-%m-%d")
    doy = utc.dt.dayofyear.values; hr = (utc.dt.hour + utc.dt.minute / 60).values
    gm = 2 * np.pi / 365 * (doy - 1 + (hr - 12) / 24)
    eot = 229.18 * (0.000075 + 0.001868 * np.cos(gm) - 0.032077 * np.sin(gm) - 0.014615 * np.cos(2 * gm) - 0.040849 * np.sin(2 * gm))
    dec = (0.006918 - 0.399912 * np.cos(gm) + 0.070257 * np.sin(gm) - 0.006758 * np.cos(2 * gm) + 0.000907 * np.sin(2 * gm)
           - 0.002697 * np.cos(3 * gm) + 0.00148 * np.sin(3 * gm))
    ha = np.radians((hr * 60 + eot + 4 * d.lon.values) / 4 - 180)
    la = np.radians(d.lat.values)
    z = np.degrees(np.arccos(np.clip(np.sin(la) * np.sin(dec) + np.cos(la) * np.cos(dec) * np.cos(ha), -1, 1)))
    d["daynight"] = np.where(z < 85, "D", "N"); d["z_ambiguous"] = np.abs(z - 85) < 0.6
    # scan zone by inversion
    d["theta"] = np.nan; d["zone"] = 0
    use_pipe = os.environ.get("THETA_FROM_PIPELINE") == "1"      # experiment: swap in the main pipeline's angle only
    if use_pipe:
        import geometry as _G
        L = json.load(open(os.environ["PIPELINE_LOG"]))
        nad = L.get("nadir_size_km_fitted_exact") or {k: (None if v is None else [v["scan"], v["track"]])
                                                     for k, v in L["nadir_size_km_fitted"].items()}
    for s, idx in d.groupby("sat").indices.items():
        if use_pipe:
            nz = nad.get(s); nadir = None if nz is None else (nz[0], nz[1])
            th, zz, _ = _G.scan_zone(s, d.scan.values[idx], d.track.values[idx], nadir=nadir)
        else:
            th, zz = zone_indep(s, d.scan.values[idx], d.track.values[idx])
        d.loc[d.index[idx], "theta"] = th; d.loc[d.index[idx], "zone"] = zz
    d["area"] = d.epsg
    con.register("e0", d)
    # passes: SQL window, gap > 30 min per satellite and area
    con.execute("""create table e1 as select *, sum(newp) over (partition by sat, area order by tmin, id rows unbounded preceding) pnum
                   from (select *, case when tmin - lag(tmin) over (partition by sat, area order by tmin, id) > 30 then 1 else 0 end newp from e0)""")
    con.execute("create table e2 as select *, sat || '_' || area || '_' || pnum pass from e1")
    span = con.execute("""select sat, max(mx-mn) span, min(gap) gap from (select sat, area, pnum, min(tmin) mn, max(tmin) mx,
        lead(min(tmin)) over (partition by sat, area order by pnum) - max(tmin) gap from e2 group by sat, area, pnum) group by sat""").df()
    # bow-tie pairs: 1 km hash self-join within a pass
    con.execute("create table e3 as select *, cast(floor(x/1000) as bigint) hx, cast(floor(y/1000) as bigint) hy from e2")
    pairs = con.execute("""select a.id i, b.id j from e3 a join e3 b on a.pass = b.pass and a.id < b.id
        and b.hx between a.hx - 1 and a.hx + 1 and b.hy between a.hy - 1 and a.hy + 1
        where sqrt((a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y)) / 1000.0
              < 0.5 * least(a.scan, a.track, b.scan, b.track)""").df()
    log("bow-tie pairs", len(pairs))
    e = con.execute("select * from e3").df()
    # better = smaller angle, larger FRP, high confidence, SP; remaining ties by latitude, longitude, time
    e["_hi"] = (e.conf == "high").astype(int); e["_nrt"] = (e.dv == "NRT").astype(int)
    rank = e.sort_values(["theta", "frp", "_hi", "_nrt", "lat", "lon", "tmin"],
                         ascending=[True, False, False, True, True, True, True], kind="mergesort").id.values
    pos = dict(zip(rank.tolist(), range(len(rank))))
    nb = {}
    for i, j in zip(pairs.i.values, pairs.j.values):
        nb.setdefault(i, []).append(j); nb.setdefault(j, []).append(i)
    dead = set()
    for i in rank.tolist():
        if i in dead or i not in nb: continue
        for j in nb[i]:
            if pos[j] > pos[i]: dead.add(j)
    e = e[~e.id.isin(dead)]
    con.register("f0", e.reset_index(drop=True))
    # one pass per key (smallest angle, then earliest) and collapse
    con.execute("""create table f1 as with pk as (select region, cell_id, date_local, sat, daynight, pass, min(theta) th, min(tmin) t
                   from f0 group by all), best as (select * from (select *, row_number() over (partition by region, cell_id, date_local, sat, daynight
                   order by th, t) rn from pk) where rn = 1)
                   select f0.* from f0 join best using (region, cell_id, date_local, sat, daynight, pass)""")
    mine = con.execute("""select region, cell_id, date_local, sat satellite, daynight,
        arg_min(zone, theta) scan_zone, count(*) n_detections, round(sum(frp), 2) frp_sum_mw, round(max(frp), 2) frp_max_mw,
        case when max(case when conf='high' then 1 else 0 end) = 1 then 'high' else 'nominal' end conf_max,
        min(dv) data_version, count(distinct dv) nv, max(z_ambiguous::int) amb from f1 group by all""").df()
    # ------------------------------------------------------------ compare with the delivered table
    t = pd.read_csv(table_csv, dtype={"cell_id": str, "date_local": str})
    key = ["region", "cell_id", "date_local", "satellite", "daynight"]
    m = t.merge(mine, on=key, how="outer", suffixes=("", "_i"), indicator=True)
    res = {"raw_rows": int(nraw[0]), "raw_rows_unknown_satellite": int(nraw[1]), "nrt_repeats_of_sp": int(nrep),
           "rows_delivered": len(t), "rows_independent": len(mine),
           "only_in_delivered": int((m._merge == "left_only").sum()), "only_in_independent": int((m._merge == "right_only").sum()),
           "pass_span_and_gap_min": span.to_dict("records"), "bowtie_pairs": len(pairs), "bowtie_removed": len(dead),
           "rows_with_ambiguous_daynight": int(mine.amb.sum()), "rows_with_two_versions": int((mine.nv > 1).sum())}
    both = m[m._merge == "both"]
    for c in ("n_detections", "frp_sum_mw", "frp_max_mw", "conf_max", "data_version", "scan_zone"):
        eq = np.isclose(both[c], both[c + "_i"]) if both[c].dtype.kind in "fi" else (both[c] == both[c + "_i"])
        res[f"match_{c}"] = float(np.mean(eq)); res[f"mismatch_{c}"] = int((~np.asarray(eq)).sum())
    m.to_parquet(os.path.join(out_dir, "independent_vs_delivered.parquet"), index=False)
    json.dump(res, open(os.path.join(out_dir, "independent_check.json"), "w"), indent=1, default=str)
    print(json.dumps(res, indent=1, default=str))


if __name__ == "__main__":
    main(*sys.argv[1:4])
