// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Method and validation text follows the team's METHOD.md and RESULTS.md (pipeline/harmonized_outputs_REAL/).
import type { Manifest } from '../lib/types'

const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`

export function AboutPage({ manifest }: { manifest: Manifest }) {
  const m = manifest
  const v = m.validation
  const names = m.regions.map((r) => r.name)
  const regionList = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return (
    <div className="about">
      <h2>What this shows</h2>
      <p>
        A monthly record of fire activity seen from space for {regionList}, from July 2002 to {m.last_day}, on one consistent scale.
        For any region or shape and any months, it shows the burning calendar, how the latest month compares with {m.baseline_years[0]} to {m.baseline_years[1]},
        and where the fires were on a {m.cell_km} km grid.
      </p>
      <div className="notice">
        This is a historical record of satellite detections, not a warning system. For current fires see the{' '}
        <a href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS Fire Map</a>; for official warnings follow your local authorities.
        Not for tactical decisions during a fire.
      </div>

      <h2>Why the record needs harmonizing</h2>
      <p>
        Aqua MODIS has watched fires since July 2002 with 1 km pixels. VIIRS, on Suomi NPP (from 2012) and NOAA-20 (from 2018), has 375 m pixels
        and sees much smaller fires, so it reports several times more. Aqua's orbit has drifted later in the day since July 2021, so it can no longer carry
        the record on its own. Joining the raw counts where the record changes satellite makes a false jump of 3.3 to 5.4 times in yearly fire activity.
        This record converts VIIRS to the Aqua MODIS scale instead, so 2025 can be compared with 2005.
      </p>

      <h2>The unit: fire cell-days</h2>
      <p>
        A fire cell-day is a {m.cell_km} km square with at least one fire detection on one day, in the day or night pass. Counting squares instead of detections
        removes most of the difference in pixel size before any statistics. All numbers are on the scale of {m.method.reference_scale}.
      </p>

      <h2>How the record is made</h2>
      <ol>
        <li>
          Cleaning: NASA FIRMS detections are assigned to the four regions (for Italy, sea within 3 nautical miles of the coast counts, because a coastal fire's
          pixel centre can fall offshore). Volcanic heat at Etna and Stromboli, 1,311 static heat sources such as industrial sites, low-confidence detections,
          duplicate detections at the swath edge and repeat passes are removed. A second, independent program rebuilt the same table row for row.
        </li>
        <li>
          Sources: July 2002 to June 2021 is measured by Aqua MODIS. From July 2021 the record uses Suomi NPP VIIRS, converted; from 2 November 2026,
          NOAA-20 VIIRS, converted through Suomi NPP. Days a satellite is missing are filled from the next one.
        </li>
        <li>
          Conversion: a factor for each region, season (June to September, or the rest of the year) and day or night, learnt from the days both satellites
          flew together ({m.method.fit_window}). Each month is also adjusted for fire size: doubling the mean fire power per cell-day raises the factor by 31%,
          because MODIS catches a bigger share of big fires. Sicily and Sardinia are small, so the three Italian regions share information in a hierarchical model.
        </li>
        <li>
          Uncertainty: every converted month has a 90% range for the count, from 1,000 draws of the model. Measured Aqua months have no model range.
        </li>
      </ol>

      <h2>How well it works</h2>
      <ul>
        <li>
          Each year of the overlap was left out in turn and predicted from the others. The error on monthly regional totals fell from {v.loyo_male_naive.toFixed(2)} with
          no correction to {v.loyo_male.toFixed(2)} (mean absolute log error), with R² {v.loyo_r2.toFixed(2)}. {Math.round(v.coverage90 * 100)}% of the real values fell inside the 90% ranges.
        </li>
        {v.seams.map((s) => (
          <li key={s.seam}>
            No clear step where the record switches ({s.seam}): {pct(s.step_pct)} (90% range {pct(s.lo90_pct)} to {pct(s.hi90_pct)}){s.no_step ? ', which includes zero' : ''}.
          </li>
        ))}
        <li>Running NOAA-20 alone through the chain gives {v.chain_ratio.toFixed(3)} times the S-NPP route over July 2021 to October 2026, so the record is safe after S-NPP ends.</li>
        <li>Factors learnt in one region do not carry over to another, so each region is calibrated on its own. A new region needs its own overlap years.</li>
      </ul>

      <h2>The map</h2>
      <p>
        The {m.cell_km} km fire cells use the same rule as the record: each day counts the satellite the record uses that day, converted with the region's factor,
        and each region-month is then scaled so its cells add up exactly to the region's harmonized total. For a whole region the app shows the record itself,
        with its 90% range. For a shape you draw, the app adds up the cells inside it: the raw sensor counts are exact; the harmonized number is an estimate
        (the region's conversion applied to part of it) and has no 90% range. Cells are drawn as squares around their centres; region outlines are simplified for the web.
      </p>
      <p>
        An optional layer (Layers, "Detections at native pixel size") shows every cleaned detection instead, coloured by satellite and sized like its pixel
        when zoomed in. It is the raw data before harmonizing: VIIRS sees many more, smaller fires than Aqua MODIS, so the dots are not comparable between sensors.
        The Download panel offers the same detections as a CSV, one row per hotspot, with its UTC time, satellite, confidence and fire radiative power.
      </p>

      <h2>How the comparisons work</h2>
      <ul>
        <li>Baseline: {m.baseline_years[0]} to {m.baseline_years[1]}, same calendar month, leaving out the month's own year.</li>
        <li>Typical: the median of the baseline years. Difference: (value − median) / median; for medians below 5 the app shows the plain difference. Robust z: (value − median) / (1.4826 × median absolute deviation).</li>
        <li>Percentile: the share of baseline years at or below the value. Verdict words: below 10th "well below", 10th to 25th "below", 25th to 75th "near typical", 75th to 90th "above", over 90th "well above". A value within half a fire cell-day of the median is "near typical" whatever its percentile (in quiet months many years tie at 0). The number is always shown next to the words.</li>
        <li>The unfinished month ({m.last_month}, data to {m.last_day}) is compared with the same days in earlier years, never with whole months.</li>
        <li>Not compared at all: months with days when no satellite flew (July to September 2002), and raw Aqua MODIS from July 2021, when its orbit had drifted. Raw Aqua comparisons for earlier months leave the drifted years out of the baseline; raw S-NPP and NOAA-20 are compared only with the years they flew.</li>
        <li>Colours: the fire cell ramp is rebuilt from the months you choose, so it always uses the whole ramp. Region tints show the verdict for the last chosen month.</li>
      </ul>

      <h2>Limits</h2>
      <ul>
        <li>Each FIRMS detection (hotspot) is a thermal anomaly: a satellite pixel flagged as hotter than its surroundings, usually a fire but not a confirmed one. The cleaning removes volcanoes, industrial sites and other static heat sources, but some non-fire heat can remain.</li>
        <li>Fire cell-days measure observed burning activity, not burned area or number of fires. Zero detections is not "no fire": cloud, smoke and gaps between passes hide fires.</li>
        <li>They measure spread, not intensity: one catastrophic fire fills few cells. Sardinia's July 2021 (the Montiferru fire) ranks 8th of 25 Julys.</li>
        <li>A single converted month is uncertain: half the width of its 90% range is typically about ±35% of the value in California and Sicily and ±75% in mainland Italy, and wider in Sardinia and in quiet months.</li>
        <li>No Terra: the record starts in July 2002 and has no morning pass. July to September 2002 have days with no satellite at all (marked in the calendar).</li>
        <li>Months from {m.nrt_from} use near-real-time data and may change when standard-quality data replace them.</li>
        <li>Clouds are assumed to hide fires equally from satellites passing at the same time; two passes in one day or night count once.</li>
      </ul>

      <h2>Data products</h2>
      <table>
        <thead><tr><th>Product</th><th>Version</th><th>Source</th><th>From</th></tr></thead>
        <tbody>
          {m.sensors.map((s) => <tr key={s.key}><td>{s.label}</td><td>{s.version}</td><td>{s.source}</td><td>{s.first_month}</td></tr>)}
        </tbody>
      </table>
      <p className="small">Dataset: {m.dataset_name}. Method: {m.method.name} ({m.method.version}). Generated {m.generated_at}.</p>

      <h2>Data and credits</h2>
      <ul>
        <li>
          Fire detections: <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>, MODIS Collection 6.1 (Aqua) and VIIRS 375 m (Suomi NPP, NOAA-20).
          Standard data come from the swath products MYD14 C6.1 (<a href="https://doi.org/10.5067/MODIS/MYD14.061">doi:10.5067/MODIS/MYD14.061</a>),
          VNP14IMG v2 (<a href="https://doi.org/10.5067/VIIRS/VNP14IMG.002">doi:10.5067/VIIRS/VNP14IMG.002</a>) and VJ114IMG v2
          (<a href="https://doi.org/10.5067/VIIRS/VJ114IMG.002">doi:10.5067/VIIRS/VJ114IMG.002</a>); near real-time data from MCD14DL C6.1
          (<a href="https://doi.org/10.5067/FIRMS/MODIS/MCD14DL.NRT.0061">doi:10.5067/FIRMS/MODIS/MCD14DL.NRT.0061</a>), VNP14IMGT
          (<a href="https://doi.org/10.5067/FIRMS/VIIRS/VNP14IMGT_NRT.002">doi:10.5067/FIRMS/VIIRS/VNP14IMGT_NRT.002</a>) and VJ114IMGT
          (<a href="https://doi.org/10.5067/FIRMS/VIIRS/VJ114IMGT_NRT.002">doi:10.5067/FIRMS/VIIRS/VJ114IMGT_NRT.002</a>).
        </li>
        <li>
          We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS)
          (<a href="https://earthdata.nasa.gov/firms">https://earthdata.nasa.gov/firms</a>), part of NASA's Land, Atmosphere Near real-time Capability for
          Earth observations (LANCE) (<a href="https://earthdata.nasa.gov/lance">https://earthdata.nasa.gov/lance</a>) and NASA's Earth Science Data and
          Information System (ESDIS).
        </li>
        <li>
          FIRMS data are provided "as is", without warranty of any kind (see the FIRMS site above). Fire detections can be missed or misplaced, so this record is not for tactical decisions during a fire.
        </li>
        <li>Region outlines: Italian regions from ISTAT (via openpolis/geojson-italy), California from the US Census Bureau (TIGER 2010), neighbouring countries from Natural Earth.</li>
        <li>Globe imagery: <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api">NASA GIBS</a> (Blue Marble, Black Marble).</li>
        <li>Borders and place names: <a href="https://openfreemap.org">OpenFreeMap</a>, © <a href="https://www.openmaptiles.org/">OpenMapTiles</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.</li>
        <li>Built for the NASA International Space Apps Challenge 2026. Not an official NASA product, and not an official warning service.</li>
      </ul>

      <h2>Use of AI</h2>
      <p>The data pipeline, the harmonization code and its write-up, and this app were produced with AI assistance (Claude) from the team's own decisions, and reviewed by the team. See docs/AI_USE.md in the repository.</p>
    </div>
  )
}
