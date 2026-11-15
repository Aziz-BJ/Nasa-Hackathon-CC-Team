// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Map-first layout: the globe fills the screen; feature boxes around it open side drawers;
// the bottom strip holds the legend, a one-line verdict and "More info".
import { CalendarBlank, ChartLine, DownloadSimple, FireSimple, Info, MapPin, Planet, Stack, Table } from '@phosphor-icons/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { AboutPage } from './components/AboutPage'
import { AreaPanel } from './components/AreaPanel'
import { AreaSummary } from './components/AreaSummary'
import { BurningCalendar } from './components/BurningCalendar'
import { DisplayOptions } from './components/DisplayOptions'
import { ExportButton } from './components/ExportButton'
import { FactorTable } from './components/FactorTable'
import { diff, KpiRow } from './components/KpiRow'
import { DetectionsLegend } from './components/DetectionsLegend'
import { CompactLegend, Legend, VerdictKey } from './components/Legend'
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
import { cellTotals, regionsTouching, seriesFromRegions, type AreaSeries } from './lib/aggregate'
import { areaFromRegion, validateDrawn } from './lib/area'
import { buildCountScale, fmtCount, VERDICT_COLORS } from './lib/colorScale'
import { buildCsv, csvFilename } from './lib/csv'
import type { Outlines } from './lib/data'
import { hotspotsCsv, hotspotsFilename, selectDetections, yearsToLoad } from './lib/detections'
import { saveFile } from './lib/download'
import { calendarMedians, compareWith, summarizeMonth, summarizeMtd, VERDICT_LABELS, yearToDate, type MonthSummary, type VerdictLevel } from './lib/indices'
import { cellsToFeatures, EMPTY_FC, regionsToFeatures } from './lib/mapFeatures'
import { labelYm, longLabelYm, monthRange, MONTH_LONG, parseYm, type YearMonth } from './lib/months'
import { comparableValues, monthIndex, monthStatus, noVerdictReason, sensorsIn, seriesSpan, sourceCode, sourceOf } from './lib/status'
import { SERIES_LABELS, type DetectionsFile, type DetectionsIndex, type Manifest, type RegionsFile, type ReportedFile, type SeriesKey } from './lib/types'
import { initialState, reducer, type AppState } from './state/appState'
import { applyUrl, isEmptyUrl, parseHash, toHash } from './state/urlState'

// The globe (MapLibre, Terra Draw) and the charts (Observable Plot) are most of the code. Loading them separately lets the
// headline numbers appear first on slow connections; they are fetched straight after the first screen.
const loadGlobe = () => import('./components/GlobeMap')
const loadCharts = () => Promise.all([import('./components/SeasonalChart'), import('./components/AnomalyChart'),
  import('./components/OverlapChart'), import('./components/ReportedChart')])
const GlobeMap = lazy(() => loadGlobe().then((x) => ({ default: x.GlobeMap })))
const SeasonalChart = lazy(() => import('./components/SeasonalChart').then((x) => ({ default: x.SeasonalChart })))
const AnomalyChart = lazy(() => import('./components/AnomalyChart').then((x) => ({ default: x.AnomalyChart })))
const OverlapChart = lazy(() => import('./components/OverlapChart').then((x) => ({ default: x.OverlapChart })))
const ReportedChart = lazy(() => import('./components/ReportedChart').then((x) => ({ default: x.ReportedChart })))
void loadGlobe()

const chartFallback = <p className="small muted" role="status">Loading the chart…</p>

export default function App() {
  const { manifest, regions, outlines, reported, error, retry } = useDataset(dataSource)
  useEffect(() => { if (manifest) setTimeout(() => void loadCharts().catch(() => {}), 1500) }, [manifest])
  if (error) {
    return (
      <div className="load-screen" role="alert">
        <p className="load-title">Spark 1</p>
        <p>Could not load the fire record: {error}.</p>
        <p className="small muted">Check the connection and try again.</p>
        <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
      </div>
    )
  }
  if (!manifest || !regions) {
    return (
      <div className="load-screen" role="status">
        <p className="load-title">Spark 1</p>
        <p>Loading the satellite fire record…</p>
      </div>
    )
  }
  return <Explorer manifest={manifest} rf={regions} outlines={outlines} reported={reported} />
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
const VERDICT_ORDER: VerdictLevel[] = ['well-below', 'below', 'typical', 'above', 'well-above']
const NO_VERDICT_COLOR = '#8e8e93'
/** Stable empty list, so the detections memo does not rerun on every render. */
const NO_DETECTION_FILES: DetectionsFile[] = []

/** "1–13 November 2026" for the unfinished month, "October 2026" otherwise. */
function focusLabelOf(m: Manifest, ym: YearMonth): string {
  if (m.month_to_date && ym === m.last_month) {
    const { year, month } = parseYm(ym)
    return `1–${Number(m.last_day.slice(8, 10))} ${MONTH_LONG[month - 1]} ${year}`
  }
  return longLabelYm(ym)
}

/** The comparison for one month: same days of past years for the unfinished month, same month otherwise. */
function compareMonth(m: Manifest, series: AreaSeries, key: SeriesKey, ym: YearMonth): MonthSummary {
  const values = series.values[key]
  if (monthStatus(m, ym, key) === 'partial') {
    // Only the harmonized record has month-to-date values for past years.
    return key === 'harmonized' && series.mtd ? summarizeMtd(series.mtd, ym, m.baseline_years) : compareWith(ym, values[monthIndex(m, ym)], null)
  }
  // Incomplete months and drifted raw Aqua keep their value but are not compared at all (no verdict, rank or median).
  if (noVerdictReason(m, key, ym)) return compareWith(ym, values[monthIndex(m, ym)], null)
  return summarizeMonth(comparableValues(key, series.months, values), series.months, ym, m.baseline_years)
}

function Explorer({ manifest: m, rf, outlines, reported }: { manifest: Manifest; rf: RegionsFile; outlines: Outlines | null; reported: ReportedFile | null }) {
  const [s, dispatch] = useReducer(reducer, m, (mm): AppState => {
    const init = initialState(mm)
    const first = areaFromRegion(mm, outlines, mm.regions[0].id)
    return applyUrl(mm, outlines, parseHash(window.location.hash), { ...init, area: first })
  })
  // Keep the link shareable, and follow links pasted into the same tab.
  useEffect(() => { window.history.replaceState(null, '', toHash(s)) }, [s])
  useEffect(() => {
    const onHash = () => {
      const url = parseHash(window.location.hash)
      if (!isEmptyUrl(url)) dispatch({ type: 'applyUrl', manifest: m, outlines, url })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [m, outlines])

  // Outlines can arrive after the first screen: redraw the chosen region from its outline instead of its box.
  const boxedRegion = s.area?.regionKey && s.area.geometry.type === 'Polygon' ? s.area.regionKey : null
  useEffect(() => {
    if (!outlines || !boxedRegion) return
    const area = areaFromRegion(m, outlines, boxedRegion)
    if (area?.geometry.type === 'MultiPolygon') dispatch({ type: 'setArea', area })
  }, [m, outlines, boxedRegion])

  const data = useAreaData(dataSource, m, rf, outlines, s.area)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const [hoverMonth, setHoverMonth] = useState<YearMonth | null>(null)
  const [panel, setPanel] = useState<string | null>(null)
  // What each drawer shows. Kept after closing so the drawer slides out with its content.
  const [shown, setShown] = useState<Record<Side, string | null>>({ left: null, right: s.view === 'about' ? 'about' : null })
  const [more, setMore] = useState(false)
  const [guide, setGuide] = useState(() => !guideSeen())
  useEffect(() => setHoverMonth(null), [s.area, s.source])

  const chooseRegion = useCallback((key: string) => {
    const area = areaFromRegion(m, outlines, key)
    if (area) { setDrawError(null); dispatch({ type: 'setArea', area }) }
  }, [m, outlines])

  const series = data.series
  const i0 = monthIndex(m, s.from)
  const i1 = monthIndex(m, s.to)
  const values = useMemo(() => series?.values[s.source] ?? [], [series, s.source])
  const seriesLabel = SERIES_LABELS[s.source]
  const unit = m.unit
  // A region keeps its numbers even when its map cells fail to load; only the map needs the cells.
  const noData = data.status === 'ready' && data.coverage === 'none'
  const ready = !!series && !noData && i0 >= 0 && i1 >= 0

  // The calendar's median row is coloured too, so the medians join the bins and the legend covers them.
  const medians = useMemo(() => (series ? calendarMedians(values, series.months, m.baseline_years) : []), [series, values, m.baseline_years])
  const calendarScale = useMemo(() => buildCountScale(
    [...(s.scaleTo === 'range' && i0 >= 0 ? values.slice(i0, i1 + 1) : values), ...medians],
    { ...RAMP, palette: s.palette },
  ), [values, medians, i0, i1, s.scaleTo, s.palette])

  // The area's 5 km fire cells, coloured by their total over the chosen months (bins fit these months).
  const { cells, mapScale } = useMemo(() => {
    if (!data.selection || i0 < 0) return { cells: EMPTY_FC, mapScale: null }
    const totals = cellTotals(data.selection, s.source, i0, i1)
    if (!totals.some((t) => t.total > 0)) return { cells: EMPTY_FC, mapScale: null }
    const scale = buildCountScale(totals.map((t) => t.total), { ...RAMP, palette: s.palette })
    return { cells: cellsToFeatures(totals, m.cell_km, scale, unit), mapScale: scale }
  }, [data.selection, s.source, i0, i1, s.palette, m.cell_km, unit])

  // Raw detections at native pixel size (optional layer, off by default). Only the files for the regions in view
  // and the years of the chosen months are loaded; nothing else in the app reads them.
  const [detIndex, setDetIndex] = useState<DetectionsIndex | null>(null)
  // A network error (a weak connection) is retried a few times; a missing index (404) means this build has no detections.
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const load = (attempt: number) => {
      dataSource.detectionsIndex().then((ix) => { if (!cancelled) setDetIndex(ix) }, () => {
        if (!cancelled && attempt < 5) timer = window.setTimeout(() => load(attempt + 1), 2000 * attempt)
      })
    }
    load(1)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [])
  const [detFiles, setDetFiles] = useState<{ key: string; files: DetectionsFile[] } | null>(null)
  const [detError, setDetError] = useState<string | null>(null)
  // Bumped by "Try again" in the key, to reload files that failed (the data source does not keep failures).
  const [detAttempt, setDetAttempt] = useState(0)
  const detShow = s.detections.show && !!detIndex && !!s.area
  const detKey = detShow && s.area ? regionsTouching(m, s.area)
    .flatMap((r) => yearsToLoad(Object.keys(detIndex!.regions[r] ?? {}), s.from, s.to).map((y) => `${r}/${y}`)).join(',') : ''
  useEffect(() => {
    setDetError(null)
    if (!detKey) return
    let cancelled = false
    Promise.all(detKey.split(',').map((k) => { const [r, y] = k.split('/'); return dataSource.detections(r, Number(y)) }))
      .then((files) => { if (!cancelled) setDetFiles({ key: detKey, files }) })
      .catch((e: unknown) => { if (!cancelled) setDetError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [detKey, detAttempt])
  // No key means no files to load (an area outside every region): an empty selection, not a spinner.
  const detReady = detKey === '' ? NO_DETECTION_FILES : detFiles?.key === detKey ? detFiles.files : null
  const detLoading = detShow && detReady === null && !detError
  const detSelection = useMemo(() => (detShow && s.area && detReady
    ? selectDetections(detReady, s.area, s.from, s.to, s.detections) : null),
  [detShow, s.area, s.from, s.to, s.detections, detReady])

  // The hotspots CSV loads the same files as the layer, on demand, whether or not the layer is on.
  const downloadHotspots = useCallback(async () => {
    const area = s.area
    if (!area || !detIndex) return 'Choose an area first.'
    const keys = regionsTouching(m, area).flatMap((r) => yearsToLoad(Object.keys(detIndex.regions[r] ?? {}), s.from, s.to).map((y) => [r, y] as const))
    const files = await Promise.all(keys.map(([r, y]) => dataSource.detections(r, y)))
    const { csv, rows } = hotspotsCsv(m, files, area, s.from, s.to)
    saveFile(hotspotsFilename(area, s.from, s.to), csv, 'text/csv;charset=utf-8')
    return `Saved ${rows.toLocaleString('en-GB')} hotspots.`
  }, [s.area, s.from, s.to, detIndex, m])

  // Every region tinted by its verdict for the last chosen month.
  const regionVerdicts = useMemo(() => {
    const out = new Map<string, MonthSummary>()
    for (const r of m.regions) out.set(r.id, compareMonth(m, seriesFromRegions(m, rf, [r.id]), s.source, s.to))
    return out
  }, [m, rf, s.source, s.to])
  const regionsFc = useMemo(() => regionsToFeatures(outlines, (id) => {
    const v = regionVerdicts.get(id)?.verdict
    return v ? VERDICT_COLORS[v] : NO_VERDICT_COLOR
  }, s.area?.regionIds ?? []), [outlines, regionVerdicts, s.area])

  // The area's activity per month, aligned to the months the date bar covers.
  const activity = useMemo(() => (series ? monthRange(m.harmonized_coverage[0], m.last_month).map((ym) => values[monthIndex(m, ym)] ?? null) : undefined),
    [series, values, m])

  const partial = monthStatus(m, s.to, s.source) === 'partial'
  const unfinished = m.month_to_date ? m.last_month : null
  const focus = series ? compareMonth(m, series, s.source, s.to) : null
  const focusLabel = focusLabelOf(m, s.to)
  const harmonizedSource = s.source === 'harmonized'
  const range: [number, number] | null = (() => {
    if (!series || !harmonizedSource || series.estimate) return null
    if (partial && series.mtd?.low && series.mtd.high) {
      const k = series.mtd.years.indexOf(parseYm(s.to).year)
      return k >= 0 ? [series.mtd.low[k], series.mtd.high[k]] : null
    }
    // Measured Aqua months have no model range; every converted month has one (it can be 0 to 0 in quiet months).
    if (sourceCode(m, s.to) === 'measured_aqua') return null
    const lo = series.low?.[i1]
    const hi = series.high?.[i1]
    return lo !== null && lo !== undefined && hi !== null && hi !== undefined ? [lo, hi] : null
  })()
  const rangeNote = !harmonizedSource ? null : series?.estimate ? 'estimate' as const
    : !range && sourceCode(m, s.to) === 'measured_aqua' ? 'measured' as const : null
  // Why the last chosen month gets no comparison (incomplete month, drifted raw Aqua), or null.
  const noVerdict = noVerdictReason(m, s.source, s.to)
  const ytd = series && !noVerdict ? yearToDate(comparableValues(s.source, series.months, values), series.months, s.to, m.baseline_years) : null
  let total: number | null = null
  let monthsWithData = 0
  for (let i = i0; i >= 0 && i <= i1; i++) {
    const v = values[i]
    if (v !== null && v !== undefined) { total = (total ?? 0) + v; monthsWithData++ }
  }
  const reportedForArea = reported?.series.find((r) => r.preset_id === s.area?.regionKey) ?? null
  const sensorsLine = `Satellites flying in ${labelYm(s.to)}: ${sensorsIn(m, s.to).map((x) => x.label).join(', ') || 'none'}.`
  const sourceLine = harmonizedSource ? `${labelYm(s.to)} is ${sourceOf(m, s.to)}.` : ''
  const touching = s.area ? regionsTouching(m, s.area) : []
  const retryCells = <button type="button" className="btn btn-inline" onClick={data.retry}>Try again</button>
  const needsArea = !s.area ? <p className="muted">Choose an area first (Area box on the left).</p>
    : noData ? <p className="muted">No data here: the record covers the four study regions. Choose an area inside one of them (Area box on the left).</p>
    : data.status === 'error' ? <p className="error" role="alert">The fire cells for this area could not load. {retryCells}</p>
    : <p className="muted" role="status">Loading the numbers for this area…</p>

  const panels: Panel[] = [
    { id: 'area', side: 'left', label: 'Area', icon: <MapPin aria-hidden />, title: 'Choose an area',
      guide: 'Pick one of the four study regions (or click it on the globe), draw a shape inside one, or type coordinates.',
      body: () => <>
        <AreaPanel manifest={m} area={s.area} tool={s.tool} error={drawError} drawingDisabled={mapFailed}
          onTool={(tool) => dispatch({ type: 'setTool', tool })}
          onRegion={chooseRegion}
          onArea={(area) => { setDrawError(null); dispatch({ type: 'setArea', area }) }} />
        <AreaSummary area={s.area} data={data} manifest={m} source={s.source} />
      </> },
    { id: 'dates', side: 'left', label: 'Dates', icon: <CalendarBlank aria-hidden />, title: 'Choose months',
      guide: 'Choose the months to look at. Colours rescale to the months you pick.',
      body: () => <TimeRangePicker first={m.harmonized_coverage[0]} last={m.last_month} from={s.from} to={s.to}
        onChange={(from, to) => dispatch({ type: 'setRange', from, to })}
        activity={activity} palette={s.palette} unit={unit} /> },
    { id: 'layers', side: 'left', label: 'Layers', icon: <Stack aria-hidden />, title: 'Layers and colours',
      guide: 'Switch between the harmonized record and raw Aqua MODIS or VIIRS, show every raw detection at its real pixel size, and change colours, imagery and labels.',
      body: () => <DisplayOptions source={s.source} scaleTo={s.scaleTo} palette={s.palette} basemap={s.basemap} labels={s.labels} mapDisabled={mapFailed}
        detections={s.detections} detectionsAvailable={!!detIndex}
        onDetections={(detections) => dispatch({ type: 'setDetections', detections })}
        onSource={(source) => dispatch({ type: 'setSource', source })}
        onScaleTo={(scaleTo) => dispatch({ type: 'setScaleTo', scaleTo })}
        onPalette={(palette) => dispatch({ type: 'setPalette', palette })}
        onBasemap={(basemap) => dispatch({ type: 'setBasemap', basemap })}
        onLabels={(labels) => dispatch({ type: 'setLabels', labels })} /> },
    { id: 'calendar', side: 'right', wide: true, label: 'Calendar', icon: <Table aria-hidden />, title: 'Burning calendar',
      guide: 'Every month since July 2002 as a grid: which seasons and which years had the most fire activity.',
      body: () => !ready ? needsArea : <>
        <Legend id="cal-legend" scale={calendarScale} showNrt
          title={s.scaleTo === 'range' ? `${unit} per month (bins fit ${labelYm(s.from)} to ${labelYm(s.to)})` : `${unit} per month (bins fit the whole record)`} />
        <BurningCalendar months={series.months} values={values} from={s.from} to={s.to} scale={calendarScale} medians={medians}
          statusOf={(ym) => monthStatus(m, ym, s.source)} baselineYears={m.baseline_years} seriesLabel={seriesLabel} unit={unit}
          legendId="cal-legend" onFocusMonth={setHoverMonth} />
        <CellDetail ym={hoverMonth} series={series} manifest={m} seriesLabel={seriesLabel} source={s.source} />
      </> },
    { id: 'trends', side: 'right', wide: true, label: 'Trends', icon: <ChartLine aria-hidden />, title: 'Historical comparison',
      guide: 'This year against a typical year, and every month against the multi-year median.',
      body: () => !ready ? needsArea : <Suspense fallback={chartFallback}>
        <SeasonalChart months={series.months} values={values} focusYear={parseYm(s.to).year} baselineYears={m.baseline_years} seriesLabel={seriesLabel}
          unit={unit} low={harmonizedSource ? series.low : null} high={harmonizedSource ? series.high : null} skip={unfinished} areaLabel={s.area?.label} />
        <AnomalyChart months={series.months} values={values} i0={i0} i1={i1} baselineYears={m.baseline_years} seriesLabel={seriesLabel} unit={unit} skip={unfinished}
          areaLabel={s.area?.label} />
      </Suspense> },
    { id: 'sensors', side: 'right', wide: true, label: 'Sensors', icon: <Planet aria-hidden />, title: 'MODIS and VIIRS',
      guide: 'Why harmonize: raw MODIS and VIIRS disagree, and splicing them raw makes a false jump. The conversion factors are here too.',
      body: () => !ready ? needsArea : <>
        <Suspense fallback={chartFallback}><OverlapChart series={series} unit={unit} areaLabel={s.area?.label} /></Suspense>
        <FactorTable regions={m.regions.filter((r) => touching.includes(r.id))} factors={rf.factors} />
      </> },
    ...(reportedForArea ? [{ id: 'reported', side: 'right' as const, wide: true, label: 'Reported', icon: <FireSimple aria-hidden />, title: 'Detected and reported',
      guide: 'Satellite detections next to fires reported on the ground, where a published statistic exists.',
      body: () => !ready ? needsArea : <Suspense fallback={chartFallback}>
        <ReportedChart reported={reportedForArea} months={series.months} detected={series.values.harmonized} from={s.from} to={s.to} areaLabel={s.area?.label} />
      </Suspense> }] : []),
    { id: 'download', side: 'right', label: 'Download', icon: <DownloadSimple aria-hidden />, title: 'Download and share',
      guide: 'Get the monthly numbers as a CSV with their sources and ranges, or copy a link to this exact view.',
      body: () => !ready || !s.area ? needsArea : <ExportButton manifest={m} area={s.area} series={series} i0={i0} i1={i1}
        onHotspots={detIndex ? downloadHotspots : undefined} /> },
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
    { target: null, title: 'Welcome', text: `This globe shows fire activity seen by NASA satellites in ${m.regions.map((r) => r.name).join(', ')}, from July 2002 to now, on one consistent scale. It is a record of satellite detections, not a warning service.` },
    { target: null, title: 'Fire cell-days', text: `Numbers count fire cell-days: ${m.cell_km} km squares with at least one fire detection on a day or night pass, on the Aqua MODIS scale. Regions are tinted by how the latest month compares with usual; the chosen area shows its ${m.cell_km} km fire cells.` },
    ...panels.map((p) => ({ target: `box-${p.id}`, title: p.label, text: p.guide })),
    { target: 'strip', title: 'Legend and summary', text: 'What the colours mean. Press More info for the verdict, the 90% range and the CSV download.' },
    { target: 'guide', title: 'Guide', text: 'Open this guide again any time.' },
  ]
  const closeGuide = () => { markGuideSeen(); setGuide(false) }
  const onMapUnavailable = useCallback(() => { setMapFailed(true); dispatch({ type: 'setTool', tool: 'pan' }) }, [])

  // Escape while a drawing tool is on cancels the drawing and goes back to moving the globe; the drawer stays open,
  // and a second Escape closes it. The guide, when open, takes Escape first.
  const drawing = s.tool !== 'pan'
  useEffect(() => {
    if (!drawing || guide) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      dispatch({ type: 'setTool', tool: 'pan' })
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [drawing, guide])

  const selection = `${s.area?.label ?? 'No area'}, ${labelYm(s.from)} – ${labelYm(s.to)}`
  const rangeText = range
    ? series?.bandSummed ? ` (regions' 90% ranges added: ${fmtCount(range[0])}–${fmtCount(range[1])})` : ` (90% range ${fmtCount(range[0])}–${fmtCount(range[1])})`
    : rangeNote === 'estimate' ? ' (estimate for this shape)' : ''
  const span = seriesSpan(m, s.source)
  const headline: ReactNode = !s.area ? 'Choose an area to begin.'
    : noData ? 'No data here: the record covers the four study regions.'
    : !series && data.status === 'error' ? <>{s.area.label}: the fire cells could not load. {retryCells}</>
    : !focus ? `${s.area.label}: loading…`
    : focus.value === null
      ? <><strong>{focusLabel}</strong>: no {seriesLabel} data{span && (s.to < span[0] || s.to > span[1])
        ? ` (this satellite flew from ${labelYm(span[0])} to ${labelYm(span[1])}). Choose months in that span, or the harmonized record, under Layers.`
        : '.'}</>
    : <><strong>{focusLabel}</strong>{partial ? ' (so far)' : ''}: {fmtCount(focus.value)} {unit}{rangeText}
        {focus.verdict && focus.percentile !== null
          ? <> · <span className={`verdict verdict-${focus.verdict}`}>{VERDICT_LABELS[focus.verdict]}</span> ({ordinal(Math.round(focus.percentile))} percentile{partial ? ' of the same days' : ''})</>
          : partial ? ' · not comparable yet'
          : noVerdict ? ` · ${noVerdict.short}` : null}</>

  const verdictKey = <VerdictKey title={`Region tint: ${labelYm(s.to)} compared with usual`}
    colors={[...VERDICT_ORDER.map((v) => VERDICT_COLORS[v]), NO_VERDICT_COLOR]} labels={['well below', 'below', 'typical', 'above', 'well above', 'no verdict']} />

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
          <Suspense fallback={<div className="globe" aria-busy="true" />}>
            <GlobeMap area={s.area} cells={cells} regions={regionsFc} tool={s.tool} basemap={s.basemap} labels={s.labels}
              detections={detSelection?.features} dimCells={detShow}
              onRegionClick={chooseRegion} onUnavailable={onMapUnavailable}
              onDrawn={(area) => {
                const err = validateDrawn(area)
                setDrawError(err)
                dispatch(err ? { type: 'setTool', tool: 'pan' } : { type: 'setArea', area })
              }} />
          </Suspense>
        </div>
      </main>
      <BottomStrip expanded={more} onToggle={toggleMore} headline={headline}
        legend={<div className="legends">
          {mapScale
            ? <CompactLegend scale={mapScale} title={`${unit} per ${m.cell_km} km cell, ${labelYm(s.from)} – ${labelYm(s.to)} (colours fit these months)`} />
            : <span className="small muted">{!s.area ? 'Choose an area to show its fire cells.'
              : data.status === 'error' ? <>The fire cells could not load. {retryCells}</>
              : data.status !== 'ready' ? 'Loading the fire cells…'
              : `No fire cells in ${labelYm(s.from)} – ${labelYm(s.to)} for this area.`}</span>}
          {detShow && <DetectionsLegend selection={detSelection} state={s.detections} loading={detLoading} error={detError}
            onRetry={() => setDetAttempt((n) => n + 1)} />}
          {verdictKey}
        </div>}
        more={<>
          {ready && focus && <KpiRow from={s.from} to={s.to} total={total} monthsWithData={monthsWithData} seriesLabel={seriesLabel} unit={unit}
            focus={focus} focusLabel={focusLabel} focusStatus={monthStatus(m, s.to, s.source)} range={range} rangeNote={rangeNote} rangeSummed={!!series?.bandSummed}
            ytd={ytd} baselineYears={m.baseline_years} sourceLine={sourceLine} sensorsLine={sensorsLine}
            noVerdictReason={noVerdict?.long} />}
          {ready && s.area && (
            <p>
              <button type="button" className="btn btn-primary"
                onClick={() => saveFile(csvFilename(s.area!, s.from, s.to), buildCsv(m, s.area!, series, i0, i1), 'text/csv;charset=utf-8')}>
                <DownloadSimple aria-hidden /> Download CSV of these months
              </button>
            </p>
          )}
          <AreaSummary area={s.area} data={data} manifest={m} source={s.source} />
          <p className="small muted">Colours show satellite fire detections, not fires or burned area. Cell colours are rebuilt for the months you choose, so the full ramp is always used.</p>
        </>} />
      {guide && <GuideTour steps={guideSteps} onClose={closeGuide} />}
    </div>
  )
}

function CellDetail({ ym, series, manifest: m, seriesLabel, source }: {
  ym: YearMonth | null; series: AreaSeries; manifest: Manifest; seriesLabel: string; source: SeriesKey
}) {
  if (!ym) return <p className="cell-detail muted small">Hover or use the arrow keys on the calendar to see one month in detail.</p>
  const i = monthIndex(m, ym)
  const value = series.values[source][i]
  const sum = compareMonth(m, series, source, ym)
  const [y0, y1] = m.baseline_years
  const status = monthStatus(m, ym, source)
  const reason = noVerdictReason(m, source, ym)
  // The years actually compared (a raw sensor's record starts after the baseline does).
  const used = sum.baseline?.years ?? []
  const [b0, b1] = used.length ? [Math.min(...used, parseYm(ym).year), Math.max(...used, parseYm(ym).year)] : [y0, y1]
  const lo = series.low?.[i]
  const hi = series.high?.[i]
  const range = source === 'harmonized' && !series.estimate && sourceCode(m, ym) !== 'measured_aqua' && status !== 'partial'
    && lo !== null && lo !== undefined && hi !== null && hi !== undefined
    ? series.bandSummed ? ` (regions' 90% ranges added: ${fmtCount(lo)}–${fmtCount(hi)})` : ` (90% range ${fmtCount(lo)}–${fmtCount(hi)})` : ''
  let compare = ''
  if (status === 'partial') compare = sum.baseline && sum.value !== null
    ? `So far (to ${m.last_day}): ${fmtCount(sum.value)}; the ${y0}–${y1} median for the same days is ${fmtCount(sum.baseline.median)}. `
    : 'Month to date: not comparable with full months yet. '
  else if (reason) compare = `${reason.long} `
  else if (sum.rank && sum.baseline && sum.value !== null) {
    compare = `Rank ${sum.rank.rank} of ${sum.rank.of} for this calendar month; ${diff(sum.value, sum.baseline.median)} against the ${b0}–${b1} median (${fmtCount(sum.baseline.median)})`
      + `${sum.percentile !== null ? `, ${ordinal(Math.round(sum.percentile))} percentile` : ''}${sum.z !== null ? `, robust z ${sum.z.toFixed(1)}` : ''}. `
  }
  const from = source === 'harmonized' ? ` Source: ${sourceOf(m, ym)}.` : ''
  const none = m.days.none[i] > 0 ? ` ${m.days.none[i]} days of this month had no satellite data.` : ''
  return (
    <p className="cell-detail" aria-live="polite">
      <strong>{labelYm(ym)}</strong>: {value === null || value === undefined ? 'no data' : `${fmtCount(value)} ${m.unit}${range}${series.estimate && source === 'harmonized' ? ' (estimate for this shape)' : ''}`} ({seriesLabel}). {compare}{from}{none}
    </p>
  )
}
