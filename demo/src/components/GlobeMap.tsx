// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useRef, useState } from 'react'
import { Map as MLMap, NavigationControl, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TerraDraw, TerraDrawCircleMode, TerraDrawFreehandMode, TerraDrawPolygonMode, TerraDrawRectangleMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { areaFromPolygon, type Area } from '../lib/area'
import { areaToFeatures } from '../lib/mapFeatures'

// MapLibre 6 finds its worker relative to its own file, which Vite moves. Point at it explicitly.
setWorkerUrl(workerUrl)

export type DrawTool = 'pan' | 'circle' | 'rectangle' | 'polygon' | 'freehand'
export type Basemap = 'day' | 'night'

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const gibs = (layer: string, level: number, ext: string, date = '') =>
  `${GIBS}/${layer}/default/${date ? date + '/' : ''}GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`

// Borders and place names come from OpenFreeMap (free, no key; OpenStreetMap data). Kept light on purpose:
// country borders, country names, capitals, and other big cities only when zoomed in.
const OSM_NAME: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name']]
const LABEL_PAINT = { 'text-color': '#ffffff', 'text-halo-color': 'rgba(7,23,63,0.85)', 'text-halo-width': 1.4 }
export const LABEL_LAYERS = ['borders', 'country-labels', 'city-labels']

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  // A soft atmosphere around the globe, fading out as you zoom in to a flat map.
  sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
  sources: {
    osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    day: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [gibs('BlueMarble_ShadedRelief_Bathymetry', 8, 'jpeg')],
      attribution: 'Imagery: NASA GIBS (Blue Marble)' },
    night: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [gibs('VIIRS_Black_Marble', 8, 'png', '2016-01-01')],
      attribution: 'Imagery: NASA GIBS (Black Marble)' },
    // No GIBS overlay layers (Reference_Features/Labels_15m, Coastlines_15m): many of their tiles come back opaque
    // black or as HTTP 500, and MapLibre's globe draws each failed tile as a black square over everything.
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
    { id: 'day', type: 'raster', source: 'day' },
    { id: 'night', type: 'raster', source: 'night', layout: { visibility: 'none' } },
    {
      id: 'borders', type: 'line', source: 'osm', 'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.4] },
    },
    {
      id: 'country-labels', type: 'symbol', source: 'osm', 'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'country'],
      layout: { 'text-field': OSM_NAME, 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 15], 'text-max-width': 8 },
      paint: LABEL_PAINT,
    },
    {
      id: 'city-labels', type: 'symbol', source: 'osm', 'source-layer': 'place', minzoom: 3,
      filter: ['all', ['==', ['get', 'class'], 'city'], ['any', ['==', ['get', 'capital'], 2], ['>=', ['zoom'], 5]]],
      layout: { 'text-field': OSM_NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11 },
      paint: LABEL_PAINT,
    },
  ],
}

const TOOL_LABEL: Record<Exclude<DrawTool, 'pan'>, string> = {
  circle: 'Drawn circle', rectangle: 'Drawn rectangle', polygon: 'Drawn polygon', freehand: 'Drawn freehand area',
}

export interface GlobeMapProps {
  area: Area | null
  cells: GeoJSON.FeatureCollection
  /** The study regions, tinted (properties: id, name, color, selected). */
  regions: GeoJSON.FeatureCollection
  tool: DrawTool
  basemap: Basemap
  /** Country borders and place names. */
  labels: boolean
  /** Called once when the user finishes drawing a shape. */
  onDrawn: (area: Area) => void
  /** Called with a region id when the user clicks a region while moving the globe. */
  onRegionClick: (id: string) => void
}

export function GlobeMap({ area, cells, regions, tool, basemap, labels, onDrawn, onRegionClick }: GlobeMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const onDrawnRef = useRef(onDrawn)
  onDrawnRef.current = onDrawn
  const onRegionRef = useRef(onRegionClick)
  onRegionRef.current = onRegionClick
  const toolRef = useRef(tool)
  toolRef.current = tool
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // Create the map once. Strict mode mounts twice in dev; the cleanup removes the first map.
  useEffect(() => {
    let map: MLMap
    try {
      // A compact credit button on the map (shown open at first, folds to an "i" once the map is used).
      // Full credits and the disclaimer are in About.
      map = new MLMap({
        container: container.current!, style: structuredClone(MAP_STYLE), center: [10, 15], zoom: 1.4,
        attributionControl: { compact: true, customAttribution: 'Data: NASA FIRMS' },
      })
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
      return
    }
    mapRef.current = map
    map.addControl(new NavigationControl({ visualizePitch: false }), 'bottom-right')
    map.on('load', () => {
      map.addSource('regions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      // Unselected regions carry their verdict tint; a selected region is almost clear so its fire cells read well.
      map.addLayer({ id: 'regions', type: 'fill', source: 'regions',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'selected'], 0.06, 0.4] } }, 'borders')
      map.addLayer({ id: 'regions-outline', type: 'line', source: 'regions',
        paint: { 'line-color': '#ffffff', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 7, 1.6] } }, 'borders')
      map.on('click', 'regions', (e) => {
        if (toolRef.current !== 'pan') return
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') onRegionRef.current(id)
      })
      map.on('mouseenter', 'regions', () => { if (toolRef.current === 'pan') map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'regions', () => { map.getCanvas().style.cursor = '' })
      map.addSource('cells', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.8 } }, 'borders')
      map.addLayer({ id: 'cells-outline', type: 'line', source: 'cells', paint: { 'line-color': '#000000', 'line-opacity': 0.35, 'line-width': 0.5 } }, 'borders')
      map.addSource('area', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      // White outline on a dark casing: readable over imagery and over every ramp colour.
      map.addLayer({ id: 'area-casing', type: 'line', source: 'area', paint: { 'line-color': '#000000', 'line-opacity': 0.55, 'line-width': 6 } })
      map.addLayer({ id: 'area', type: 'line', source: 'area', paint: { 'line-color': '#ffffff', 'line-width': 2.25 } })

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawCircleMode({ projection: 'globe', drawInteraction: 'click-move-or-drag' }),
          new TerraDrawRectangleMode({ drawInteraction: 'click-move-or-drag' }),
          new TerraDrawPolygonMode(),
          new TerraDrawFreehandMode(),
        ],
      })
      draw.start()
      draw.on('finish', (id) => {
        const f = draw.getSnapshotFeature(id)
        const t = toolRef.current
        if (f && f.geometry.type === 'Polygon' && t !== 'pan') {
          onDrawnRef.current(areaFromPolygon(f.geometry as GeoJSON.Polygon, TOOL_LABEL[t]))
        }
        // Defer the clear: Terra Draw is still inside its own event handler here.
        setTimeout(() => draw.clear(), 0)
      })
      drawRef.current = draw
      setReady(true)
    })
    map.on('error', (e) => console.warn('Map error', e.error))
    return () => {
      drawRef.current?.stop()
      drawRef.current = null
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !drawRef.current) return
    drawRef.current.setMode(tool === 'pan' ? 'static' : tool)
  }, [ready, tool])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('regions') as GeoJSONSource | undefined)?.setData(regions)
  }, [ready, regions])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('cells') as GeoJSONSource | undefined)?.setData(cells)
  }, [ready, cells])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('area') as GeoJSONSource | undefined)?.setData(areaToFeatures(area?.geometry ?? null))
    if (area) {
      const [w, s, e, n] = area.bbox
      // Keep the area clear of the floating controls (top bar, side boxes, bottom strip).
      const phone = map.getContainer().clientWidth < 760
      const padding = phone ? { top: 70, bottom: 250, left: 20, right: 20 } : { top: 90, bottom: 150, left: 110, right: 110 }
      map.fitBounds([[w, s], [e, n]], { padding, maxZoom: 9, duration: 1200 })
    }
  }, [ready, area])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setLayoutProperty('day', 'visibility', basemap === 'day' ? 'visible' : 'none')
    map.setLayoutProperty('night', 'visibility', basemap === 'night' ? 'visible' : 'none')
    for (const id of LABEL_LAYERS) map.setLayoutProperty(id, 'visibility', labels ? 'visible' : 'none')
  }, [ready, basemap, labels])

  if (failed) {
    return (
      <div className="map-fallback" role="note">
        The 3D globe could not start ({failed}). It needs WebGL2. The region list and typed coordinates still work, and every chart is unaffected.
      </div>
    )
  }
  return <div ref={container} className="globe" role="region" aria-label="Globe map. Click a study region, use the drawing tools, or type coordinates in the Area panel." />
}
