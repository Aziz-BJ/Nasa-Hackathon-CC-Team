"""grid.py - the ONE shared 5 km grid used for every sensor (MODIS and VIIRS).

cell_id = "{epsg}_{x_index}_{y_index}",  x_index = floor(x / 5000),  y_index = floor(y / 5000)
  Italy (italy_mainland, sicily, sardinia): EPSG:3035  (ETRS89 / LAEA Europe, equal-area)
  California:                               EPSG:3310  (NAD83 / California Albers, equal-area)

Why it is safe:
  * floor (not int()) makes each cell the half-open square [5000 i, 5000 (i+1)) x [5000 j, 5000 (j+1)).
    These squares partition the plane, so every point gets exactly one cell. int() truncates toward
    zero and would merge cells -1 and 0 into one 10 km cell; California has negative x, so this matters.
  * Both projections are equal-area, so every cell covers the same 25 km2 of ground whatever its latitude.
  * always_xy=True fixes the axis order to (lon, lat); EPSG:4326's official order is (lat, lon).
"""
import numpy as np
from pyproj import Transformer

CELL_M = 5000.0
EPSG = {"italy_mainland": 3035, "sicily": 3035, "sardinia": 3035, "california": 3310}
_FWD = {e: Transformer.from_crs(4326, e, always_xy=True) for e in (3035, 3310)}
_INV = {e: Transformer.from_crs(e, 4326, always_xy=True) for e in (3035, 3310)}


def cell_index(lon, lat, epsg):
    """Integer cell indices (x_index, y_index) for arrays of lon/lat in WGS84 degrees."""
    x, y = _FWD[epsg].transform(np.asarray(lon, float), np.asarray(lat, float))
    return np.floor(np.asarray(x) / CELL_M).astype(np.int64), np.floor(np.asarray(y) / CELL_M).astype(np.int64)


def cell_centre(ix, iy, epsg):
    """WGS84 (lon, lat) of the centre of cell (ix, iy)."""
    lon, lat = _INV[epsg].transform((np.asarray(ix) + 0.5) * CELL_M, (np.asarray(iy) + 0.5) * CELL_M)
    return np.asarray(lon), np.asarray(lat)


def cell_id(lon, lat, region):
    """Vectorised: region (str or array of str) -> array of cell_id strings, plus centre lon/lat."""
    lon = np.atleast_1d(np.asarray(lon, float)); lat = np.atleast_1d(np.asarray(lat, float))
    reg = np.broadcast_to(np.asarray(region, dtype=object), lon.shape)
    ids = np.empty(lon.shape, dtype=object); clon = np.full(lon.shape, np.nan); clat = np.full(lon.shape, np.nan)
    for e in (3035, 3310):
        m = np.array([EPSG[r] == e for r in reg], bool)
        if not m.any():
            continue
        ix, iy = cell_index(lon[m], lat[m], e)
        ids[m] = [f"{e}_{a}_{b}" for a, b in zip(ix, iy)]
        clon[m], clat[m] = cell_centre(ix, iy, e)
    return ids, clon, clat
