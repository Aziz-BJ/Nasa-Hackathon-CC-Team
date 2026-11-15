// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useState } from 'react'
import type { DataSource, Outlines } from '../lib/data'
import type { Manifest, RegionsFile, ReportedFile } from '../lib/types'

export interface Dataset {
  manifest: Manifest | null
  regions: RegionsFile | null
  /** Region outlines for the map. The app still works without them (areas fall back to boxes). */
  outlines: Outlines | null
  reported: ReportedFile | null
  error: string | null
}

export function useDataset(ds: DataSource): Dataset {
  const [state, setState] = useState<Dataset>({ manifest: null, regions: null, outlines: null, reported: null, error: null })
  useEffect(() => {
    let alive = true
    Promise.all([ds.manifest(), ds.regions(), ds.outlines().catch(() => null), ds.reported()])
      .then(([manifest, regions, outlines, reported]) => { if (alive) setState({ manifest, regions, outlines, reported, error: null }) })
      .catch((e: unknown) => { if (alive) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) })) })
    return () => { alive = false }
  }, [ds])
  return state
}
