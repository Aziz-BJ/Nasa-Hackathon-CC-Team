// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useState } from 'react'
import { coverageOf, regionsTouching, selectCells, seriesFromCells, seriesFromRegions, type AreaSeries, type Selection } from '../lib/aggregate'
import type { Area } from '../lib/area'
import type { DataSource, Outlines } from '../lib/data'
import type { Manifest, RegionsFile } from '../lib/types'

export interface AreaData {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** The 5 km fire cells inside the area (for the map, and the numbers of drawn shapes). */
  selection: Selection | null
  series: AreaSeries | null
  coverage: 'none' | 'partial' | 'full'
  error: string | null
}

const IDLE: AreaData = { status: 'idle', selection: null, series: null, coverage: 'none', error: null }

export function useAreaData(ds: DataSource, m: Manifest, rf: RegionsFile, outlines: Outlines | null, area: Area | null): AreaData {
  const [state, setState] = useState<AreaData>(IDLE)
  useEffect(() => {
    if (!area) { setState(IDLE); return }
    let alive = true
    const coverage = coverageOf(outlines, area)
    // Whole regions have their numbers already; only the map cells still need to load.
    const regionSeries = area.regionIds ? seriesFromRegions(m, rf, area.regionIds) : null
    setState({ status: 'loading', selection: null, series: regionSeries, coverage, error: null })
    const ids = coverage === 'none' ? [] : regionsTouching(m, area)
    Promise.all(ids.map((id) => ds.cells(id)))
      .then((files) => {
        if (!alive) return
        const selection = selectCells(area, files)
        setState({ status: 'ready', selection, series: regionSeries ?? seriesFromCells(m, rf, selection), coverage, error: null })
      })
      .catch((e: unknown) => {
        if (alive) setState({ ...IDLE, series: regionSeries, status: 'error', coverage, error: e instanceof Error ? e.message : String(e) })
      })
    return () => { alive = false }
  }, [ds, m, rf, outlines, area])
  return state
}
