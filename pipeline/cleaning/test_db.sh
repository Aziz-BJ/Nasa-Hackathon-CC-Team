#!/usr/bin/env bash
# test_db.sh <cell_days.csv> : load the table into a throwaway local PostgreSQL and run the post-load checks.
# Needs PostgreSQL binaries (initdb, pg_ctl, psql). Run as a non-root user, or as root with a 'postgres' user.
set -euo pipefail
CSV=$(readlink -f "$1"); BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}; D=$(mktemp -d); PORT=54331
RUN() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
chmod 755 "$D"; cp "$CSV" "$D/cell_days.csv"; chmod 644 "$D/cell_days.csv"; [ "$(id -u)" = 0 ] && chown -R postgres "$D"
RUN "$BIN/initdb -D $D/data -A trust >/dev/null && $BIN/pg_ctl -D $D/data -o '-k $D -p $PORT' -l $D/log start >/dev/null"
trap 'RUN "$BIN/pg_ctl -D $D/data stop -m fast >/dev/null"' EXIT
Q() { RUN "psql -h $D -p $PORT -X -q -v ON_ERROR_STOP=1" ; }
Q < "$(dirname "$0")/cell_days.sql"
echo "\\copy public.cell_days from '$D/cell_days.csv' with (format csv, header true)
select count(*) as rows, count(distinct cell_id) as cells, min(date_local), max(date_local) from public.cell_days;" | Q
if echo "insert into public.cell_days select * from public.cell_days limit 1;" | Q 2>/dev/null; then echo "FAIL duplicate key accepted"; exit 1; else echo "PASS duplicate key refused"; fi
if echo "insert into public.cell_days values ('california','3035_1_1',0,0,'2020-01-01','AQUA','MODIS','D',1,1,1,1,'high','SP');" | Q 2>/dev/null; then echo "FAIL wrong grid accepted"; exit 1; else echo "PASS California row with an Italian cell id refused"; fi
