# Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
"""Write pipeline output in the format the Hotspot Calendar app reads (docs/DATA_CONTRACT.md, schema_version 1).

This only formats data. It does not compute or change any numbers: the harmonized values come from Pierre's method.

Usage (from the pipeline):
    from write_app_data import write_dataset
    write_dataset('demo/public/data/firms-v1', manifest, records, reported=None)

`records` is an iterable of dicts, one per grid cell per month that has any value:
    {'cell_id': '512_712', 'year': 2019, 'month': 8,
     'harmonized': 40.2, 'harmonized_low': 33.0, 'harmonized_high': 47.5,   # low/high optional, but all-or-none
     'modis': 12, 'viirs_snpp': 41, 'viirs_noaa20': 39}
Months a cell is missing are written as 0 where the series was operating and null where it was not (from the
manifest's sensor spans), so the app can tell "no hotspots" from "no sensor".
"""
import json
import math
import os
from collections import defaultdict

SERIES = ['harmonized', 'harmonized_low', 'harmonized_high', 'modis', 'viirs_snpp', 'viirs_noaa20']


def months_between(first, last):
    """Inclusive list of 'YYYY-MM' strings."""
    y, m = map(int, first.split('-'))
    y1, m1 = map(int, last.split('-'))
    out = []
    while (y, m) <= (y1, m1):
        out.append(f'{y}-{m:02d}')
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def cell_centre(cell_id, grid_deg):
    row, col = map(int, cell_id.split('_'))
    return (row + 0.5) * grid_deg - 90, (col + 0.5) * grid_deg - 180


def grid_id(lat, lon, deg):
    """row_col id on a grid of `deg` degrees (same rule for cells and tiles)."""
    rows, cols = round(180 / deg), round(360 / deg)
    return f'{min(math.floor((lat + 90) / deg), rows - 1)}_{min(math.floor((lon + 180) / deg), cols - 1)}'


def write_dataset(out_dir, manifest, records, reported=None, overview_deg=2):
    """Write manifest.json, tiles/*.json, overview.json and (optionally) reported.json into out_dir."""
    months = months_between(manifest['first_month'], manifest['last_month'])
    span = {s['key']: (s['first_month'], s['last_month']) for s in manifest['sensors']}
    for k in ('harmonized', 'harmonized_low', 'harmonized_high'):
        span[k] = tuple(manifest['harmonized_coverage'])

    by_cell = defaultdict(dict)
    for r in records:
        ym = f"{int(r['year'])}-{int(r['month']):02d}"
        if manifest['first_month'] <= ym <= manifest['last_month']:
            by_cell[r['cell_id']][ym] = r

    has_band = bool(by_cell) and all('harmonized_low' in r and 'harmonized_high' in r for c in by_cell.values() for r in c.values())
    keys = [k for k in SERIES if has_band or not k.startswith('harmonized_')]

    tiles = defaultdict(lambda: {'cells': [], 'series': {k: [] for k in keys}})
    for cid in sorted(by_cell):
        lat, lon = cell_centre(cid, manifest['grid_deg'])
        tile = tiles[grid_id(lat, lon, manifest['tile_deg'])]
        tile['cells'].append(cid)
        for k in keys:
            first, last = span.get(k, ('9999-99', '0000-00'))  # a sensor missing from the manifest is never operating
            row = []
            for ym in months:
                if not (first <= ym <= last):
                    row.append(None)
                else:
                    v = by_cell[cid].get(ym, {}).get(k)
                    row.append(0 if v is None else v)
            tile['series'][k].append(row)

    os.makedirs(os.path.join(out_dir, 'tiles'), exist_ok=True)
    for tid, tile in tiles.items():
        with open(os.path.join(out_dir, 'tiles', f'{tid}.json'), 'w') as f:
            json.dump({'tile_id': tid, **tile}, f, separators=(',', ':'))

    # Overview for the globe: mean harmonized hotspots per year over the baseline years, on a coarse grid.
    y0, y1 = manifest['baseline_years']
    n_years = y1 - y0 + 1
    coarse = defaultdict(float)
    for cid, by_month in by_cell.items():
        lat, lon = cell_centre(cid, manifest['grid_deg'])
        total = sum((r.get('harmonized') or 0) for ym, r in by_month.items() if y0 <= int(ym[:4]) <= y1)
        coarse[grid_id(lat, lon, overview_deg)] += total / n_years
    with open(os.path.join(out_dir, 'overview.json'), 'w') as f:
        json.dump({
            'grid_deg': overview_deg,
            'metric': f'Mean hotspots per year, {y0}-{y1}, harmonized',
            'cells': [[*cell_centre(cid, overview_deg), round(v)] for cid, v in sorted(coarse.items()) if v > 0],
        }, f, separators=(',', ':'))

    if reported is not None:
        with open(os.path.join(out_dir, 'reported.json'), 'w') as f:
            json.dump(reported, f)

    with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
        json.dump({**manifest, 'tiles': sorted(tiles)}, f, indent=2)
    return sorted(tiles)
