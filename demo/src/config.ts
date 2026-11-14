// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Every tunable number in one place. Values marked TO CONFIRM must be agreed with Pierre/Andre.

/** Folder under public/data/ to load. "_mock" in the demo; the real dataset name when Andre's files land. */
export const DATASET: string = import.meta.env.VITE_DATASET ?? '_mock'

/** Colour ramp for counts. Bins are recomputed from the values inside the selected months. TO TUNE with real data. */
export const RAMP = { method: 'quantile' as 'quantile' | 'log', bins: 7 }

/** Relative anomaly denominator floor, in hotspots, so near-zero medians (UK winters) don't explode. TO CONFIRM. */
export const MIN_DENOMINATOR = 5

/** Percentile cut-offs for the verdict words: well below | below | near typical | above | well above. TO CONFIRM. */
export const VERDICT_THRESHOLDS: [number, number, number, number] = [10, 25, 75, 90]

/** Largest area a user can select, in km², so a selection loads only a few tiles. */
export const MAX_AREA_KM2 = 10_000_000

/** Fewest baseline years needed before we print a comparison. */
export const MIN_BASELINE_YEARS = 3
