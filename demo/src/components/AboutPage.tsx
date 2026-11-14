// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Method text is a placeholder until Pierre and Guido write it (docs/METHODS.md). Do not invent the method here.
import type { Manifest } from '../lib/types'

export function AboutPage({ manifest }: { manifest: Manifest }) {
  const m = manifest
  return (
    <div className="about">
      <h2>What this shows</h2>
      <p>
        A monthly calendar of satellite fire detections ("hotspots") for any area you choose, from the early 2000s to now,
        and how the latest month compares with previous years. NASA's fire record comes from two instruments: MODIS (since 2000)
        and VIIRS (since 2012). They detect fires at different sizes, so joining them without correction shows a false rise in 2012.
        This tool puts both on one scale.
      </p>
      <div className="notice">
        This is a historical record of satellite detections, not a warning system. For current fires see the{' '}
        <a href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS Fire Map</a>; for official warnings follow your local authorities.
      </div>

      <h2>Data</h2>
      <table>
        <thead><tr><th>Product</th><th>Version</th><th>Source</th><th>Months used</th></tr></thead>
        <tbody>
          {m.sensors.map((s) => <tr key={s.key}><td>{s.label}</td><td>{s.version}</td><td>{s.source}</td><td>{s.first_month} to {s.last_month}</td></tr>)}
        </tbody>
      </table>
      <p className="small">
        Filters: fire type {m.filters.type.join(', ')} (0 = presumed vegetation fire); MODIS confidence ≥ {m.filters.modis_confidence_min};
        VIIRS confidence {m.filters.viirs_confidence.join(', ')}. Grid: {m.grid_deg}° cells. Months from {m.nrt_from} are near real-time (provisional) and will be replaced by standard data.
        All times UTC. Dataset generated {m.generated_at}.
      </p>

      <h2>Method</h2>
      <p>{m.method.name} (version {m.method.version}). Reference scale: {m.method.reference_scale}.
        {m.method.fit_years && ` Fitted on ${m.method.fit_years[0]} to ${m.method.fit_years[1]}`}
        {m.method.test_years && `, tested on ${m.method.test_years[0]} to ${m.method.test_years[1]}.`}
      </p>
      <p>Validation: {m.validation.metric} {m.validation.value ?? ''}. {m.validation.notes}</p>

      <h2>How the comparisons work</h2>
      <ul>
        <li>Baseline: {m.baseline_years[0]} to {m.baseline_years[1]}, same calendar month. A month is never part of its own baseline.</li>
        <li>Typical month: the median of the baseline years. Average: the mean. We show both because a few extreme years pull the mean up.</li>
        <li>Verdict words come from the percentile: below 10th "well below", 10th to 25th "below", 25th to 75th "near typical", 75th to 90th "above", over 90th "well above". The number is always shown next to the words.</li>
        <li>Colours: count colours are rebuilt from the months you choose, so they always use the whole ramp. Choose "whole record" to compare with all years instead.</li>
      </ul>

      <h2>Limits</h2>
      <ul>
        <li>A hotspot is a hot pixel seen by a satellite, not a confirmed fire. One large fire can make many hotspots.</li>
        <li>Hotspot counts must not be used to estimate burned area.</li>
        <li>No detection does not mean no fire: cloud, smoke, small or smouldering fires and gaps between satellite passes all hide fires.</li>
        <li>Industrial heat, gas flares and volcanoes are filtered by the FIRMS "type" field where available.</li>
        <li>The sensors in use change over time (Terra, Aqua, S-NPP until November 2026, NOAA-20, NOAA-21). Each comparison names its baseline years.</li>
        <li>Area edges are approximate to one grid cell.</li>
      </ul>

      <h2>Use of AI</h2>
      <p>Parts of this app's code were generated with AI assistance (Claude) and reviewed by the team. The harmonization method is the team's own work. See docs/AI_USE.md in the repository.</p>
    </div>
  )
}
