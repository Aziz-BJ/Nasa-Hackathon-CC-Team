# Nasa Hackathon CC-Team: MODIS + VIIRS Hot Spots

Team project for the NASA International Space Apps Challenge 2026, challenge
**Harmonization of MODIS and VIIRS Hot Spots**.

A public web tool, built on a harmonized MODIS + VIIRS hotspot dataset from NASA FIRMS,
that shows a consistent monthly burning activity calendar from the early 2000s to now for
a chosen area, and compares the latest month with the historical median.

This is a historical record of satellite detections, not a warning system.

> Status: setup. See [HANDOVER.md](HANDOVER.md) for the project brief and data contract.

## Repository layout (planned)

```
/app        React web app
/pipeline   Python data download, gridding and harmonization
/docs       METHODS.md, REFERENCES.md, AI_USE.md, DATA_DICTIONARY.md
```

## Data

Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Not an official warning service.
Full citations in [docs/REFERENCES.md](docs/REFERENCES.md).

## Use of AI

Parts of this repository were generated with AI assistance (Claude) and reviewed by the team.
The harmonization method is the team's own work. A dated log of AI-generated files is kept in
[docs/AI_USE.md](docs/AI_USE.md).

## Licence

Apache License 2.0, see [LICENSE](LICENSE).
