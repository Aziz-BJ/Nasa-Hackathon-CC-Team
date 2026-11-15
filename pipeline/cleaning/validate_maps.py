"""validate_maps.py - maps of S-NPP detections before and after cleaning, Italy and California.
Usage: python3 validate_maps.py <raw parquet with x, y, cell_id, type> <detections_clean.parquet> <cleaning_log.json> <out folder>"""
import json, os, sys
import numpy as np, pandas as pd, shapely, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
from pyproj import Transformer

raw_p, clean_p, log_p, out = sys.argv[1:5]
GEO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
raw = pd.read_parquet(raw_p, columns=["satellite", "region", "x", "y", "cell_id", "type", "acq_date"])
cl = pd.read_parquet(clean_p, columns=["satellite", "region", "x_m", "y_m"])
L = json.load(open(log_p))
spots = pd.DataFrame(L["static_spots"])
spots["e"] = spots.spot.str[:4]; spots["sx"] = spots.spot.str.split("_").str[1].astype(int); spots["sy"] = spots.spot.str.split("_").str[2].astype(int)


def outline(epsg, which):
    if epsg == 3035:
        it = json.load(open(os.path.join(GEO, "italy_regions_istat.geojson")))
        g = shapely.union_all([shapely.geometry.shape(f["geometry"]) for f in it["features"]])
    else:
        g = shapely.geometry.shape(json.load(open(os.path.join(GEO, "california_tiger2010.geojson")))["features"][0]["geometry"])
    t = Transformer.from_crs(4326, epsg, always_xy=True)
    return shapely.transform(g, lambda xy: np.column_stack(t.transform(xy[:, 0], xy[:, 1])))


def draw(ax, geom):
    for poly in shapely.get_parts(geom):
        c = np.asarray(poly.exterior.coords); ax.plot(c[:, 0] / 1000, c[:, 1] / 1000, lw=0.4, color="#555")


plt.rcParams.update({"font.size": 9, "font.family": "DejaVu Sans"})
fig, axes = plt.subplots(2, 2, figsize=(10, 11), gridspec_kw={"height_ratios": [1.15, 1], "hspace": 0.12, "wspace": 0.02})
panels = []
for row, (epsg, regs, title) in enumerate(((3035, ["italy_mainland", "sicily", "sardinia"], "Italy"), (3310, ["california"], "California"))):
    g = outline(epsg, title)
    xmin, ymin, xmax, ymax = [v / 1000 for v in g.bounds]
    bins = [np.arange(xmin - 10, xmax + 10, 5), np.arange(ymin - 10, ymax + 10, 5)]
    r = raw[(raw.satellite == "SNPP") & raw.region.isin(regs)]
    c = cl[(cl.satellite == "SNPP") & cl.region.isin(regs)]
    H1, _, _ = np.histogram2d(r.x / 1000, r.y / 1000, bins=bins); H2, _, _ = np.histogram2d(c.x_m / 1000, c.y_m / 1000, bins=bins)
    panels.append((row, epsg, title, g, bins, H1, H2, len(r), len(c)))
vmax = max(max(p[5].max(), p[6].max()) for p in panels)                  # one colour scale for all four maps
for row, epsg, title, g, bins, H1, H2, n1, n2 in panels:
    for col, (H, lab, n) in enumerate(((H1, "raw FIRMS points", n1), (H2, "after cleaning", n2))):
        ax = axes[row, col]
        im = ax.pcolormesh(bins[0], bins[1], np.ma.masked_equal(H, 0).T, norm=LogNorm(1, vmax), cmap="magma_r", shading="flat")
        draw(ax, g)
        if col == 0:
            sp = spots[spots.e == str(epsg)]
            ax.scatter((sp.sx + 0.5), (sp.sy + 0.5), s=9, facecolors="none", edgecolors="#1f6fd1", lw=0.7,
                       label=f"static heat source, 1 km spot ({len(sp)})")
            ax.legend(loc="upper right" if epsg == 3035 else "lower left", frameon=False, fontsize=8)
        ax.set_title(f"{title}, S-NPP, {lab}\n{n:,} detections", fontsize=10, loc="left")
        ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
        for s_ in ax.spines.values(): s_.set_visible(False)
cb = fig.colorbar(im, ax=axes, orientation="horizontal", shrink=0.55, pad=0.03, aspect=40,
                  label="S-NPP detections per 5 km cell, 2012-2026 (log scale)")
fig.suptitle("Cleaning removes the fixed industrial and volcanic hot spots and keeps the wildfire pattern",
             x=0.12, y=0.985, ha="left", fontsize=12, fontweight="bold")
fig.savefig(os.path.join(out, "maps_snpp_raw_vs_clean.png"), dpi=130, bbox_inches="tight")
print("saved")
