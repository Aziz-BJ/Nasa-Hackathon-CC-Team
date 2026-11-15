# Nasa Hackathon CC-Team: MODIS + VIIRS Hot Spots

Team project for the NASA International Space Apps Challenge 2026, challenge
**Harmonization of MODIS and VIIRS Hot Spots**.

A public web tool, built on a harmonized MODIS + VIIRS hotspot dataset from NASA FIRMS,
that shows a consistent monthly burning activity calendar from the early 2000s to now for
a chosen area, and compares the latest month with the historical median.

This is a historical record of satellite detections, not a warning system.

> Status: the web app is feature complete and runs on clearly labelled mock data until the harmonized FIRMS dataset is ready.
> Project brief: [HANDOVER.md](HANDOVER.md). Implementation plan: [docs/superpowers/plans/](docs/superpowers/plans/2026-11-14-hotspot-calendar-demo.md).

## Run the app

```bash
cd demo
npm install
npm run dev        # http://localhost:5173
```

Tests, builds and how to plug in the real data: [demo/README.md](demo/README.md).

## Repository layout

```
/demo       The web app (React + MapLibre globe); runs on mock data until the pipeline delivers
/pipeline   Python data download, gridding and harmonization (Andre, Pierre)
/docs       REFERENCES.md, AI_USE.md, DATA_CONTRACT.md (pipeline → app format), write_app_data.py, plans/
```

## Data

Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Imagery: NASA GIBS. Labels: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors.
Not an official warning service. Full citations, with licences, in [docs/REFERENCES.md](docs/REFERENCES.md).
The pipeline-to-app file format is in [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).

## Use of AI

Parts of this repository were generated with AI assistance (Claude) and reviewed by the team.
The harmonization method is the team's own work. A dated log of AI-generated files is kept in
[docs/AI_USE.md](docs/AI_USE.md).

## Licence

Apache License 2.0, see [LICENSE](LICENSE).
