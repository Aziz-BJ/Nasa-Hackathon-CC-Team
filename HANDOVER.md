# HANDOVER: MODIS + VIIRS Hot Spots web app (NASA Space Apps 2026)

> **For Claude Code.** This file is the single source of context for building the team's web app. Read it fully before writing code. It was compiled on Sat 14 Nov 2026 (~15:00 UK) from the team's research doc, two audience briefs, the official Space Apps guides and FIRMS pages. Sections marked **DECIDED** are settled; **TO CONFIRM** means ask Aziz before building on it; **OPTION** means research input, not a decision.

---

## 0. How to work on this project (read first)

1. **Aziz is the lead and the only person writing the web app.** Work with him directly. He has React experience and prefers to build the app on his own; keep changes small, explained and reviewable.
2. **Do not invent the harmonization method.** The Space Apps rules say AI "should not be used to come up with your idea of how to solve the challenge." The method belongs to Pierre (maths/modelling) and Andre (data engineering, helping with modelling). The app must consume their output through the data contract in section 7. Until their files exist, use clearly labelled mock data (section 7.5) and never ship it.
3. **Label AI-generated code.** The submission guide requires AI-generated code and data to be acknowledged "in descriptive text and metadata." Do all three:
   - a short header comment in every file you generate or substantially write: `// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.`
   - a "Use of AI" section in `README.md` listing what AI helped with;
   - keep a running list in `docs/AI_USE.md` (date, file, what was generated) so Aziz can fill in the project page's "Use of Super Intelligence" field.
4. **Cite everything.** Every library, dataset, paper and image must appear in `docs/REFERENCES.md` with its licence. The rules allow removing awards from teams that don't cite open-source resources.
5. **No NASA logos, flags or mission insignia** in anything generated. No images, names or voices of the under-18 teammates anywhere in the app or repo.
6. **English only** in the UI, README and docs.
7. **No live FIRMS API calls from the browser.** The API key must never be in client code.
8. **Ask before** adding a backend, a paid service, a login, analytics/tracking, or any dependency with a non-OSI licence.

---

## 1. Project at a glance

| Item | Detail |
| --- | --- |
| Event | NASA International Space Apps Challenge 2026, theme "The Next Frontier" |
| Challenge | **Harmonization of MODIS and VIIRS Hot Spots** (Advanced, Intermediate) · https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ |
| Event type | **Universal Event** (virtual) |
| Hackathon window | Sat 14 Nov 2026 09:00 to **Sun 15 Nov 2026 23:59, in the Team Owner's local time** (Universal Event rule). If the Team Owner lives in the UK, that is 23:59 GMT. |
| Team targets | Feature freeze **Sun 12:00**. Submit by **Sun 18:00**. Sunday afternoon is reserved for the presentation. |
| Required NASA data | NASA FIRMS (the only resource on the challenge's Resources tab, checked 14 Nov 12:06) |
| Deliverables | (1) public web app link, no login; (2) public code repo; (3) project page on spaceappschallenge.org; (4) demo: **7 slides max incl. title and intro, or a video ≤ 30 s** |

### Team and ownership (DECIDED unless noted)

| Person | Owns | Hands to the app |
| --- | --- | --- |
| **Aziz** | Lead; full-stack web app; hosting; final submission | n/a |
| **Pierre** | Maths and data modelling: the harmonization method, its validation, the indices | Harmonized counts, method notes, validation numbers |
| **Andre** | Scope research (done); data engineering (FIRMS download, cleaning, gridding); helps Pierre | The monthly grid files (section 7) |
| **Guido** | TO CONFIRM. Proposed: validation and documentation (data QA, 2012-jump evidence charts, hold-out test, methods page, references, AI-use log) on Saturday; presentation on Sunday | Methods/limits text, references, evidence charts |

### Links

- Team research doc ("Space Apps 2026: Problem, Goals and Research Plan"): https://claude.ai/artifact/EYmxSjrhaGzSbrV2m9EHaN (tab 2 "Feature approaches": https://claude.ai/artifact/EYmxSjrhaGzSbrV2m9EHaN#1943b905-c573)
- Team briefing deck: https://claude.ai/artifact/WmFhAZfmpfCFT5ZQ1QXKU1
- A further artifact the team linked (https://claude.ai/code/artifact/8a8c7e24-5b4b-4e25-aaee-833d3c350839) **could not be read when this file was compiled**. If it holds team decisions, they override anything here marked TO CONFIRM or OPTION.

---

## 2. The problem and the goal

**Problem (DECIDED, draft wording for the project page):**
> Fire managers, researchers and communities decide whether a fire season is unusual by comparing it with the past. NASA's 25-year satellite fire record comes from two instruments, MODIS (2000–2027) and VIIRS (2012 onwards), that detect fires at different sizes and rates. Joined without correction, the record shows a false rise in fire activity when VIIRS begins. As MODIS switches off, every new month will be compared against a history recorded by a different instrument.

**Goal:** a public web tool, built on a harmonized MODIS + VIIRS hotspot dataset, that shows a consistent monthly **burning activity calendar** from the early 2000s to now for any chosen area, and says how unusual the latest month is, so that "the sensor of origin no longer matters" (challenge wording).

**What the challenge text asks the app to do (VERIFIED, challenge page):**
- Two parts: (1) harmonize MODIS and VIIRS hotspots; (2) a web app that takes the harmonized data as input, where a user selects a region and a date range, then downloads analytics and visualizations.
- A calendar of burning activity showing the **number of hotspots detected from the early 2000s to the present**: which periods of the year see more fires, which years had more activity, how a current fire compares with previous ones.
- Compare **the current month against the historical median** for a selected area.
- Colour ramps to show similarities and differences across months; a **downloadable CSV** of hotspots for a search.
- "Potential considerations": audiences (early warning and emergency responders, scientists, land managers, firefighters); a map to draw the area of interest or enter lat/long; accessible colour ramps; a burning calendar; key indices such as historical comparisons, anomalies against multi-year averages, number of fires detected and reported.

**Success on Sunday night:**
- A judge picks an area and within a minute sees the monthly calendar from the early 2000s to now and this month against the historical median.
- One chart shows the overlap years where adjusted MODIS and VIIRS line up, and the 2012 step is gone.
- Every NASA dataset is named with its version; the method is explained in plain English; limits are listed.
- The app link works in a private browser window with no login.

---

## 3. Space Apps rules that affect the build (VERIFIED, 13 Nov guides and Terms)

| Rule | What it means for the code |
| --- | --- |
| Final project link must be public, no password, permission or registration | Static hosting with a public URL. No login screens, no gated APIs. Test in a private window. |
| English only on the project page and linked materials | All UI copy and docs in English. |
| Must use at least one NASA dataset; Relevance rewards NASA data "as a core component" | FIRMS is the core. Name FIRMS and each product version in the UI (footer + methods page) and in CSV exports. NASA GIBS imagery as a basemap is a bonus NASA resource. |
| Original work is open source; Apache 2.0 by default if no OSI licence is named | Add `LICENSE` (Apache-2.0 unless Aziz picks another OSI licence). Only use dependencies with OSI licences; list them in `docs/REFERENCES.md`. |
| Cite every source, including open-source code | `docs/REFERENCES.md` with library, version, licence, URL. |
| AI use must be declared; AI code and data acknowledged in text and metadata; AI images watermarked; AI must not come up with the solution idea | See section 0. Don't generate images. |
| No recognisable names, voices or likenesses of under-18s in any submission | No team photos, names or bios of the students in the app. A neutral team name only. |
| Generated content may not use NASA branding | No NASA meatball/worm logos or mission patches in the UI. Plain-text "Data: NASA FIRMS" credit is fine. |
| Optional: FortiGuard web filter classification for a new website | After deploying, Aziz can submit the URL so judges' networks don't block it. |
| Demo: 7 slides incl. title/intro or ≤ 30 s video, else ineligible for Global Judging | Not a code task, but the app needs clean screenshot states (see section 12). |

Judging: five criteria scored 1–5 each, equal weight. **Impact, Creativity, Validity** (scientifically sound, feasible, usable and user-friendly), **Relevance** (answers the challenge; NASA data core), **Presentation** (judged on the demo and the full project). Global Nominees announced 3 Dec 2026, Finalists 17 Dec, Winners 26 Jan 2027.

---

## 4. Who the users are and what the app may and may not claim

### 4.1 The most important finding about users
- Satellite hotspots serve **strategic and situational-awareness decisions, not tactics**. Incident tactics use aircraft infrared, ground reports and perimeters (USFS Fire Imaging Technologies Users Guide, 2020). A 20-year calendar built from archive data has no tactical-latency requirement.
- The largest verified FIRMS user groups are **agencies doing situational awareness**. The four named audiences are open-ended, and roles overlap.
- **Position the app as a historical context tool**, not a warning or live-fire tool.

### 4.2 Audience cards (condensed from both briefs)

| Audience | Question the data answers | Data they need | Timing | What the app should show |
| --- | --- | --- | --- | --- |
| Early warning and emergency responders | Is activity here unusual for this time of year, and how has it behaved before? | Archive plus latest days, NRT vs standard labelled | Monthly context, pre-season planning | One-line verdict, calendar, and a clear note that this is observed-detection history, not a warning, with links to official warning sources and the live FIRMS map |
| Scientists | Is a change real or sensor-driven? What are the uncertainty and provenance? | **Standard (not NRT) data**, version labelled; sensor, day/night, confidence, FRP, type | Daily records, monthly/annual aggregates | Raw vs harmonized toggle, overlap chart, method page, CSV with provenance columns, stated baseline |
| Land managers | Which periods and years burn here? Is frequency changing? | Standard history plus recent months | Monthly and seasonal | Area-of-interest selection, calendar, seasonal profile, low-activity months, trend; "hotspot counts are not burned area" |
| Firefighters / incident commanders | Context only: what has this area done in past seasons? | Same as above | Daily to monthly | Strong "not tactical" labelling; simple numbers; never real-time claims |

### 4.3 What the data must NOT be used to claim (VERIFIED)
- A detection is a thermal anomaly in a pixel, **not a confirmed fire**. No exact location, size, perimeter or incident name.
- No "fire is here now", "this area is safe", real-time boundaries or safety guarantees.
- **Zero detections ≠ no fire** (overpass gaps, cloud, smoke, small or smouldering fires). The FIRMS map does not show cloud or missing data.
- **Hotspot counts must not be used to estimate burned area** (FIRMS, NASA ARSET).
- Detections include non-vegetation heat (industry, gas flares, volcanoes); filter by `type`.
- One large fire can produce many hotspots: "fire count is really just the number of pixels identified as fire" (NASA ARSET).
- Don't say "unprecedented". Say "we found no directly equivalent public tool in the sources reviewed".

### 4.4 Message classes (VERIFIED)
1. Satellite detection record. **← this app**
2. Automated subscription notification (FIRMS email alerts).
3. Official public warning (designated alerting authority, CAP format).
4. Incident information (agencies).

The app must never present itself as class 3 or 4.

### 4.5 Cross-cutting requirements for every view
1. **State the baseline years and the sensor roster** on every comparison.
2. **Flag NRT vs standard** data for recent periods.
3. **Don't treat zero as "no fire"**; separate "no detection" from "no observation / no sensor".
4. **Label counts as "hotspots detected"**, not fires, burned area or fire size.
5. **Colour plus a second cue**, 3:1 contrast for meaningful graphics, and a table alternative.
6. **Downloads with provenance** (sensor, version, confidence handling, baseline).
7. **Units:** FRP in MW; all FIRMS times in **UTC**.
8. English first.

---

## 5. Data facts (FIRMS)

### 5.1 Products and coverage (FIRMS archive page, read 14 Nov 2026)

| Product | Coverage | Pixel | Role in our app |
| --- | --- | --- | --- |
| MODIS Collection 6.1 (Terra + Aqua) | 1 Nov 2000 → present (Aqua from Jul 2002) | 1 km | Long history |
| VIIRS Suomi NPP 375 m | 20 Jan 2012 → **2 Nov 2026 (ended)** | 375 m | Overlap with MODIS for calibration |
| VIIRS NOAA-20 375 m | 1 Apr 2018 → present | 375 m | Latest months; S-NPP ↔ NOAA-20 overlap check |
| VIIRS NOAA-21 375 m | **CONFLICT:** 1 Mar 2023 (/download/) vs 17 Jan 2024 (/active_fire/) → present | 375 m | Optional backup; check first `acq_date` in the file |

- **Suomi NPP stop time CONFLICT:** 13:00 UTC (FIRMS blog), 15:40 UTC (LANCE blog), 1 Nov (one alert page). Say "on or about 2 Nov 2026".
- **MODIS end:** NASA plans to end Terra MODIS data collection in January 2027 and Aqua around September 2027 (CAMS); an Earthdata alert says shutdown begins late 2026 / early 2027 with no fixed date. Both satellites are drifting. Terra is the only morning overpass (~10:30 local); Aqua and VIIRS are ~13:30.
- **NRT vs standard:** NRT is replaced by standard (science-quality) data after roughly **2–5 months** (CONFLICT: ~5 on /download/, "usually 2–3, up to 5" on /active_fire/). **The latest months of any calendar will be NRT.** Scientists need standard data; label the boundary.
- **Access:** archive download (CSV, SHP, JSON) via Earthdata Login or emailed code, delivered by email. Area API needs a free MAP_KEY, 1–5 days per request on the live page. WFS: 5,000 transactions per 10 minutes. The archive page also offers a **yearly summary by country CSV** (useful for sanity checks).

### 5.2 Why the sensors don't match (for the methods page and the story)

| | MODIS | VIIRS 375 m |
| --- | --- | --- |
| Pixel at nadir | 1 km | 375 m |
| Pixel at swath edge | about 2 × 4.8 km | about 0.8 km |
| Smallest detectable fire | about 4 MW at nadir, over 30 MW at scan edge (brief); Sofiev & Kouznetsov 2026: ~3.7 MW nadir night, up to 40 MW day side view | about 1.3–2.9 MW (brief); ~0.5 MW at night (Sofiev & Kouznetsov 2026) |
| Confidence field | 0–100 % | low / nominal / high |

- VIIRS counts far more hotspots: 5.7× Aqua MODIS in Punjab cropland (Vadrevu); 1.2–1.3× totals in one NE Asia study. It is **not a fixed multiplier**: in NE Asia 2012–2017 MODIS missed 65 % (forest) / 83 % (low biomass) of VIIRS fire pixels, and VIIRS missed 35 % / 53 % of MODIS's (Li et al. 2020). Temporal patterns still agreed (R² up to 0.98).
- **Confidence is not harmonized** across sensors; FIRMS says there is no optimal cutoff a priori. NASA training: nominal + high reduces false alarms.
- **FRP is not directly comparable** across sensors.
- Published harmonization: Zheng 2026 fuses Aqua MODIS and S-NPP VIIRS FRP but depends on S-NPP and is not transferable to Terra; Giglio 2025 advises against simply concatenating MODIS and VIIRS burned-area records; Boschetti, Roy & Giglio ("Is the world burning less?") warn that the reported decline in global burned area may partly be a MODIS artifact. No validated global hotspot-count harmonization was found.
- **Sensor roster changes over time** (Terra, Aqua, S-NPP until Nov 2026, NOAA-20, NOAA-21). Any "unusual" statement must say which sensors fed the baseline and the current period.

### 5.3 Expected CSV columns (VERIFY against Andre's files)
- MODIS: `latitude, longitude, brightness, scan, track, acq_date, acq_time, satellite, instrument, confidence (0–100), version, bright_t31, frp, daynight, type`
- VIIRS: `latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, instrument, confidence (l/n/h), version, bright_ti5, frp, daynight, type`
- `type` (standard data): 0 presumed vegetation fire, 1 active volcano, 2 other static land source, 3 offshore.
- `acq_date` + `acq_time` are UTC.

---

## 6. Architecture (TO CONFIRM with Aziz; recommended defaults)

```
┌──────────── prepared before the demo (Andre / Pierre, Python) ────────────┐
│ FIRMS archive CSVs ─► filter ─► grid cell × month counts per sensor       │
│                    ─► harmonize (Pierre's model) ─► data/<region>/*.json  │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────── in the browser (Aziz, static React app) ──────────────────────┐
│ load region files ─► user picks area ─► sum cells inside area             │
│ ─► calendar · seasonal chart · indices + verdict · overlap chart · CSV     │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Static single-page app, no backend.** Suggested: Vite + React + TypeScript. Hosting: GitHub Pages, Netlify or Vercel (free, public, no login).
- **Data:** pre-built per-region monthly grid files from Andre, in `public/data/`. JSON is simplest; Parquet + DuckDB-WASM is an option only if files get large.
- **Map (OPTION):** Leaflet + Leaflet-Geoman (simplest, MIT) **or** MapLibre GL JS + Terra Draw (smoother, MIT). Basemap: NASA GIBS WMTS (e.g. VIIRS or MODIS true colour, Blue Marble) or OpenStreetMap tiles with attribution. OSM tile policy forbids heavy, bulk or offline use.
- **Charts (OPTION):** Observable Plot (`Plot.cell` fits the year × month grid), D3, or ECharts. Colour scales from `d3-scale-chromatic` (cividis, RdBu) or Crameri palettes.
- **Point-in-polygon:** `@turf/boolean-point-in-polygon` on cell centres (approximate to one cell at the edges; say so in the UI).
- **State in the URL** (stretch): area, dates and toggles in query params so a view can be shared.

Suggested repo layout:
```
/app                 React app (Aziz)
  /src/components    Calendar, SeasonalChart, VerdictPanel, OverlapChart, AreaPicker, ExportButton, DataTable
  /src/lib           aggregate.ts (sum cells), indices.ts (metrics), csv.ts, colors.ts
  /public/data       region files from Andre (not mock data in production builds)
/pipeline            Andre's and Pierre's Python (not edited by the app unless asked)
/docs                METHODS.md, REFERENCES.md, AI_USE.md, DATA_DICTIONARY.md
LICENSE  README.md  HANDOVER.md
```

---

## 7. Data contract between the pipeline and the app (TO CONFIRM with Andre and Pierre, ideally Sat afternoon)

### 7.1 Grid
- Regular lat/long grid, resolution `grid_deg` (suggested 0.25°, or 0.1° if file size allows). TO CONFIRM.
- `cell_id = "<row>_<col>"` where `row = floor((lat + 90) / grid_deg)`, `col = floor((lon + 180) / grid_deg)`. Cell centre = `(row + 0.5) * grid_deg - 90`, `(col + 0.5) * grid_deg - 180`.

### 7.2 `data/<region>/monthly.json` (one row per cell per month with any data)
```json
{
  "cell_id": "512_712",
  "lat": 38.125, "lon": -1.875,
  "year": 2019, "month": 8,
  "modis": 12,
  "viirs_snpp": 41,
  "viirs_noaa20": 39,
  "harmonized": 40.2,
  "harmonized_low": 33.0,
  "harmonized_high": 47.5
}
```
- `modis`, `viirs_*`: raw counts after filters; `null` = sensor not operating that month (≠ 0).
- `harmonized`: Pierre's output on the agreed reference scale (team suggestion was the VIIRS scale, TO CONFIRM); `harmonized_low/high` optional uncertainty band.
- Field names can change; the app reads them through one adapter (`src/lib/loadData.ts`) so a rename is a one-line fix.

### 7.3 `data/<region>/meta.json`
```json
{
  "region_id": "uk", "region_name": "United Kingdom", "bbox": [-8.7, 49.8, 1.8, 60.9],
  "grid_deg": 0.25,
  "products": [
    {"name": "MODIS C6.1 (Terra+Aqua)", "source": "NASA FIRMS", "coverage": ["2000-11-01", "2026-11-14"]},
    {"name": "VIIRS S-NPP 375 m", "source": "NASA FIRMS", "coverage": ["2012-01-20", "2026-11-02"]},
    {"name": "VIIRS NOAA-20 375 m", "source": "NASA FIRMS", "coverage": ["2018-04-01", "2026-11-14"]}
  ],
  "filters": {"type": [0], "modis_confidence_min": 30, "viirs_confidence": ["n", "h"]},
  "standard_until": "2026-06-30",
  "nrt_from": "2026-07-01",
  "baseline_years": [2003, 2025],
  "method": {"name": "TBD by Pierre", "version": "0.1", "fit_years": [2012, 2020], "test_years": [2021, 2025]},
  "validation": {"metric": "TBD", "value": null},
  "generated_at": "2026-11-14T18:00:00Z"
}
```
All values above are placeholders showing shape, not decisions (filters, baseline and dates are TO CONFIRM with Pierre/Andre).

### 7.4 Optional files
- `data/<region>/overlap.json`: monthly region totals 2012–2026 for MODIS, VIIRS and harmonized, for the overlap chart.
- `data/<region>/events.json`: known fire events (date, name, source URL) collected by Guido for validation markers.

### 7.5 Mock data rules
- Generate mock files only into `public/data/_mock/` with `"mock": true` in `meta.json`.
- When `mock` is true, show a red banner "MOCK DATA, NOT REAL" across the app.
- The production build must fail if any loaded `meta.json` has `"mock": true`.

---

## 8. Features and acceptance criteria

Priorities follow the team plan (Must / Should / Stretch). Specific UI choices are OPTIONS from research unless Aziz has decided.

### F1. Area selection (Must: presets + typed box; Should: drawing)
- Presets dropdown: the demo regions (TO CONFIRM: one fire-heavy region + the UK).
- Typed input: bounding box **west, south, east, north** (the FIRMS area-API order) and optionally point + radius (km). Validate lat −90…90, long −180…180, west < east (or handle the antimeridian), show area in km², cap the maximum area.
- Drawing (Should): rectangle and polygon on the map; editable; clear button.
- Typed input is the keyboard-accessible route; drawing must not be the only way.
- Acceptance: any valid area returns results in under 2 s on a laptop for preset-sized regions; an area outside loaded data shows a clear message.

### F2. Burning calendar (Must)
- Grid: rows = years (early 2000s → current year), columns = Jan–Dec, cell colour = hotspot count for the selected area (harmonized by default).
- Marginals: a bar per row for the year total; a strip under the grid for each month's median.
- Current month outlined and labelled "month to date"; NRT months marked (e.g. hatch or badge plus legend).
- Months before a sensor existed, or not yet happened: grey hatch "no data" (distinct from 0).
- Hover/tap/focus a cell: count, rank among the same month in other years, % of median, sensors that contributed, NRT/standard.
- Binned colour legend with numbers (counts are skewed: quantile or log bins).
- Record start: MODIS Terra from Nov 2000, Aqua from Jul 2002. If Pierre calibrates with Aqua only, the harmonized grid starts Jul 2002 unless Terra is handled (TO CONFIRM).
- Acceptance: answers "which months are busiest" and "which years burned most" at a glance; a screen-reader user can reach the same numbers via the table view (F8).

### F3. Current month vs history (Must)
- Seasonal chart: months on the x axis; the selected year as a line; the baseline **median** line; bands for the middle 50 % (interquartile) and middle 80 % (interdecile) of baseline years (NSIDC Charctic style).
- Headline: "November 2026 (to date, NRT): 214 hotspots. Typical November (2003–2025 median): 120." (numbers illustrative).
- Acceptance: baseline years and sensor roster are printed on the chart.

### F4. Indices and verdict (Must: first five; Should: rest)

| Index | Definition | Notes |
| --- | --- | --- |
| Monthly hotspots | Sum of `harmonized` over cells in the area for that month | Label "hotspots detected (harmonized)" |
| Typical month | Median of the same calendar month over `baseline_years` | Exclude the current year from its own baseline |
| Relative anomaly | (count − median) / max(median, `min_denominator`) × 100 | `min_denominator` avoids blow-ups when the median is ~0 (UK winters); value TO CONFIRM |
| Rank / percentile | Position of this month among the same month in all baseline years (+ current) | "3rd busiest August since 2002" |
| Year to date | Cumulative count Jan→current month vs median cumulative | "Season running 40 % ahead" |
| Verdict | From percentile: < 10 well below · 10–25 below · 25–75 near typical · 75–90 above · > 90 well above typical | Thresholds TO CONFIRM with Pierre; always show the number behind the words |
| z-score (Should) | (count − mean) / SD over baseline | Scientist view only; skewed counts break normality |
| Peak month, season length (Should) | Month of max median; months above a threshold | Don't conflate with fire size or intensity |
| Trend (Should) | Sen's slope + Mann–Kendall on annual harmonized totals | Only on harmonized data; otherwise the 2012 step fakes a trend |

Precedents to cite on the methods page: Brazil MMA reports z-scores with plain verdicts ("Muito acima da média"); GFW uses mean ± SD over recent years; NSIDC moved to median and percentile bands because SD misrepresented skewed data; baselines differ across platforms (GWIS last 10 years, EFFIS last 14 years / 2012–2021, INPE 2003–2023, Copernicus 2006–2024 for burnt area). **No common baseline exists, so always state ours.**

### F5. Raw vs harmonized + overlap chart (Must)
- Toggle: Harmonized · MODIS only · VIIRS only. Applies to the calendar and charts.
- Overlap chart: monthly region totals 2012→2026 for MODIS, VIIRS and harmonized; the stitched raw series that shows the 2012 jump next to the harmonized one.
- This is the core evidence for judges. Make it screenshot-ready.

### F6. CSV export (Must)
- Download for the selected area and date range: `year, month, hotspots_harmonized, harmonized_low, harmonized_high, modis, viirs_snpp, viirs_noaa20, data_status (standard|nrt|partial|no_sensor), sensors`.
- Commented header lines (`# ...`) with: area (bbox or polygon), grid size, products and versions, filters, baseline years, method name/version, generated date, "Counts are satellite hotspot detections, not fires or burned area. Times UTC. Source: NASA FIRMS."
- Optional second export: raw hotspot points for small areas (Stretch, only if Andre ships points).

### F7. About / methods / limits (Must)
- Plain-English method summary (from Pierre and Guido), datasets with versions and coverage, filters, baseline, validation result, and the limits list from section 4.3.
- "This is a historical record of satellite detections, not a warning system. For current fires see the NASA FIRMS Fire Map; for official warnings follow your local authorities."
- References and "Use of AI" summary.

### F8. Accessibility (Must)
- Colour is never the only cue: numbers in tooltips/cells, outlines for the current month, patterns for no-data and NRT.
- WCAG 1.4.11: meaningful graphic parts ≥ 3:1 against neighbours.
- A **table view** of the calendar (toggle or below the chart). A GitHub-style calendar heatmap failed accessibility audits and was replaced by an HTML table.
- Full keyboard use: area input, toggles, calendar cells focusable with visible focus.
- Test with Chrome DevTools → Rendering → Emulate vision deficiencies, and a greyscale check.

### Stretch (only after all Musts work)
- Estimated fire events (cluster hotspots in space and time; label "estimated").
- Day/night split (VIIRS responds much better at night).
- UK "fires reported on the ground" context: England fire statistics (e.g. FIRE0802, outdoor fires by month) and StatsWales grassland/woodland/crop fires by month. Check and cite the licence; context only, never replacing FIRMS.
- Shareable URL state; simple alerts; more presets.

### Not doing
Fire forecasting; our own fire detector; burned-area or smoke mapping; live alerting or warnings; non-NASA data as a replacement for FIRMS.

---

## 9. UI copy rules

- Say **"hotspots detected"** or **"satellite hotspot detections"**, never "fires" alone and never "burned area".
- Every comparison line names the **baseline years** and **sensors**: "vs 2003–2025 median, MODIS + VIIRS harmonized".
- Badge recent months **"Near real-time: provisional"**.
- "No detections" text: "No hotspots detected. This does not mean there was no fire (cloud, smoke, small fires, satellite gaps)."
- Times in **UTC**; FRP in **MW**.
- Avoid "unprecedented", "safe", "confirmed", "live", "warning".
- Footer: "Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m). Not an official warning service."

---

## 10. Colour and visual spec (OPTION, from research)

| Use | Palette | Avoid |
| --- | --- | --- |
| Counts (calendar, map cells) | Sequential: **cividis** (CVD-optimized, Nuñez et al. 2018), viridis, or Crameri batlow/lajolla | Rainbow/jet, red–green |
| Anomalies | Diverging centred on "typical": Crameri vik/roma or ColorBrewer RdBu/PuOr; warm = more, cool = less | Red–green; a neutral middle that looks like no-data |
| No data | Grey with diagonal hatch | Using the lightest data colour |
| NRT months | Dotted outline or small badge + legend entry | Colour-only signal |

Bin skewed counts (quantile or log) and print bin edges in the legend.

---

## 11. Timeline and handoffs (Sat 14 → Sun 15 Nov, UK time)

| When | Aziz (app) | Andre (data) | Pierre (model) | Guido (TO CONFIRM) |
| --- | --- | --- | --- | --- |
| Sat afternoon | Repo, scaffold, map, area picker, mock-data pipeline, calendar component | Request FIRMS archive (MODIS, S-NPP, NOAA-20); write cleaning + gridding on a sample | Explore overlap; choose method | Pick regions + known events; data QA |
| ~Sat 16:00 | Agree the data contract (section 7) with Andre and Pierre | First monthly table for one region | Start fitting | 2012-jump evidence chart |
| Sat evening | Seasonal chart, indices, verdict, CSV, toggle | Full archive → region files | Fit on 2012–2020, test 2021–2025 | Hold-out test, methods/limits draft, references, AI log |
| Sat night | First working version on real data, deployed to a public URL | Latest NRT months appended | Harmonized column delivered | |
| Sun to 12:00 | Accessibility, table view, methods page, polish. **Feature freeze 12:00** | Final data refresh | Final numbers for the methods page | Tests the app as a user |
| Sun afternoon | Bug fixes only; screenshots; project page; submit by 18:00 | | | Presentation (7 slides) |

---

## 12. Testing and submission checklist

- [ ] App loads in a **private window**, no login, on desktop and phone.
- [ ] Each preset and a typed box give results; invalid input shows a friendly error.
- [ ] No mock banner anywhere; build fails on mock data.
- [ ] Calendar, seasonal chart, verdict, overlap chart and CSV agree on the same numbers for one test area (spot-check by hand).
- [ ] Baseline years, sensor roster and NRT flags visible wherever comparisons appear.
- [ ] Colour-blindness simulation and greyscale check pass; table view and keyboard navigation work.
- [ ] `LICENSE` (OSI), `README.md` (what it does, how to run, data sources, Use of AI), `docs/REFERENCES.md`, `docs/AI_USE.md`, `docs/METHODS.md` present.
- [ ] Footer credits NASA FIRMS; no NASA logos; no student names/faces.
- [ ] Repo and app links public; optional FortiGuard classification requested.
- [ ] Screenshot states ready for the deck: calendar for a preset, the 2012 jump vs harmonized overlap chart, the verdict panel, the CSV.

---

## 13. Open questions and known conflicts

1. Contents of the linked artifact 8a8c7e24… (not read).
2. Demo regions (fire-heavy region? UK?) and their bounding boxes.
3. Harmonization method, reference scale (VIIRS?), Terra handling, filters, grid size, baseline years, verdict thresholds: Pierre/Andre to decide.
4. Guido's role for Saturday.
5. NOAA-21 start date (1 Mar 2023 vs 17 Jan 2024) and S-NPP stop time: check in the downloaded files.
6. NRT → standard lag (2–5 months): set `nrt_from` from the actual files.
7. Does "emergency responders" include civil-protection agencies? (affects wording only)
8. Whether AI-assisted background research needs mentioning beyond the "Use of SI" field (ask Space Apps support if unsure).

---

## 14. Sources

**Space Apps 2026**
- Challenge: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ (Resources tab: `?tab=resources`)
- Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging & Awards Guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Participant Terms: https://www.spaceappschallenge.org/legal/

**FIRMS and sensors**
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

**Users and practice**
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

**Build and design**
- Observable Plot cell mark: https://observablehq.com/plot/marks/cell
- NSIDC median/percentile bands: https://nsidc.org/sea-ice-today/about-data · https://nsidc.org/learn/ask-scientist/how-low-low
- GFW / Vizzuality on framing fire alerts: https://medium.com/vizzuality-blog/framing-data-f7df7f19bccd · https://medium.com/vizzuality-blog/playing-with-fires-bd018bf941b2
- Leaflet-Geoman (free): https://npmjs.com/package/@geoman-io/leaflet-geoman-free · Terra Draw: https://www.osgeo.org/projects/terra-draw
- NASA GIBS with web maps: https://wiki.earthdata.nasa.gov/x/hQ3gB · OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- DuckDB-WASM: https://www.duckdb.org/docs/current/clients/wasm/overview
- cividis (Nuñez et al. 2018): https://www.pnnl.gov/publications/optimizing-colormaps-consideration-color-vision-deficiency-enable-accurate
- Crameri et al. 2020, misuse of colour: https://fermatslibrary.com/s/the-misuse-of-colour-in-science-communication
- WCAG 2.2 1.4.1 and 1.4.11: https://w3.org/WAI/WCAG22/Understanding/use-of-color.html · https://w3.org/WAI/WCAG22/Understanding/non-text-contrast
