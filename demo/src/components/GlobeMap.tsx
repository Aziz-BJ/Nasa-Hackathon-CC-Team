// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { useEffect, useRef, useState } from 'react'
import { Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
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

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    day: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [gibs('BlueMarble_ShadedRelief_Bathymetry', 8, 'jpeg')],
      attribution: 'Imagery: NASA GIBS (Blue Marble)' },
    night: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: [gibs('VIIRS_Black_Marble', 8, 'png', '2016-01-01')],
      attribution: 'Imagery: NASA GIBS (Black Marble)' },
    features: { type: 'raster', tileSize: 256, maxzoom: 13, tiles: [gibs('Reference_Features_15m', 13, 'png')] },
    labels: { type: 'raster', tileSize: 256, maxzoom: 13, tiles: [gibs('Reference_Labels_15m', 13, 'png')],
      attribution: 'Reference layers: NASA GIBS, © OpenStreetMap contributors' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#07173F' } },
    { id: 'day', type: 'raster', source: 'day' },
    { id: 'night', type: 'raster', source: 'night', layout: { visibility: 'none' } },
    { id: 'features', type: 'raster', source: 'features' },
    { id: 'labels', type: 'raster', source: 'labels' },
  ],
}

const TOOL_LABEL: Record<Exclude<DrawTool, 'pan'>, string> = {
  circle: 'Drawn circle', rectangle: 'Drawn rectangle', polygon: 'Drawn polygon', freehand: 'Drawn freehand area',
}

export interface GlobeMapProps {
  area: Area | null
  cells: GeoJSON.FeatureCollection
  overview: GeoJSON.FeatureCollection
  tool: DrawTool
  basemap: Basemap
  labels: boolean
  /** Called once when the user finishes drawing a shape. */
  onDrawn: (area: Area) => void
}

export function GlobeMap({ area, cells, overview, tool, basemap, labels, onDrawn }: GlobeMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const onDrawnRef = useRef(onDrawn)
  onDrawnRef.current = onDrawn
  const toolRef = useRef(tool)
  toolRef.current = tool
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // Create the map once. Strict mode mounts twice in dev; the cleanup removes the first map.
  useEffect(() => {
    let map: MLMap
    try {
      map = new MLMap({ container: container.current!, style: structuredClone(MAP_STYLE), center: [10, 15], zoom: 1.4, attributionControl: { compact: true } })
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e))
      return
    }
    mapRef.current = map
    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right')
    map.on('load', () => {
      map.addSource('overview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'overview', type: 'fill', source: 'overview', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.4 } }, 'features')
      map.addSource('cells', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.85 } }, 'features')
      map.addLayer({ id: 'cells-outline', type: 'line', source: 'cells', paint: { 'line-color': '#07173F', 'line-width': 0.5 } }, 'features')
      map.addSource('area', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'area', type: 'line', source: 'area', paint: { 'line-color': '#EAFE07', 'line-width': 2.5 } })

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
    if (ready) (mapRef.current?.getSource('overview') as GeoJSONSource | undefined)?.setData(overview)
  }, [ready, overview])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('cells') as GeoJSONSource | undefined)?.setData(cells)
  }, [ready, cells])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('area') as GeoJSONSource | undefined)?.setData(areaToFeatures(area?.geometry ?? null))
    if (area) {
      const [w, s, e, n] = area.bbox
      map.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 6, duration: 1200 })
    }
  }, [ready, area])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setLayoutProperty('day', 'visibility', basemap === 'day' ? 'visible' : 'none')
    map.setLayoutProperty('night', 'visibility', basemap === 'night' ? 'visible' : 'none')
    map.setLayoutProperty('labels', 'visibility', labels ? 'visible' : 'none')
    map.setLayoutProperty('features', 'visibility', labels ? 'visible' : 'none')
  }, [ready, basemap, labels])

  if (failed) {
    return (
      <div className="map-fallback" role="note">
        The 3D globe could not start ({failed}). It needs WebGL2. Presets and typed coordinates still work, and every chart below is unaffected.
      </div>
    )
  }
  return <div ref={container} className="globe" role="region" aria-label="Globe map. Use the area tools or the coordinate form to choose an area." />
}
