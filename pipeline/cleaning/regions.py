"""regions.py - the four region outlines and the point -> region rule.

Rule (same for every sensor):
  1. A point inside a region's land outline belongs to that region.
  2. A point at sea belongs to the nearest region if it lies within 3 nautical miles (5556 m) of that
     region's outline and is not on (or within 2 km of) a foreign country's land.
  3. Everything else is dropped.
Why the 3 nmi sea margin: a FIRMS location is the pixel centre, not the fire. A coastal fire's pixel
centre can sit offshore by up to the pixel's half-extent. The largest such distance in our data is a
MODIS edge pixel: sqrt(4.83^2 + (2.01/2)^2) = 4.93 km < 5.556 km (using the full along-scan width
because MODIS's along-scan response is triangular). So no land fire is lost, for either sensor.
A strict land clip would drop more MODIS than VIIRS coastal fires (bigger pixels), a sensor bias.
California's legal boundary (US Census TIGER 2010) already includes its 3 nmi of state waters, so
rule 2 is applied to Italy only, which makes the two areas follow the same definition.

Sources: Italy regions = ISTAT boundaries via openpolis/geojson-italy (saved as geo/italy_regions_istat.geojson);
California = US Census 2010 state boundary via jgoodall/us-maps; foreign land =
Natural Earth 10m admin-0. italy_mainland = all Italian regions except Sicilia and Sardegna
(so it includes small islands such as Elba and Capri)."""
import json, os
import numpy as np
import shapely
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from pyproj import Transformer

GEO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
MARGIN_M = 5556.0          # 3 nautical miles
FOREIGN_PAD_M = 2000.0     # keep the sea margin 2 km away from foreign land (border slivers)
REGIONS = ("italy_mainland", "sicily", "sardinia", "california")
EPSG = {"italy_mainland": 3035, "sicily": 3035, "sardinia": 3035, "california": 3310}


def _proj(geom, epsg):
    t = Transformer.from_crs(4326, epsg, always_xy=True)
    return shapely.transform(geom, lambda xy: np.column_stack(t.transform(xy[:, 0], xy[:, 1])))


def build():
    it = json.load(open(os.path.join(GEO, "italy_regions_istat.geojson")))
    g = {f["properties"]["reg_name"]: shape(f["geometry"]) for f in it["features"]}
    land = {
        "sicily": g["Sicilia"],
        "sardinia": g["Sardegna"],
        "italy_mainland": unary_union([v for k, v in g.items() if k not in ("Sicilia", "Sardegna")]),
    }
    us = json.load(open(os.path.join(GEO, "california_tiger2010.geojson")))
    land["california"] = shape([f for f in us["features"] if f["properties"]["STUSPS10"] == "CA"][0]["geometry"])
    ne = json.load(open(os.path.join(GEO, "foreign_land_ne10m.geojson")))
    foreign = unary_union([shape(f["geometry"]) for f in ne["features"] if f["properties"]["ADMIN"] in
                           ("France", "Monaco", "Switzerland", "Austria", "Slovenia", "Croatia", "San Marino",
                            "Vatican", "Malta", "Tunisia")])
    P = {r: shapely.make_valid(_proj(land[r], EPSG[r])) for r in REGIONS}
    foreign_p = shapely.make_valid(_proj(foreign, 3035)).buffer(FOREIGN_PAD_M)
    italy_land = unary_union([P[r] for r in ("italy_mainland", "sicily", "sardinia")])
    clip = {"california": P["california"]}
    for r in ("italy_mainland", "sicily", "sardinia"):
        clip[r] = P[r].buffer(MARGIN_M).difference(foreign_p).difference(
            italy_land.difference(P[r]))  # never claim another Italian region's land
    for r in REGIONS:
        shapely.prepare(P[r]); shapely.prepare(clip[r])
    return P, clip


_P, _CLIP = None, None


def assign_region(lon, lat):
    """Vectorised. Returns an object array of region names, None where the point is outside all regions."""
    global _P, _CLIP
    if _P is None:
        _P, _CLIP = build()
    lon = np.asarray(lon, float); lat = np.asarray(lat, float)
    out = np.full(lon.shape, None, dtype=object)
    xy = {}
    for e in (3035, 3310):
        t = Transformer.from_crs(4326, e, always_xy=True)
        xy[e] = t.transform(lon, lat)
    # rule 1: inside land
    for r in REGIONS:
        x, y = xy[EPSG[r]]
        m = (out == None) & shapely.contains_xy(_P[r], x, y)  # noqa: E711
        out[m] = r
    # rule 2: sea margin, nearest region wins (only Italian regions can compete with each other)
    rest = np.where(out == None)[0]  # noqa: E711
    if rest.size:
        cand = {}
        for r in REGIONS:
            x, y = xy[EPSG[r]]
            inside = shapely.contains_xy(_CLIP[r], x[rest], y[rest])
            d = np.full(rest.size, np.inf)
            if inside.any():
                pts = shapely.points(x[rest][inside], y[rest][inside])
                d[inside] = shapely.distance(_P[r], pts)
            cand[r] = d
        D = np.column_stack([cand[r] for r in REGIONS])
        best = D.argmin(axis=1); ok = np.isfinite(D.min(axis=1))
        out[rest[ok]] = np.array(REGIONS, dtype=object)[best[ok]]
    return out


def export_geojson(path):
    P, clip = build()
    feats = []
    for r in REGIONS:
        t = Transformer.from_crs(EPSG[r], 4326, always_xy=True)
        for kind, gg in (("land", P[r]), ("clip_extent", clip[r])):
            g4 = shapely.transform(gg, lambda xy: np.column_stack(t.transform(xy[:, 0], xy[:, 1])))
            feats.append({"type": "Feature", "properties": {"region": r, "kind": kind, "epsg": EPSG[r]},
                          "geometry": mapping(shapely.simplify(g4, 0.0005))})
    json.dump({"type": "FeatureCollection", "features": feats}, open(path, "w"))
