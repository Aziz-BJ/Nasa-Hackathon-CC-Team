#!/usr/bin/env bash
# make_handover.sh <input folder> <output folder> : test, build, check, load-test, package.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
python3 "$HERE/test_pipeline.py" | tail -1
python3 "$HERE/build_cell_days.py" "$1" "$2"
python3 "$HERE/run_checks.py" "$2" > /dev/null
"$HERE/test_db.sh" "$2/cell_days.csv"
echo "done: $2/cell_days.csv"
