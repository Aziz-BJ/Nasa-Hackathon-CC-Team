# Nasa Hackathon CC-Team: MODIS + VIIRS Hot Spots

Team project for the NASA International Space Apps Challenge 2026, challenge
**Harmonization of MODIS and VIIRS Hot Spots**.

A public web tool, built on a harmonized MODIS + VIIRS fire record from NASA FIRMS, that shows a consistent monthly
burning calendar from July 2002 to now for four study regions (mainland Italy, Sicily, Sardinia, California), where the
fires were on a 5 km grid, and how the latest month compares with 2003 to 2025.

This is a historical record of satellite detections, not a warning system.

> Status: the web app runs on the team's real harmonized record (data to 13 November 2026).
> Project brief: [HANDOVER.md](HANDOVER.md). Plans: [docs/superpowers/plans/](docs/superpowers/plans/) (latest: [real data](docs/superpowers/plans/2026-11-15-real-data.md)).

## Run the app

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

Tests, builds and how to refresh the data: [app/README.md](app/README.md).

## Repository layout

```
/app        The web app (React + MapLibre globe), with the real data in app/public/data/real/
/pipeline   The pipeline outputs the app is built from: Pierre's harmonized record, method and validation
            (harmonized_outputs_REAL/) and Andrea's region outlines (region_outlines/). See pipeline/README.md.
/docs       REFERENCES.md, AI_USE.md, DATA_CONTRACT.md (pipeline → app format), plans/
```

## How the record is made

Andrea cleaned the FIRMS detections (Aqua MODIS C6.1, Suomi NPP and NOAA-20 VIIRS 375 m) into fire cell-days on a 5 km grid.
Pierre's method keeps measured Aqua MODIS to June 2021 and converts VIIRS to the Aqua scale after it, with factors per region, season
and day/night, a fire-size term, and 90% predictive ranges. Validation, leaving out one year at a time: monthly error falls from 1.54
(no correction) to 0.33, with 89% of true values inside the 90% ranges. Details: [pipeline/harmonized_outputs_REAL/METHOD.md](pipeline/harmonized_outputs_REAL/METHOD.md)
and [RESULTS.md](pipeline/harmonized_outputs_REAL/RESULTS.md).

## Data

Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Region outlines: ISTAT, US Census TIGER 2010, Natural Earth. Imagery: NASA GIBS.
Labels: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors. Not an official warning service.
Full citations, with licences, in [docs/REFERENCES.md](docs/REFERENCES.md). The pipeline-to-app format is in [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).

## Use of AI

The data pipeline, the harmonization code and its write-up, and the app were produced with AI assistance (Claude) from the team's
own decisions, and reviewed by the team. A dated log of AI-generated files is kept in [docs/AI_USE.md](docs/AI_USE.md).

## Licence

Apache License 2.0, see [LICENSE](LICENSE).
