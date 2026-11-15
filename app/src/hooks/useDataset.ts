// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useCallback, useEffect, useState } from 'react'
import { validateRegions, type DataSource, type Outlines } from '../lib/data'
import type { Manifest, RegionsFile, ReportedFile } from '../lib/types'

export interface Dataset {
  manifest: Manifest | null
  regions: RegionsFile | null
  /** Region outlines for the map. The app still works without them (areas fall back to boxes). */
  outlines: Outlines | null
  reported: ReportedFile | null
  error: string | null
  /** Load again after an error. */
  retry: () => void
}

/**
 * How long the first screen waits for the optional files once the required ones are in. They usually arrive together;
 * a slow or broken optional file must not hold the app back, and it still appears if it arrives later.
 */
export const OPTIONAL_GRACE_MS = 4000

type Files = Omit<Dataset, 'retry'>
const EMPTY: Files = { manifest: null, regions: null, outlines: null, reported: null, error: null }

export function useDataset(ds: DataSource, graceMs = OPTIONAL_GRACE_MS): Dataset {
  const [state, setState] = useState<Files>(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => { setState(EMPTY); setAttempt((n) => n + 1) }, [])
  useEffect(() => {
    let alive = true
    const set = (patch: Partial<Files>) => { if (alive) setState((s) => ({ ...s, ...patch })) }
    const outlines = ds.outlines().catch((e: unknown) => {
      console.warn('Region outlines unavailable, drawing region boxes instead:', e instanceof Error ? e.message : e)
      return null
    })
    const reported = ds.reported()
    void outlines.then((o) => set({ outlines: o }))
    void reported.then((r) => set({ reported: r }))
    Promise.all([ds.manifest(), ds.regions()])
      .then(async ([manifest, raw]) => {
        const regions = validateRegions(raw, manifest)
        // Give the optional files a moment so the first screen already draws region outlines.
        await Promise.race([Promise.all([outlines, reported]), new Promise((ok) => setTimeout(ok, graceMs))])
        set({ manifest, regions, error: null })
      })
      .catch((e: unknown) => set({ error: e instanceof Error ? e.message : String(e) }))
    return () => { alive = false }
  }, [ds, attempt, graceMs])
  return { ...state, retry }
}
