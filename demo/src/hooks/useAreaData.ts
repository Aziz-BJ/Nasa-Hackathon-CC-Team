// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useState } from 'react'
import { aggregate, coverageOf, selectCells, type AreaSeries, type Selection } from '../lib/aggregate'
import type { Area } from '../lib/area'
import type { DataSource } from '../lib/data'
import { tilesForBbox } from '../lib/grid'
import type { Manifest } from '../lib/types'

export interface AreaData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  selection: Selection | null
  series: AreaSeries | null
  coverage: 'none' | 'partial' | 'full'
  error: string | null
}

const IDLE: AreaData = { status: 'idle', selection: null, series: null, coverage: 'none', error: null }

export function useAreaData(ds: DataSource, manifest: Manifest | null, area: Area | null): AreaData {
  const [state, setState] = useState<AreaData>(IDLE)
  useEffect(() => {
    if (!manifest || !area) { setState(IDLE); return }
    let alive = true
    const coverage = coverageOf(manifest, area)
    setState((s) => ({ ...s, status: 'loading', coverage, error: null }))
    const ids = tilesForBbox(area.bbox, manifest.tile_deg).filter((id) => manifest.tiles.includes(id))
    Promise.all(ids.map((id) => ds.tile(id)))
      .then((tiles) => {
        if (!alive) return
        const selection = selectCells(area, tiles, manifest.grid_deg)
        setState({ status: 'ready', selection, series: aggregate(manifest, selection), coverage, error: null })
      })
      .catch((e: unknown) => {
        if (alive) setState({ ...IDLE, status: 'error', coverage, error: e instanceof Error ? e.message : String(e) })
      })
    return () => { alive = false }
  }, [ds, manifest, area])
  return state
}
