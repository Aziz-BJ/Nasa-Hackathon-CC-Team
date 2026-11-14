// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useState } from 'react'
import type { DataSource } from '../lib/data'
import type { Manifest, OverviewFile, ReportedFile } from '../lib/types'

export interface Dataset {
  manifest: Manifest | null
  overview: OverviewFile | null
  reported: ReportedFile | null
  error: string | null
}

export function useDataset(ds: DataSource): Dataset {
  const [state, setState] = useState<Dataset>({ manifest: null, overview: null, reported: null, error: null })
  useEffect(() => {
    let alive = true
    Promise.all([ds.manifest(), ds.overview().catch(() => null), ds.reported()])
      .then(([manifest, overview, reported]) => { if (alive) setState({ manifest, overview, reported, error: null }) })
      .catch((e: unknown) => { if (alive) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) })) })
    return () => { alive = false }
  }, [ds])
  return state
}
