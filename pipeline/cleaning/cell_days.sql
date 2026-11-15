-- cell_days: handover table (one row = one 5 km cell x one local solar day x one satellite x day/night)
-- Run once in the Supabase SQL editor, then load cell_days.csv (see the load notes at the bottom).
create table if not exists public.cell_days (
  region        text             not null check (region in ('italy_mainland','sicily','sardinia','california')),
  cell_id       text             not null check (cell_id ~ '^(3035|3310)_-?[0-9]+_-?[0-9]+$'),
  cell_lat      double precision not null check (cell_lat between -90 and 90),
  cell_lon      double precision not null check (cell_lon between -180 and 180),
  date_local    date             not null,
  satellite     text             not null check (satellite in ('AQUA','SNPP','NOAA20')),
  sensor        text             not null check (sensor in ('MODIS','VIIRS')),
  daynight      char(1)          not null check (daynight in ('D','N')),
  scan_zone     smallint         not null check (scan_zone in (1,2,3)),
  n_detections  integer          not null check (n_detections >= 1),
  frp_sum_mw    double precision not null check (frp_sum_mw >= 0),
  frp_max_mw    double precision not null check (frp_max_mw >= 0),
  conf_max      text             not null check (conf_max in ('nominal','high')),
  data_version  text             not null check (data_version in ('SP','NRT')),
  primary key (region, cell_id, date_local, satellite, daynight),
  constraint sensor_matches_satellite check ((satellite = 'AQUA') = (sensor = 'MODIS')),
  constraint grid_matches_region      check ((region = 'california') = (cell_id like '3310\_%')),
  constraint max_not_above_sum        check (frp_max_mw <= frp_sum_mw)
);
create index if not exists cell_days_region_date on public.cell_days (region, date_local);
create index if not exists cell_days_cell        on public.cell_days (cell_id);

-- The app reads with the public (anon) key, so allow read-only access and nothing else.
alter table public.cell_days enable row level security;
drop policy if exists "cell_days read" on public.cell_days;
create policy "cell_days read" on public.cell_days for select using (true);

-- LOAD (pick one):
--  a) Dashboard: Table Editor > cell_days > Insert > Import data from CSV > cell_days.csv
--  b) Terminal:  psql "<your Supabase connection string>" \
--                -c "\copy public.cell_days from 'cell_days.csv' with (format csv, header true)"
-- CHECK after loading (must match the numbers in the cleaning note):
--  select count(*), count(distinct cell_id), min(date_local), max(date_local) from public.cell_days;
--  select satellite, extract(year from date_local) y, sum(n_detections) from public.cell_days group by 1,2 order by 1,2;
