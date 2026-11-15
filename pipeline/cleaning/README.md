# cell_days pipeline (Person A), version 1.1

Turns raw NASA FIRMS hotspots (Aqua MODIS, Suomi NPP VIIRS, NOAA-20 VIIRS) for Italy and California
into the `cell_days` handover table: one row per 5 km cell x local solar day x satellite x day/night.

## Run
    pip install numpy pandas scipy pyproj shapely pvlib pyarrow
    python3 build_cell_days.py <folder with the FIRMS zips or csvs> <output folder>
    python3 run_checks.py <output folder>
    ./test_db.sh <output folder>/cell_days.csv          # optional, needs local PostgreSQL

## Validate (Validation tab of the cleaning note)
    pip install duckdb matplotlib
    python3 validate_independent.py <zips> <output folder>/cell_days.csv <out>     # second implementation
    THETA_FROM_PIPELINE=1 PIPELINE_LOG=<output folder>/cleaning_log.json \
      python3 validate_independent.py <zips> <output folder>/cell_days.csv <out2>  # same, pipeline's scan angle
    python3 validate_raw_points.py <zips> <raw.parquet>                            # raw points in the regions
    python3 validate_agreement.py <raw.parquet> <output folder>/detections_clean.parquet <out>
    python3 validate_maps.py <raw.parquet> <output folder>/detections_clean.parquet <output folder>/cleaning_log.json <out>

Input: the six FIRMS Archive Download zips (MODIS C6.1, VIIRS S-NPP 375 m, VIIRS NOAA-20 375 m;
Italy as a country, California as a box), each holding fire_archive_* (standard) and fire_nrt_* (NRT).

Output: cell_days.csv (the table), cleaning_log.json (rows removed at every step), checks.json,
check_counts_by_year.csv, raw_counts_by_year.csv, detections_clean.parquet (the cleaned points).

## Files
- grid.py            the shared 5 km grid: cell_id = {epsg}_{floor(x/5000)}_{floor(y/5000)}
- regions.py         the four region outlines and the point -> region rule (3 nmi sea margin)
- geometry.py        scan angle and scan_zone from the FIRMS scan and track sizes
- build_cell_days.py the cleaning steps 1-10
- run_checks.py      duplicate keys, counts per year, Sardinia 2021, Sicily 2023, identical grid
- test_pipeline.py   end-to-end test with a known answer (must print ALL PASS)
- cell_days.sql      Supabase table definition with the key and value checks
- validate_*.py      independent rebuild, raw-vs-cleaned agreement, plausibility checks, maps
- geo/               outlines: ISTAT regions (openpolis/geojson-italy), California US Census 2010
                     state boundary (jgoodall/us-maps), foreign land (Natural Earth 10m)

The rules and their proofs are in the cleaning note.
