# References

Every dataset, service, library and source used by the Hotspot Calendar app, with its licence or terms.
Library versions are the exact ones in `app/package-lock.json`.

## Data, imagery and map services

| Source | What we use | Licence / terms | URL |
| --- | --- | --- | --- |
| NASA FIRMS | MODIS Collection 6.1 active fire, 1 km (the record uses Aqua only) | NASA open data, no restriction on use; credit NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/ |
| NASA FIRMS | VIIRS 375 m active fire (Suomi NPP, NOAA-20) | NASA open data, no restriction on use; credit NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/ |
| ISTAT, via openpolis/geojson-italy | Italian region boundaries (Andrea's region outlines) | Italian official statistics; credit ISTAT. Terms in the openpolis/geojson-italy repository | https://github.com/openpolis/geojson-italy |
| US Census Bureau TIGER 2010, via jgoodall/us-maps | California state boundary (includes its 3 nautical miles of state waters) | US Government work; credit US Census Bureau | https://www.census.gov/geographies/mapping-files.html |
| Natural Earth 1:10m admin-0 | Neighbouring countries, so Italy's sea margin never claims foreign land | Public domain | https://www.naturalearthdata.com |
| NASA GIBS | BlueMarble_ShadedRelief_Bathymetry and VIIRS_Black_Marble (2016) imagery tiles | NASA open data; credit NASA GIBS | https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api |
| OpenFreeMap | Vector tiles (OpenMapTiles schema) and fonts for country borders and place names | Free to use with credit; map data © OpenStreetMap contributors (ODbL 1.0); © OpenMapTiles | https://openfreemap.org · https://www.openstreetmap.org/copyright |

The app runs on the team's real harmonized record (`pipeline/harmonized_outputs_REAL/`), built from the FIRMS archive requests listed in Andrea's handover. The earlier synthetic mock data is retired. No ground-reported fire statistic is wired in yet (candidates: EFFIS for Italy, CAL FIRE for California).

## Software

| Library | Version | Licence | URL |
| --- | --- | --- | --- |
| React, React DOM | 19.3.1 | MIT | https://react.dev |
| Vite | 8.3.8 | MIT | https://vite.dev |
| @vitejs/plugin-react | 6.3.0 | MIT | https://github.com/vitejs/vite-plugin-react |
| TypeScript | 7.0.2 | Apache-2.0 | https://www.typescriptlang.org |
| MapLibre GL JS | 6.18.0 | BSD-3-Clause | https://maplibre.org |
| Terra Draw | 1.39.0 | MIT | https://terradraw.io |
| terra-draw-maplibre-gl-adapter | 1.5.0 | MIT | https://terradraw.io |
| Observable Plot | 0.6.19 | ISC | https://observablehq.com/plot |
| d3-scale | 4.0.3 | ISC | https://d3js.org/d3-scale |
| d3-scale-chromatic | 3.1.1 | ISC (includes ColorBrewer schemes, Apache-2.0) | https://d3js.org/d3-scale-chromatic |
| Turf: @turf/area, bbox, bbox-polygon, boolean-point-in-polygon, circle | 7.4.0 | MIT | https://turfjs.org |
| Phosphor Icons (React) | 2.1.10 | MIT | https://phosphoricons.com |
| hyparquet (import-detections only, not in the app bundle) | 1.33.0 | MIT | https://github.com/hyparam/hyparquet |
| Vitest | 5.1.0 | MIT | https://vitest.dev |
| jsdom | 31.0.1 | MIT | https://github.com/jsdom/jsdom |
| Testing Library: react, jest-dom, user-event | 16.3.3, 7.0.1, 14.6.10 | MIT | https://testing-library.com |
| Playwright | 1.65.1 | Apache-2.0 | https://playwright.dev |
| axe-core for Playwright | 4.14.0 | MPL-2.0 | https://github.com/dequelabs/axe-core-npm |
| oxlint | 1.93.0 | MIT | https://oxc.rs |
| @types/* (d3-scale, d3-scale-chromatic, node, react, react-dom) | see lockfile | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

## Colour, design and accessibility

| Item | Source | Licence |
| --- | --- | --- |
| inferno colour map | Smith & van der Walt, matplotlib colour maps (via d3-scale-chromatic) | CC0 |
| cividis colour map | Nuñez, Anderton & Renslow 2018, *PLOS ONE* 13(7): e0199239, https://doi.org/10.1371/journal.pone.0199239 | CC0 (via d3-scale-chromatic) |
| RdBu diverging scheme | Cynthia Brewer, ColorBrewer, https://colorbrewer2.org | Apache-2.0 |
| Okabe-Ito categorical colours | Okabe & Ito 2008, Color Universal Design, https://jfly.uni-koeln.de/color/ | free use with citation |
| Filled-button blue, icon guidance | NASA Space Apps Brand Guidelines, https://www.spaceappschallenge.org/brand/ (no logos used) | Space Apps terms |
| Interface style (materials, motion, typography) | Apple WWDC talks *Designing Fluid Interfaces* (2018) and *The Details of UI Typography* (2020): inspiration only, no Apple assets or code | n/a |
| Accessibility targets | W3C WCAG 2.2 (1.4.1 Use of Color, 1.4.3 and 1.4.11 contrast) | W3C |
| Median and percentile bands | NSIDC Charctic style, https://nsidc.org/sea-ice-today/about-data | n/a |

## Research and context

### Space Apps 2026
- Challenge: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ (Resources tab: `?tab=resources`)
- Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging & Awards Guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Participant Terms: https://www.spaceappschallenge.org/legal/

### FIRMS and sensors
- FIRMS archive download: https://firms.modaps.eosdis.nasa.gov/download/ · Active fire data: https://firms.modaps.eosdis.nasa.gov/active_fire/ · Area API: https://firms.modaps.eosdis.nasa.gov/api/area/ · FAQ: https://www.earthdata.nasa.gov/faq/firms-faq · Attributes: https://earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs
- Suomi NPP transition: https://www.earthdata.nasa.gov/news/blog/transitioning-from-s-npp-viirs-omps-what-nasa-firms-users-need-know
- Terra/Aqua transition alert: https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs
- CAMS on MODIS drift and end dates: https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- MODIS C6/C6.1 fire user guide: https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf · VIIRS fire user guide: https://lpdaac.usgs.gov/documents/197/VNP14_User_Guide_V1.pdf
- Li et al. 2020 (MODIS vs VIIRS, NE Asia): https://www.mdpi.com/2072-4292/12/18/2870
- Sofiev & Kouznetsov 2026 (detection limits): https://gmd.copernicus.org/articles/19/10123/2026/gmd-19-10123-2026.pdf
- Vadrevu & Lasko (VIIRS vs Aqua MODIS, Punjab): https://ntrs.nasa.gov/api/citations/20170011227/downloads/20170011227.pdf
- Boschetti, Roy & Giglio, "Is the world burning less?": https://modis.gsfc.nasa.gov/sci_team/meetings/202305/presentations/boschetti.pdf
- MODIS–VIIRS FRP fusion 2026: https://mdpi-res.com/d_attachment/remotesensing/remotesensing-18-01650/article_deploy/remotesensing-18-01650.pdf
- GFED5NRT (ESSD 2026): https://essd.copernicus.org/articles/18/7535/2026/
- NASA ARSET Q&A (hotspot counts are pixels): https://appliedsciences.nasa.gov/sites/default/files/2021-05/Fire%20Risk%20Q&A%20Part%203_0.pdf

### Users and practice
- Johnston et al. 2020: https://pmc.ncbi.nlm.nih.gov/articles/PMC7571162/
- NASA Wildfire Stakeholder Workshop 2022: https://cce.nasa.gov/firesense/documents/NASA_Wildfire_Stakeholder_Workshop_Findings_Summary-10122022.pdf
- USFS Fire Imaging Technologies Users Guide: https://fsapps.nwcg.gov/nirops/docs/upload/Fire_Imaging_Technologies_Users_Guide.pdf
- CEOS wildfire pilot: https://ceos.org/news/wildfire-pilot/
- Hope, McFayden, de Jong et al. 2024: https://doi.org/10.1080/17538947.2024.2420821
- Copernicus ESOTC 2025 wildfires: https://climate.copernicus.eu/esotc/2025/wildfires · GWIS: https://gwis.jrc.ec.europa.eu/applications · EFFIS: https://forest-fire.emergency.copernicus.eu/applications
- INPE Infoqueima (reference satellite, baselines): https://dataserver-coids.inpe.br/queimadas/queimadas/Infoqueima/2024/2024_09_infoqueima.pdf
- Brazil MMA fire outlook (z-scores + verdicts): https://www.gov.br/mma/pt-br/noticias-defeso-eleitoral/20260715_5_reuniao_perspectivas_climaticas_2026_queimadas_mma.pdf/@@download/file
- OASIS CAP v1.2: https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2.html
- UK reported fires: https://www.gov.uk/government/statistical-data-sets/fire-statistics-data-tables · https://stats.gov.wales/en-GB/9ab23d5a-7930-46ce-bb8d-faa4648a1097
- Carbon Brief, record UK wildfires 2025: https://www.carbonbrief.org/analysis-record-uk-wildfires-have-burned-an-area-twice-the-size-of-glasgow-in-2025

### Build and design research
- Observable Plot cell mark: https://observablehq.com/plot/marks/cell
- NSIDC median/percentile bands: https://nsidc.org/sea-ice-today/about-data · https://nsidc.org/learn/ask-scientist/how-low-low
- GFW / Vizzuality on framing fire alerts: https://medium.com/vizzuality-blog/framing-data-f7df7f19bccd · https://medium.com/vizzuality-blog/playing-with-fires-bd018bf941b2
- Leaflet-Geoman (free): https://npmjs.com/package/@geoman-io/leaflet-geoman-free · Terra Draw: https://www.osgeo.org/projects/terra-draw
- NASA GIBS with web maps: https://wiki.earthdata.nasa.gov/x/hQ3gB · OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- DuckDB-WASM: https://www.duckdb.org/docs/current/clients/wasm/overview
- cividis (Nuñez et al. 2018): https://www.pnnl.gov/publications/optimizing-colormaps-consideration-color-vision-deficiency-enable-accurate
- Crameri et al. 2020, misuse of colour: https://fermatslibrary.com/s/the-misuse-of-colour-in-science-communication
- WCAG 2.2 1.4.1 and 1.4.11: https://w3.org/WAI/WCAG22/Understanding/use-of-color.html · https://w3.org/WAI/WCAG22/Understanding/non-text-contrast
