"""validate_raw_points.py - the RAW comparison set for validate_agreement.py and validate_maps.py:
every FIRMS point (all satellites, Terra included, SP and NRT) inside the four regions, with its 5 km cell
and projected x, y in metres. Nothing else is removed, so it shows the data before cleaning.
Usage: python3 validate_raw_points.py <folder with the FIRMS zips> <out parquet>"""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from build_cell_days import load           # noqa: E402
from regions import assign_region          # noqa: E402
from grid import cell_id, _FWD             # noqa: E402

df, _ = load(sys.argv[1])
df["region"] = assign_region(df.longitude.values, df.latitude.values)
df = df[df.region.notna()].reset_index(drop=True)
df["cell_id"], _, _ = cell_id(df.longitude.values, df.latitude.values, df.region.values)
df["x"] = np.nan; df["y"] = np.nan
for e in (3035, 3310):
    m = df.cell_id.str.startswith(f"{e}_").values
    df.loc[m, "x"], df.loc[m, "y"] = _FWD[e].transform(df.longitude.values[m], df.latitude.values[m])
df["month"] = df.acq_date.str[:7]
df.to_parquet(sys.argv[2], index=False)
print("raw points in the four regions:", len(df), df.satellite.value_counts().to_dict())
