"""test_pipeline.py - end-to-end test on hand-made FIRMS-format files with a known answer.
Run: python3 test_pipeline.py      (prints PASS/FAIL per check, exits 1 on any failure)"""
import os, sys, tempfile, shutil
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from build_cell_days import run, KEY
from grid import cell_id
from geometry import model

MODIS_COLS = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type".split(",")
VIIRS_COLS = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type".split(",")


def px(sat, theta):
    s, t = model(sat, np.array([theta]))
    return round(float(s[0]), 1 if sat in ("AQUA", "TERRA") else 2), round(float(t[0]), 1 if sat in ("AQUA", "TERRA") else 2)


def m_row(lat, lon, date, time, conf, frp, typ, theta=10, sat="Aqua", version="6.1", dn="D"):
    s, t = px("AQUA", theta)
    return dict(latitude=lat, longitude=lon, brightness=330, scan=s, track=t, acq_date=date, acq_time=time,
                satellite=sat, instrument="MODIS", confidence=conf, version=version, bright_t31=300, frp=frp,
                daynight=dn, type=typ)


def v_row(lat, lon, date, time, conf, frp, theta=10, sat="SNPP", version="2", dn="D", typ=0):
    s, t = px("SNPP", theta)
    return dict(latitude=lat, longitude=lon, brightness=340, scan=s, track=t, acq_date=date, acq_time=time,
                satellite=sat, instrument="SNPP" if sat == "SNPP" else "VIIRS", confidence=conf, version=version, bright_t31=300, frp=frp,
                daynight=dn, type=typ)


def centre(lon, lat, region):
    _, clon, clat = cell_id(lon, lat, region)
    return float(clat[0]), float(clon[0])


def build_inputs(d):
    M, MN, V, VN, J = [], [], [], [], []
    sa_lat, sa_lon = centre(8.60, 40.10, "sardinia")        # all A/B points sit within 1.2 km of this cell centre
    si_lat, si_lon = centre(15.19, 37.16, "sicily")
    n2_lat, n2_lon = centre(13.95, 37.70, "sicily")
    ca_lat, ca_lon = centre(-121.62, 39.76, "california")
    oil_lat, oil_lon = centre(-119.40, 35.40, "california")
    # A. Sardinia, Montiferru 2021-07-24, Aqua day pass 12:35 UTC (local ~13:10): 3 good pixels 1.1 km apart
    for k in range(3):
        M.append(m_row(sa_lat, sa_lon + 0.013 * (k - 1), "2021-07-24", "1235", 85, 50 + k, 0))   # 1.1 km apart
    M.append(m_row(sa_lat + 0.009, sa_lon, "2021-07-24", "1235", 29, 99, 0))           # conf 29 -> dropped
    M.append(m_row(sa_lat, sa_lon - 0.013, "2021-07-24", "1235", 85, 50, 0))           # exact duplicate -> dropped
    # A'. same cell, later Aqua pass 14:15 UTC (overlapping orbit) at a bigger scan angle -> whole pass dropped
    M.append(m_row(sa_lat, sa_lon, "2021-07-24", "1415", 90, 300, 0, theta=50))
    # B. VIIRS S-NPP same place/day: 4 pixels + a bow-tie twin 0.05 km from pixel 0 (same pass) -> twin dropped
    for k in range(4):
        V.append(v_row(sa_lat, sa_lon + 0.005 * (k - 1.5), "2021-07-24", "1250", "n" if k else "h", 10 + k))
    V.append(v_row(sa_lat, sa_lon - 0.0075 + 0.0006, "2021-07-24", "1251", "n", 5, theta=12))   # 0.05 km from pixel 0
    V.append(v_row(sa_lat + 0.005, sa_lon, "2021-07-24", "1250", "l", 7))              # low -> dropped
    # C. Sicily refinery cell flagged by MODIS type 2 (Priolo ~37.16 N 15.19 E): all detections there dropped
    for mo in range(1, 7):                                                            # flagged in 6 months -> static spot
        V.append(v_row(si_lat, si_lon, f"2019-0{mo}-10", "0110", "n", 2, dn="N", typ=2))
    M.append(m_row(si_lat + 0.004, si_lon + 0.003, "2019-08-01", "1240", 70, 20, 0))  # type 0, 0.5 km away -> dropped
    V.append(v_row(si_lat - 0.003, si_lon + 0.004, "2023-07-25", "1220", "n", 9))      # NRT-like type 0, 0.5 km -> dropped
    M.append(m_row(si_lat + 0.018, si_lon, "2019-08-02", "1240", 70, 20, 0))         # same 5 km cell but 2 km away -> KEPT
    M.append(m_row(si_lat - 0.015, si_lon - 0.015, "2020-01-05", "1240", 70, 20, 2))  # one-off type 2 -> dropped (own flag) only
    # D. Etna summit (VIIRS and MODIS) -> dropped by box
    V.append(v_row(37.75, 15.00, "2023-07-25", "0005", "h", 40, dn="N"))
    M.append(m_row(37.75, 15.00, "2023-07-25", "0010", 90, 40, 0, dn="N"))
    # E. Sicily 2023-07-25 night, NOAA-20 at 23:40 UTC on 07-24 -> local solar 00:35 on 07-25 (lon 13.95)
    J.append(v_row(n2_lat, n2_lon - 0.004, "2023-07-24", "2340", "n", 12, sat="N20", dn="N", theta=40))
    J.append(v_row(n2_lat, n2_lon + 0.004, "2023-07-24", "2340", "n", 8, sat="N20", dn="N", theta=40))  # 0.7 km apart
    # F. California Camp fire 2018-11-08 (Paradise), S-NPP day 21:00 UTC (local ~12:54), negative x index
    for k in range(5):
        V.append(v_row(ca_lat, ca_lon + 0.006 * (k - 2), "2018-11-08", "2100", "h", 100 + k, theta=50))
    # G. outside every region: Corsica, Nevada, open sea
    V.append(v_row(41.9, 9.0, "2021-07-24", "1250", "h", 30))
    V.append(v_row(39.5, -119.8, "2018-11-08", "2100", "h", 30))
    M.append(m_row(39.0, 9.12, "2021-07-24", "1235", 90, 30, 0))
    # H. coastal fire whose pixel centre is 2 km offshore of Cagliari -> kept (sea margin)
    M.append(m_row(39.18, 9.12, "2021-08-01", "1235", 90, 30, 0))
    # I. SP / NRT overlap: Aqua SP ends 2024-12-21 (case K); NRT copy of 2021-08-01 dropped, NRT 2025-01-10 kept
    MN.append({k: v for k, v in m_row(39.1805, 9.1205, "2021-08-01", "1235", 90, 30, 0, version="6.1NRT").items() if k != "type"})  # NRT position differs slightly from SP
    MN.append({k: v for k, v in m_row(39.30, 9.20, "2025-01-10", "1235", 90, 30, 0, version="6.1NRT").items() if k != "type"})
    # J. Terra flags a static cell in California (oil field ~35.40 N 119.40 W); S-NPP there -> dropped
    for mo in range(1, 7):                                                            # Terra flags in 6 months
        M.append(m_row(oil_lat, oil_lon, f"2015-0{mo}-01", "1830", 80, 10, 2, sat="Terra"))
    V.append(v_row(oil_lat + 0.004, oil_lon - 0.004, "2020-06-01", "2100", "h", 10))   # S-NPP 0.6 km away -> dropped
    # K. Winter Aqua pass in Sardinia at local 16:50 in December -> sun below 85 deg zenith? (sza > 85 -> N)
    M.append(m_row(40.0, 9.0, "2024-12-21", "1615", 80, 10, 0, dn="D"))
    # L. full ties between bow-tie twins (same angle, same FRP - common in VIIRS): the 'n' twin is listed first,
    #    the 'h' twin must still win; a second pair tied on confidence too is settled by position, not file order
    V.append(v_row(40.60, 9.4000, "2022-07-10", "1240", "n", 6.5))
    V.append(v_row(40.60, 9.4006, "2022-07-10", "1240", "h", 6.5))                       # 0.05 km away
    V.append(v_row(40.8004, 9.60, "2022-07-10", "1240", "n", 4.2))
    V.append(v_row(40.8000, 9.60, "2022-07-10", "1240", "n", 4.2))                       # 0.04 km away
    # M. a NOAA-20 pass crossing UTC midnight at the SP/NRT boundary: SP lists it at 23:59 on 07-24, NRT again
    #    at 00:01 on 07-25 (same position); the date cut keeps both, rule 2c drops the NRT copy
    J.append(v_row(39.60, 8.70, "2023-07-24", "2359", "n", 3.3, sat="N20", dn="N", theta=20))
    JN = [{k: v for k, v in v_row(39.60, 8.70, "2023-07-25", "0001", "n", 3.3, sat="N20", version="2.0NRT",
                                  dn="N", theta=20).items() if k != "type"}]
    pd.DataFrame(M, columns=MODIS_COLS).to_csv(os.path.join(d, "fire_archive_M-C61_700001.csv"), index=False)
    pd.DataFrame(MN, columns=MODIS_COLS[:-1]).to_csv(os.path.join(d, "fire_nrt_M-C61_700001.csv"), index=False)
    pd.DataFrame(V, columns=VIIRS_COLS).to_csv(os.path.join(d, "fire_archive_SV-C2_700002.csv"), index=False)
    pd.DataFrame(J, columns=VIIRS_COLS).to_csv(os.path.join(d, "fire_archive_J1V-C2_700003.csv"), index=False)
    pd.DataFrame(JN, columns=VIIRS_COLS[:-1]).to_csv(os.path.join(d, "fire_nrt_J1V-C2_700003.csv"), index=False)


def side_tests(check):
    """2. solar position and local date, 4. region outlines, plus the exhaustive scan-zone check (P6)."""
    from build_cell_days import solar
    from regions import assign_region
    from geometry import scan_zone, zone_of_angle, EDGE_DEG, SENSOR
    rng = np.random.default_rng(1); n = 20000
    lat = rng.uniform(32, 47.5, n); lon = np.where(rng.random(n) < .5, rng.uniform(6, 19, n), rng.uniform(-124.5, -114, n))
    ts = pd.to_datetime(rng.integers(1025481600, 1794700800, n) // 60 * 60, unit="s", utc=True)
    df = pd.DataFrame({"acq_date": ts.strftime("%Y-%m-%d"), "acq_time": ts.strftime("%H%M"), "latitude": lat, "longitude": lon})
    utc, local, sza = solar(df)
    # independent approximate formula (NOAA general solar position) must agree within 0.6 deg
    doy = ts.dayofyear.values; hr = ts.hour.values + ts.minute.values / 60
    g = 2 * np.pi / 365 * (doy - 1 + (hr - 12) / 24)
    eot = 229.18 * (0.000075 + 0.001868 * np.cos(g) - 0.032077 * np.sin(g) - 0.014615 * np.cos(2 * g) - 0.040849 * np.sin(2 * g))
    dec = (0.006918 - 0.399912 * np.cos(g) + 0.070257 * np.sin(g) - 0.006758 * np.cos(2 * g) + 0.000907 * np.sin(2 * g)
           - 0.002697 * np.cos(3 * g) + 0.00148 * np.sin(3 * g))
    ha = np.radians((hr * 60 + eot + 4 * lon) / 4 - 180)
    z2 = np.degrees(np.arccos(np.sin(np.radians(lat)) * np.sin(dec) + np.cos(np.radians(lat)) * np.cos(dec) * np.cos(ha)))
    check("solar zenith (SPA) agrees with an independent formula within 0.6 deg", np.abs(sza - z2).max() < 0.6)
    ind = (ts + pd.to_timedelta(lon / 15, unit="h")).strftime("%Y-%m-%d")
    check("date_local equals an independent UTC + lon/15 calculation", (local.dt.strftime("%Y-%m-%d").values == np.asarray(ind)).all())
    pts = {"california": [(-121.62, 39.76)], "sardinia": [(8.58, 40.12), (9.12, 39.18)],
           "sicily": [(13.36, 38.12), (12.6, 35.51), (15.21, 38.79), (15.63, 38.25)],
           "italy_mainland": [(12.5, 41.9), (7.6, 43.77)],
           None: [(9.12, 39.0), (9.16, 41.39), (12.45, 43.94), (7.26, 43.70), (8.95, 46.00), (-119.81, 39.53),
                  (-117.03, 32.51), (14.45, 35.90)]}
    ok = True
    for reg, pp in pts.items():
        got = assign_region(np.array([p[0] for p in pp]), np.array([p[1] for p in pp]))
        ok &= all(g_ == reg for g_ in got)
    check("region outlines: 9 named places inside, 8 outside (Corsica, San Marino, Nice, Lugano, Reno, Tijuana, Malta, open sea)", ok)
    for sat, dec_ in (("SNPP", 2), ("AQUA", 1)):
        th = np.arange(0, EDGE_DEG[SENSOR[sat]], 0.005)
        from geometry import model
        S, T = model(sat, th)
        _, z, _ = scan_zone(sat, np.round(S, dec_), np.round(T, dec_))
        wrong = th[z != zone_of_angle(th)]
        if sat == "SNPP":
            check("P6 VIIRS: zone right for 100% of angles at 0.01 km precision", len(wrong) == 0)
        else:
            near = all(((31.6 - 0.65 < w < 31.6) or (44.7 - 0.36 < w < 44.7)) for w in wrong)
            check(f"P6 MODIS: zone wrong only within 0.65 deg below a boundary ({len(wrong)}/{len(th)} angles)", near)


def main():
    d = tempfile.mkdtemp(); o = os.path.join(d, "out"); build_inputs(d)
    out, det, log = run(d, o)
    fails = 0
    def check(name, ok):
        nonlocal fails; print(("PASS " if ok else "FAIL ") + name); fails += (not ok)
    side_tests(check)
    r = lambda **kw: out[np.logical_and.reduce([out[k] == v for k, v in kw.items()])]
    sard_cell = cell_id(8.60, 40.10, "sardinia")[0][0]
    a = r(region="sardinia", date_local="2021-07-24", satellite="AQUA")
    check("A Aqua Montiferru: one row, 3 detections, nadir pass kept, conf high, FRP 50+51+52",
          len(a) == 1 and a.n_detections.iloc[0] == 3 and a.frp_sum_mw.iloc[0] == 153 and a.conf_max.iloc[0] == "high"
          and a.scan_zone.iloc[0] == 1 and a.cell_id.iloc[0] == sard_cell)
    v = r(region="sardinia", date_local="2021-07-24", satellite="SNPP")
    check("B S-NPP Montiferru: bow-tie twin and low conf removed -> 4 detections, FRP sum 46, max 13",
          len(v) == 1 and v.n_detections.iloc[0] == 4 and v.frp_sum_mw.iloc[0] == 46 and v.frp_max_mw.iloc[0] == 13
          and v.conf_max.iloc[0] == "high")
    rc = out[out.cell_id == cell_id(15.19, 37.16, "sicily")[0][0]]
    check("C static spot (flagged in 6 months): detections within 1 km dropped for both sensors; a fire 2 km away "
          "in the same 5 km cell kept", len(rc) == 1 and rc.date_local.iloc[0] == "2019-08-02" and rc.n_detections.iloc[0] == 1)
    check("D Etna box removed", len(out[(out.cell_lat.between(37.7, 37.8)) & (out.cell_lon.between(14.95, 15.05))]) == 0)
    n20 = r(satellite="NOAA20", region="sicily")
    check("E NOAA-20 23:40 UTC on 07-24 at 13.95 E -> local date 2023-07-25, night, zone 2, 2 detections",
          len(n20) == 1 and n20.date_local.iloc[0] == "2023-07-25" and n20.daynight.iloc[0] == "N"
          and n20.scan_zone.iloc[0] == 2 and n20.n_detections.iloc[0] == 2)
    ca = r(region="california", date_local="2018-11-08")
    check("F Camp fire: california row, negative x index, zone 3, 5 detections",
          len(ca) == 1 and ca.cell_id.iloc[0].split("_")[1].startswith("-") and ca.scan_zone.iloc[0] == 3
          and ca.n_detections.iloc[0] == 5)
    check("G points in Corsica, Nevada and 20 km at sea dropped", len(out[out.region.isna()]) == 0
          and len(det[(det.latitude == 41.9) | (det.longitude == -119.8) | (det.latitude == 39.0)]) == 0)
    h = r(region="sardinia", date_local="2021-08-01")
    check("H coastal pixel centre 2 km offshore kept (SP)", len(h) == 1 and h.data_version.iloc[0] == "SP")
    n = r(date_local="2025-01-10")
    check("I NRT kept only after the last SP date", len(n) == 1 and n.data_version.iloc[0] == "NRT")
    check("J static spot flagged by Terra in 6 months removes S-NPP 0.6 km away in California",
          len(out[out.cell_id == cell_id(-119.40, 35.40, "california")[0][0]]) == 0)
    k = r(date_local="2024-12-21")
    check("K December Aqua pass at local 16:50 (sun below horizon threshold) recomputed as N",
          len(k) == 1 and k.daynight.iloc[0] == "N")
    check("A' later Aqua pass removed as an overlapping orbit (9b), not as a bow-tie (9a)",
          log["keys_seen_by_two_or_more_passes"] == 1 and log["removed_bowtie_by_satellite"] == {"SNPP": 3})
    check("passes: Aqua 12:35 and 14:15 on 2021-07-24 are different passes",
          det.pass_id.nunique() >= 1 and log["keys_seen_by_two_or_more_passes"] == 1)
    check("I' the NRT copy is removed by the version rule (2a), not as an exact duplicate",
          [x["rows"] for x in log["steps"]][1] == [x["rows"] for x in log["steps"]][0] - 1)
    l1 = r(date_local="2022-07-10", cell_id=cell_id(9.4006, 40.60, "sardinia")[0][0])       # the 'h' twin's cell
    l2 = r(date_local="2022-07-10", cell_id=cell_id(9.60, 40.80, "sardinia")[0][0])
    check("L full tie (angle, FRP): the high-confidence twin wins although listed second; tie on confidence too -> 1 kept",
          len(l1) == 1 and l1.n_detections.iloc[0] == 1 and l1.conf_max.iloc[0] == "high"
          and len(out[(out.date_local == "2022-07-10") & (out.cell_lat < 40.7)]) == 1
          and len(l2) == 1 and l2.n_detections.iloc[0] == 1)
    mm = r(satellite="NOAA20", region="sardinia")
    check("M pass across UTC midnight listed in SP and NRT: NRT copy removed by rule 2c, row is SP with 1 detection",
          log["nrt_repeats_of_sp_by_satellite"] == {"NOAA20": 1} and len(mm) == 1 and mm.n_detections.iloc[0] == 1
          and mm.data_version.iloc[0] == "SP" and mm.date_local.iloc[0] == "2023-07-25")
    check("unique key", not out.duplicated(KEY).any())
    # N. the table must not depend on the order of rows in the input files: reverse every file and rerun
    d2 = tempfile.mkdtemp()
    for f in os.listdir(d):
        if f.endswith(".csv"):
            pd.read_csv(os.path.join(d, f), dtype=str).iloc[::-1].to_csv(os.path.join(d2, f), index=False)
    out2, _, _ = run(d2, os.path.join(d2, "out"))
    check("N every input file reversed -> identical table (no dependence on file order)",
          out.reset_index(drop=True).equals(out2.reset_index(drop=True)))
    shutil.rmtree(d); shutil.rmtree(d2)
    print("ALL PASS" if fails == 0 else f"{fails} FAILED"); sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
