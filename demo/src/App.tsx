// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Checkpoint 3 version: adds Dates and Calendar. Replaced at checkpoint 4.
// Map-first layout: the globe fills the screen; feature boxes around it open side drawers;
// the bottom strip holds the legend, a one-line verdict and "More info".
import { CalendarBlank, Info, MapPin, Stack, Table } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { AboutPage } from './components/AboutPage'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { BurningCalendar } from './components/BurningCalendar'
import { DisplayOptions } from './components/DisplayOptions'
import { GlobeMap } from './components/GlobeMap'
import { CompactLegend, Legend } from './components/Legend'
import { MockBanner } from './components/MockBanner'
import { BottomStrip } from './components/shell/BottomStrip'
import { Drawer } from './components/shell/Drawer'
import { FeatureRail, type FeatureBox } from './components/shell/FeatureRail'
import { GuideTour, guideSeen, markGuideSeen, type GuideStep } from './components/shell/GuideTour'
import { TopBar } from './components/shell/TopBar'
import { TimeRangePicker } from './components/TimeRangePicker'
import { RAMP } from './config'
import { dataSource } from './dataSource'
import { useAreaData } from './hooks/useAreaData'
import { useDataset } from './hooks/useDataset'
import { cellTotals } from './lib/aggregate'
import { areaFromPreset, validateDrawn } from './lib/area'
import { buildCountScale, fmtCount } from './lib/colorScale'
import { calendarMedians, summarizeMonth, VERDICT_LABELS } from './lib/indices'
import { cellsToFeatures, EMPTY_FC, overviewToFeatures } from './lib/mapFeatures'
import { labelYm, longLabelYm, type YearMonth } from './lib/months'
import { monthStatus, sensorsIn } from './lib/status'
import { SERIES_LABELS, type Manifest, type SeriesKey } from './lib/types'
import { initialState, quickRanges, reducer, type AppState } from './state/appState'

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
  const [hoverMonth, setHoverMonth] = useState<YearMonth | null>(null)
  const [panel, setPanel] = useState<string | null>(null)
  // What each drawer shows. Kept after closing so the drawer slides out with its content.
  const [shown, setShown] = useState<Record<Side, string | null>>({ left: null, right: s.view === 'about' ? 'about' : null })
  const [more, setMore] = useState(false)
  const [guide, setGuide] = useState(() => !guideSeen())
  useEffect(() => setHoverMonth(null), [s.area, s.source])

  const series = data.series
  const i0 = series ? series.months.indexOf(s.from) : -1
  const i1 = series ? series.months.indexOf(s.to) : -1
  const values = useMemo(() => series?.values[s.source] ?? [], [series, s.source])
  const seriesLabel = SERIES_LABELS[s.source]
  const ready = !!series && data.status === 'ready' && data.coverage !== 'none' && i0 >= 0 && i1 >= 0

  // The calendar's median row is coloured too, so the medians join the bins and the legend covers them.
  const medians = useMemo(() => (series ? calendarMedians(values, series.months, m.baseline_years) : []), [series, values, m.baseline_years])
  const calendarScale = useMemo(() => buildCountScale(
    [...(s.scaleTo === 'range' && i0 >= 0 ? values.slice(i0, i1 + 1) : values), ...medians],
    { ...RAMP, palette: s.palette },
  ), [values, medians, i0, i1, s.scaleTo, s.palette])

  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.grid_deg, scale), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.grid_deg])
  const overviewFc = useMemo(() => (overview ? overviewToFeatures(overview, s.palette) : EMPTY_FC), [overview, s.palette])

  const focus = series ? summarizeMonth(values, series.months, s.to, m.baseline_years) : null
  const needsArea = <p className="muted">Choose an area with data first (Area box on the left).</p>

  const panels: Panel[] = [
    { id: 'area', side: 'left', label: 'Area', icon: <MapPin aria-hidden />, title: 'Choose an area',
      guide: 'Pick a preset region, draw a circle, box or any shape on the globe, or type coordinates.',
      body: () => <>
        <AreaPanel presets={m.presets} area={s.area} tool={s.tool} error={drawError}
          onTool={(tool) => dispatch({ type: 'setTool', tool })}
          onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
        <AreaSummary area={s.area} data={data} gridDeg={m.grid_deg} />
      </> },
    { id: 'dates', side: 'left', label: 'Dates', icon: <CalendarBlank aria-hidden />, title: 'Choose months',
      guide: 'Choose the months to look at. Colours rescale to the months you pick.',
      body: () => <TimeRangePicker first={m.harmonized_coverage[0]} last={m.last_month} from={s.from} to={s.to}
        quick={quickRanges(m)} onChange={(from, to) => dispatch({ type: 'setRange', from, to })} /> },
    { id: 'layers', side: 'left', label: 'Layers', icon: <Stack aria-hidden />, title: 'Layers and colours',
      guide: 'Switch between the harmonized record and raw MODIS or VIIRS, and change colours, imagery and labels.',
      body: () => <DisplayOptions source={s.source} scaleTo={s.scaleTo} palette={s.palette} basemap={s.basemap} labels={s.labels}
        onSource={(source) => dispatch({ type: 'setSource', source })}
        onScaleTo={(scaleTo) => dispatch({ type: 'setScaleTo', scaleTo })}
        onPalette={(palette) => dispatch({ type: 'setPalette', palette })}
        onBasemap={(basemap) => dispatch({ type: 'setBasemap', basemap })}
        onLabels={(labels) => dispatch({ type: 'setLabels', labels })} /> },
    { id: 'calendar', side: 'right', wide: true, label: 'Calendar', icon: <Table aria-hidden />, title: 'Burning calendar',
      guide: 'Every month since 2000 as a grid: which seasons and which years had the most hotspots.',
      body: () => !ready ? needsArea : <>
        <Legend id="cal-legend" scale={calendarScale} showNrt
          title={s.scaleTo === 'range' ? `Hotspots per month (bins fit ${labelYm(s.from)} to ${labelYm(s.to)})` : 'Hotspots per month (bins fit the whole record)'} />
        <BurningCalendar months={series.months} values={values} from={s.from} to={s.to} scale={calendarScale} medians={medians}
          statusOf={(ym) => monthStatus(m, ym, s.source)} baselineYears={m.baseline_years} seriesLabel={seriesLabel}
          legendId="cal-legend" onFocusMonth={setHoverMonth} />
        <CellDetail ym={hoverMonth} values={values} months={series.months} manifest={m} seriesLabel={seriesLabel} source={s.source} />
      </> },
  ]
  const about: Panel = { id: 'about', side: 'right', wide: true, label: 'About', icon: <Info aria-hidden />, title: 'About and methods',
    guide: '', body: () => <AboutPage manifest={m} /> }
  const openId = s.view === 'about' ? 'about' : panel
  const byId = (id: string | null) => [...panels, about].find((p) => p.id === id) ?? null

  // On phones a drawer and the expanded strip would cover each other, so only one of them is open at a time.
  const narrow = () => window.matchMedia('(max-width: 760px)').matches
  const closePanel = useCallback(() => {
    if (s.view === 'about') {
      dispatch({ type: 'setView', view: 'explore' })
      document.querySelector<HTMLElement>('[data-tour="about"]')?.focus()
      return
    }
    const id = panel
    setPanel(null)
    if (id) document.querySelector<HTMLElement>(`[data-tour="box-${id}"]`)?.focus()
  }, [panel, s.view])
  const openPanel = (id: string, toggle = false) => {
    if (s.view === 'about') dispatch({ type: 'setView', view: 'explore' })
    const p = byId(id)
    if (p) setShown((sh) => ({ ...sh, [p.side]: id }))
    setPanel((cur) => (toggle && cur === id ? null : id))
    if (narrow()) setMore(false)
  }
  const togglePanel = (id: string) => openPanel(id, true)
  const toggleAbout = () => {
    setPanel(null)
    setShown((sh) => ({ ...sh, right: 'about' }))
    if (narrow()) setMore(false)
    dispatch({ type: 'setView', view: s.view === 'about' ? 'explore' : 'about' })
  }
  const toggleMore = () => {
    if (!more && narrow()) {
      setPanel(null)
      if (s.view === 'about') dispatch({ type: 'setView', view: 'explore' })
    }
    setMore((x) => !x)
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
    // A month that is not finished gets no verdict: its total is still growing.
    : monthStatus(m, s.to) === 'partial' ? <><strong>{longLabelYm(s.to)}</strong> (month to date): {fmtCount(focus.value)} hotspots so far · not comparable until the month ends</>
    : <><strong>{longLabelYm(s.to)}</strong>: {Math.round(focus.value).toLocaleString('en-GB')} hotspots
        {focus.verdict && focus.percentile !== null && <> · <span className={`verdict verdict-${focus.verdict}`}>{VERDICT_LABELS[focus.verdict]}</span> ({ordinal(Math.round(focus.percentile))} percentile)</>}</>

  return (
    <div className={m.mock ? 'app has-banner' : 'app'}>
      <a href="#main" className="skip-link">Skip to main content</a>
      {m.mock && <MockBanner />}
      <TopBar selection={selection} onSelectionClick={() => openPanel('area')} onGuide={() => setGuide(true)} onAbout={toggleAbout} />
      <main id="main" tabIndex={-1}>
        <div className="rails">
          <FeatureRail side="left" label="Choose what to show" boxes={panels.filter((p) => p.side === 'left')} open={panel} onToggle={togglePanel} />
          <FeatureRail side="right" label="Analysis" boxes={panels.filter((p) => p.side === 'right')} open={panel} onToggle={togglePanel} />
        </div>
        {/* Both drawers are always in the page, so even the first opening slides in. */}
        {(['left', 'right'] as const).map((side) => {
          const p = byId(shown[side])
          return (
            <Drawer key={side} open={!!p && openId === p.id} side={side} wide={p?.wide} title={p?.title ?? ''} onClose={closePanel}>{p?.body()}</Drawer>
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
      <BottomStrip expanded={more} onToggle={toggleMore} headline={headline}
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

function CellDetail({ ym, values, months, manifest, seriesLabel, source }: {
  ym: YearMonth | null; values: (number | null)[]; months: YearMonth[]; manifest: Manifest; seriesLabel: string; source: SeriesKey
}) {
  if (!ym) return <p className="cell-detail muted small">Hover or use the arrow keys on the calendar to see one month in detail.</p>
  const sum = summarizeMonth(values, months, ym, manifest.baseline_years)
  const sensors = sensorsIn(manifest, ym).map((x) => x.label).join(', ') || 'none'
  const [y0, y1] = manifest.baseline_years
  let compare = ''
  if (monthStatus(manifest, ym, source) === 'partial') compare = 'Month to date: not comparable with full months yet. '
  else if (sum.rank && sum.baseline && sum.value !== null) {
    const med = sum.baseline.median
    compare = `Rank ${sum.rank.rank} of ${sum.rank.of} for this calendar month; `
      + (med > 0 ? `${Math.round((sum.value / med) * 100)}% of the ${y0}–${y1} median (${fmtCount(med)}). ` : `the ${y0}–${y1} median is 0. `)
  }
  return (
    <p className="cell-detail" aria-live="polite">
      <strong>{labelYm(ym)}</strong>: {sum.value === null ? 'no data' : `${fmtCount(sum.value)} hotspots detected`} ({seriesLabel}). {compare}Sensors: {sensors}.
    </p>
  )
}
