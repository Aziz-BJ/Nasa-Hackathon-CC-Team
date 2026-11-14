// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Checkpoint 2 version: globe, Area and Layers, bottom strip and guide. Replaced at checkpoint 3.
// Map-first layout: the globe fills the screen; feature boxes around it open side drawers;
// the bottom strip holds the legend, a one-line verdict and "More info".
import { Info, MapPin, Stack } from '@phosphor-icons/react'
import { useCallback, useMemo, useReducer, useState, type ReactNode } from 'react'
import { AboutPage } from './components/AboutPage'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { DisplayOptions } from './components/DisplayOptions'
import { GlobeMap } from './components/GlobeMap'
import { CompactLegend } from './components/Legend'
import { MockBanner } from './components/MockBanner'
import { BottomStrip } from './components/shell/BottomStrip'
import { Drawer } from './components/shell/Drawer'
import { FeatureRail, type FeatureBox } from './components/shell/FeatureRail'
import { GuideTour, guideSeen, markGuideSeen, type GuideStep } from './components/shell/GuideTour'
import { TopBar } from './components/shell/TopBar'
import { RAMP } from './config'
import { dataSource } from './dataSource'
import { useAreaData } from './hooks/useAreaData'
import { useDataset } from './hooks/useDataset'
import { cellTotals } from './lib/aggregate'
import { areaFromPreset, validateDrawn } from './lib/area'
import { buildCountScale } from './lib/colorScale'
import { summarizeMonth, VERDICT_LABELS } from './lib/indices'
import { cellsToFeatures, EMPTY_FC, overviewToFeatures } from './lib/mapFeatures'
import { labelYm, longLabelYm } from './lib/months'
import type { Manifest } from './lib/types'
import { initialState, reducer, type AppState } from './state/appState'

export default function App() {
  const { manifest, overview, reported, error } = useDataset(dataSource)
  if (error) return <p className="error" role="alert" style={{ padding: '2rem' }}>Could not load the dataset: {error}</p>
  if (!manifest) return <p style={{ padding: '2rem' }}>Loading data…</p>
  return <Explorer manifest={manifest} overview={overview} reported={reported} />
}

type Side = 'left' | 'right'

interface Panel extends FeatureBox {
  side: Side
  title: string
  wide?: boolean
  /** One sentence for the guide. */
  guide: string
  body: () => ReactNode
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`

function Explorer({ manifest: m, overview }: { manifest: Manifest } & Pick<ReturnType<typeof useDataset>, 'overview' | 'reported'>) {
  const [s, dispatch] = useReducer(reducer, m, (mm): AppState => {
    const init = initialState(mm)
    return mm.presets[0] ? { ...init, area: areaFromPreset(mm.presets[0]) } : init
  })

  const data = useAreaData(dataSource, m, s.area)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [panel, setPanel] = useState<string | null>(null)
  // What each drawer shows. Kept after closing so the drawer slides out with its content.
  const [shown, setShown] = useState<Record<Side, string | null>>({ left: null, right: s.view === 'about' ? 'about' : null })
  const [more, setMore] = useState(false)
  const [guide, setGuide] = useState(() => !guideSeen())

  const series = data.series
  const i0 = series ? series.months.indexOf(s.from) : -1
  const i1 = series ? series.months.indexOf(s.to) : -1
  const values = useMemo(() => series?.values[s.source] ?? [], [series, s.source])

  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.grid_deg, scale), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.grid_deg])
  const overviewFc = useMemo(() => (overview ? overviewToFeatures(overview, s.palette) : EMPTY_FC), [overview, s.palette])

  const focus = series ? summarizeMonth(values, series.months, s.to, m.baseline_years) : null

  const panels: Panel[] = [
    { id: 'area', side: 'left', label: 'Area', icon: <MapPin aria-hidden />, title: 'Choose an area',
      guide: 'Pick a preset region, draw a circle, box or any shape on the globe, or type coordinates.',
      body: () => <>
        <AreaPanel presets={m.presets} area={s.area} tool={s.tool} error={drawError}
          onTool={(tool) => dispatch({ type: 'setTool', tool })}
          onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
        <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
      </> },
    { id: 'layers', side: 'left', label: 'Layers', icon: <Stack aria-hidden />, title: 'Layers and colours',
      guide: 'Switch between the harmonized record and raw MODIS or VIIRS, and change colours, imagery and labels.',
      body: () => <DisplayOptions source={s.source} scaleTo={s.scaleTo} palette={s.palette} basemap={s.basemap} labels={s.labels}
        onSource={(source) => dispatch({ type: 'setSource', source })}
        onScaleTo={(scaleTo) => dispatch({ type: 'setScaleTo', scaleTo })}
        onPalette={(palette) => dispatch({ type: 'setPalette', palette })}
        onBasemap={(basemap) => dispatch({ type: 'setBasemap', basemap })}
        onLabels={(labels) => dispatch({ type: 'setLabels', labels })} /> },
  ]
  const about: Panel = { id: 'about', side: 'right', wide: true, label: 'About', icon: <Info aria-hidden />, title: 'About and methods',
    guide: '', body: () => <AboutPage manifest={m} /> }
  const openId = s.view === 'about' ? 'about' : panel
  const byId = (id: string | null) => [...panels, about].find((p) => p.id === id) ?? null

  const closePanel = useCallback(() => {
    if (s.view === 'about') { dispatch({ type: 'setView', view: 'explore' }); return }
    const id = panel
    setPanel(null)
    if (id) document.querySelector<HTMLElement>(`[data-tour="box-${id}"]`)?.focus()
  }, [panel, s.view])
  const togglePanel = (id: string) => {
    if (s.view === 'about') dispatch({ type: 'setView', view: 'explore' })
    const p = byId(id)
    if (p) setShown((sh) => ({ ...sh, [p.side]: id }))
    setPanel((cur) => (cur === id ? null : id))
  }
  const toggleAbout = () => {
    setPanel(null)
    setShown((sh) => ({ ...sh, right: 'about' }))
    dispatch({ type: 'setView', view: s.view === 'about' ? 'explore' : 'about' })
  }

  const guideSteps: GuideStep[] = [
    { target: null, title: 'Welcome', text: 'This globe shows where satellites detected fire hotspots, from 2000 to now. Colours show how many, for the area and months you choose.' },
    ...panels.map((p) => ({ target: `box-${p.id}`, title: p.label, text: p.guide })),
    { target: 'strip', title: 'Legend and summary', text: 'What the colours mean. Press More info for the verdict: is the latest month unusual for this area?' },
    { target: 'guide', title: 'Guide', text: 'Open this guide again any time.' },
  ]
  const closeGuide = () => { markGuideSeen(); setGuide(false) }

  const selection = `${s.area?.label ?? 'No area'}, ${labelYm(s.from)} – ${labelYm(s.to)}`
  const headline: ReactNode = !s.area ? 'Choose an area to begin.'
    : data.coverage === 'none' ? 'No data is loaded for this area yet.'
    : !focus || focus.value === null ? `${s.area.label}: loading…`
    : <><strong>{longLabelYm(s.to)}</strong>: {Math.round(focus.value).toLocaleString('en-GB')} hotspots
        {focus.verdict && focus.percentile !== null && <> · <span className={`verdict verdict-${focus.verdict}`}>{VERDICT_LABELS[focus.verdict]}</span> ({ordinal(Math.round(focus.percentile))} percentile)</>}</>

  return (
    <div className={m.mock ? 'app has-banner' : 'app'}>
      <a href="#main" className="skip-link">Skip to main content</a>
      {m.mock && <MockBanner />}
      <TopBar selection={selection} onSelectionClick={() => togglePanel('area')} onGuide={() => setGuide(true)} onAbout={toggleAbout} />
      <main id="main" tabIndex={-1}>
        <div className="rails">
          <FeatureRail side="left" label="Choose what to show" boxes={panels.filter((p) => p.side === 'left')} open={panel} onToggle={togglePanel} />
          <FeatureRail side="right" label="Analysis" boxes={panels.filter((p) => p.side === 'right')} open={panel} onToggle={togglePanel} />
        </div>
        {(['left', 'right'] as const).map((side) => {
          const p = byId(shown[side])
          return p && (
            <Drawer key={side} open={openId === p.id} side={side} wide={p.wide} title={p.title} onClose={closePanel}>{p.body()}</Drawer>
          )
        })}
        <div className="map-full">
          <GlobeMap area={s.area} cells={cells} overview={overviewFc} tool={s.tool} basemap={s.basemap} labels={s.labels}
            onDrawn={(area) => {
              const err = validateDrawn(area)
              setDrawError(err)
              dispatch(err ? { type: 'setTool', tool: 'pan' } : { type: 'setArea', area })
            }} />
        </div>
      </main>
      <BottomStrip expanded={more} onToggle={() => setMore((x) => !x)} headline={headline}
        legend={mapScale
          ? <CompactLegend scale={mapScale} title={`Hotspots per ${m.grid_deg}° cell, ${labelYm(s.from)} – ${labelYm(s.to)} (colours fit these months)`} />
          : <span className="small muted">Choose an area to colour the globe.</span>}
        more={<>
          <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
          <p className="small muted">Colours show satellite hotspot detections, not fires or burned area. They are rebuilt for the months you choose, so the full ramp is always used.</p>
        </>} />
      {guide && <GuideTour steps={guideSteps} onClose={closeGuide} />}
    </div>
  )
}
