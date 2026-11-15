"""geometry.py - scan angle and scan_zone from FIRMS pixel size (scan, track).

Spherical Earth, R = 6378.137 km. For a scan angle theta at the satellite (altitude h):
    sin(psi) = (R + h)/R * sin(theta)                 psi = local zenith angle on the ground
    rho      = (R + h) cos(theta) - R cos(psi)         slant range
    g_t      = rho / h                                 along-track growth (pixel length / nadir length)
    g_s      = rho / (h cos(psi))                      along-scan growth
MODIS (no aggregation):   track = T0 * g_t(theta),  scan = S0 * g_s(theta)
VIIRS I-band (aggregates n = 3, 2, 1 native samples across the scan in zones 1, 2, 3):
                          track = T0 * g_t(theta),  scan = S0 * (n(theta)/3) * g_s(theta)
VIIRS's scan width is NOT monotonic in theta (it drops at each zone switch), so the scan column alone
cannot give the zone. The pair (scan, track) can: we take the theta whose predicted (scan, track) is
closest to the reported pair. For VIIRS the zone is then the aggregation zone the pair belongs to,
which is observable in the data and does not depend on the zone-boundary angles.
"""
import numpy as np

R = 6378.137
ALT_KM = {"AQUA": 705.0, "TERRA": 705.0, "SNPP": 824.0, "NOAA20": 824.0}
SENSOR = {"AQUA": "MODIS", "TERRA": "MODIS", "SNPP": "VIIRS", "NOAA20": "VIIRS"}
NADIR_KM = {"MODIS": (1.0, 1.0), "VIIRS": (0.375, 0.375)}      # (along-scan S0, along-track T0)
EDGE_DEG = {"MODIS": 55.0, "VIIRS": 56.28}
ZONE_DEG = (31.6, 44.7)                                         # template boundaries (deg)


def growth(theta_deg, h):
    th = np.radians(theta_deg); a = R + h
    psi = np.arcsin(np.clip(a / R * np.sin(th), -1, 1))
    rho = a * np.cos(th) - R * np.cos(psi)
    return rho / h, rho / (h * np.cos(psi))                    # g_t, g_s


def zone_of_angle(theta_deg):
    t = np.asarray(theta_deg)
    return np.where(t < ZONE_DEG[0], 1, np.where(t < ZONE_DEG[1], 2, 3)).astype(np.int16)


def viirs_n(theta_deg):
    return np.where(np.asarray(theta_deg) < ZONE_DEG[0], 3, np.where(np.asarray(theta_deg) < ZONE_DEG[1], 2, 1))


def model(satellite, theta_deg, zone_deg=ZONE_DEG, nadir=None):
    """Predicted (scan_km, track_km) for an array of angles. nadir = (S0, T0) overrides the nominal sizes."""
    sen = SENSOR[satellite]; S0, T0 = nadir if nadir is not None else NADIR_KM[sen]
    gt, gs = growth(theta_deg, ALT_KM[satellite])
    if sen == "MODIS":
        return S0 * gs, T0 * gt
    t = np.asarray(theta_deg)
    n = np.where(t < zone_deg[0], 3, np.where(t < zone_deg[1], 2, 1))
    return S0 * n / 3.0 * gs, T0 * gt


def fit_angle(satellite, scan, track, step=0.01, zone_deg=ZONE_DEG, nadir=None):
    """theta-hat (deg) = argmin over theta of (scan - S(theta))^2 + (track - T(theta))^2.
    Works on unique (scan, track) pairs, so it is fast on millions of rows.
    Returns theta_hat and, for VIIRS, the aggregation zone of the best fit."""
    sen = SENSOR[satellite]
    grid = np.arange(0.0, EDGE_DEG[sen] + step / 2, step)
    Sg, Tg = model(satellite, grid, zone_deg, nadir)
    pairs, inv = np.unique(np.column_stack([np.asarray(scan, float), np.asarray(track, float)]), axis=0,
                           return_inverse=True)
    err = (pairs[:, :1] - Sg[None, :]) ** 2 + (pairs[:, 1:] - Tg[None, :]) ** 2
    k = err.argmin(axis=1)
    theta = grid[k][inv.ravel()]
    rmse = np.sqrt(err[np.arange(len(k)), k] / 2)[inv.ravel()]
    return theta, rmse


def calibrate(satellite, scan, track):
    """Least-squares nadir sizes (S0, T0) for this satellite's FIRMS files: grid search, every detection
    weighted equally. FIRMS's VIIRS nadir pixel is about 0.36 km, a little below the nominal 0.375 km."""
    sen = SENSOR[satellite]; S0n, T0n = NADIR_KM[sen]
    pairs, cnt = np.unique(np.column_stack([scan, track]), axis=0, return_counts=True)
    best = None
    for S0 in np.linspace(0.9 * S0n, 1.1 * S0n, 41):
        for T0 in np.linspace(0.9 * T0n, 1.1 * T0n, 41):
            _, rm = fit_angle(satellite, pairs[:, 0], pairs[:, 1], step=0.05, nadir=(S0, T0))
            sse = float(np.sum(cnt * rm ** 2))
            if best is None or sse < best[0]:
                best = (sse, S0, T0)
    return best[1], best[2]


def scan_zone(satellite, scan, track, nadir=None):
    theta, rmse = fit_angle(satellite, scan, track, nadir=nadir)
    return theta, zone_of_angle(theta), rmse
