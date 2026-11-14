// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Checkpoint 2 version: globe, area selection and area summary. Replaced at checkpoints 3 and 4.
import { useMemo, useReducer, useState } from 'react'
import { AboutPage } from './components/AboutPage'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { Footer } from './components/Footer'
import { GlobeMap } from './components/GlobeMap'
import { Header } from './components/Header'
import { Legend } from './components/Legend'
import { MockBanner } from './components/MockBanner'
import { RAMP } from './config'
import { dataSource } from './dataSource'
import { useAreaData } from './hooks/useAreaData'
import { useDataset } from './hooks/useDataset'
import { cellTotals } from './lib/aggregate'
import { areaFromPreset, validateDrawn } from './lib/area'
import { buildCountScale } from './lib/colorScale'
import { cellsToFeatures, EMPTY_FC, overviewToFeatures } from './lib/mapFeatures'
import { labelYm } from './lib/months'
import type { Manifest } from './lib/types'
import { initialState, reducer, type AppState } from './state/appState'

export default function App() {
  const { manifest, overview, reported, error } = useDataset(dataSource)
  if (error) return <p className="error" role="alert" style={{ padding: '2rem' }}>Could not load the dataset: {error}</p>
  if (!manifest) return <p style={{ padding: '2rem' }}>Loading data…</p>
  return <Explorer manifest={manifest} overview={overview} reported={reported} />
}

function Explorer({ manifest: m, overview }: { manifest: Manifest } & Pick<ReturnType<typeof useDataset>, 'overview' | 'reported'>) {
  const [s, dispatch] = useReducer(reducer, m, (mm): AppState => {
    const init = initialState(mm)
    return mm.presets[0] ? { ...init, area: areaFromPreset(mm.presets[0]) } : init
  })
  const data = useAreaData(dataSource, m, s.area)
  const [drawError, setDrawError] = useState<string | null>(null)
  const series = data.series
  const i0 = series ? series.months.indexOf(s.from) : -1
  const i1 = series ? series.months.indexOf(s.to) : -1

  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.grid_deg, scale), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.grid_deg])
  const overviewFc = useMemo(() => (overview ? overviewToFeatures(overview, s.palette) : EMPTY_FC), [overview, s.palette])

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to main content</a>
      {m.mock && <MockBanner />}
      <Header view={s.view} onView={(view) => dispatch({ type: 'setView', view })} />
      {s.view === 'about' ? <AboutPage manifest={m} /> : (
        <main className="explore" id="main">
          <aside className="controls" aria-label="Choose an area and months">
            <AreaPanel presets={m.presets} area={s.area} tool={s.tool} error={drawError}
              onTool={(tool) => dispatch({ type: 'setTool', tool })}
              onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
          </aside>
          <section className="map-col" aria-label="Map">
            <div className="globe-wrap">
              <GlobeMap area={s.area} cells={cells} overview={overviewFc} tool={s.tool} basemap={s.basemap} labels={s.labels}
                onDrawn={(area) => {
                  const err = validateDrawn(area)
                  setDrawError(err)
                  dispatch(err ? { type: 'setTool', tool: 'pan' } : { type: 'setArea', area })
                }} />
            </div>
            {mapScale && <Legend scale={mapScale} title={`Hotspots per ${m.grid_deg}° cell, ${labelYm(s.from)} to ${labelYm(s.to)} (bins fit these months)`} />}
            <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
          </section>
          <section className="results" id="results" aria-label="Results" tabIndex={-1}>
            <p className="muted">The burning calendar arrives at checkpoint 3.</p>
          </section>
        </main>
      )}
      <Footer />
    </div>
  )
}
