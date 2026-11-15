// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Every tunable number in one place.

/** Folder under public/data/ to load, written by scripts/import-data.ts. */
export const DATASET: string = import.meta.env.VITE_DATASET ?? 'real'

/** Colour ramp for counts. Bins are recomputed from the values inside the selected months. */
export const RAMP = { method: 'quantile' as 'quantile' | 'log', bins: 7 }

/** Below this median (fire cell-days) the app shows the plain difference instead of a percentage (winter months). */
export const MIN_DENOMINATOR = 5

/** Percentile cut-offs for the verdict words: well below | below | near typical | above | well above. */
export const VERDICT_THRESHOLDS: [number, number, number, number] = [10, 25, 75, 90]

/** Largest shape a user can draw, in km². */
export const MAX_AREA_KM2 = 10_000_000

/** Fewest baseline years needed before we print a comparison. */
export const MIN_BASELINE_YEARS = 3
