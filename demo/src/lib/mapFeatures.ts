// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { buildCountScale, fmtCount, type CountScale, type PaletteId } from './colorScale'
import { cellId, cellRing } from './grid'
import type { OverviewFile } from './types'

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { color: string; label: string }>

export const EMPTY_FC: FC = { type: 'FeatureCollection', features: [] }

export function cellsToFeatures(
  totals: { id: string; total: number | null }[], gridDeg: number, scale: CountScale,
): FC {
  return {
    type: 'FeatureCollection',
    features: totals
      .filter((c) => c.total !== null && c.total > 0)
      .map((c) => ({
        type: 'Feature',
        properties: { color: scale.colorOf(c.total), label: `${fmtCount(c.total as number)} hotspots` },
        geometry: { type: 'Polygon', coordinates: [cellRing(c.id, gridDeg)] },
      })),
  }
}

/** Global context layer: where hotspots usually are. Log bins because counts span orders of magnitude. */
export function overviewToFeatures(ov: OverviewFile, palette: PaletteId): FC {
  const scale = buildCountScale(ov.cells.map((c) => c[2]), { method: 'log', bins: 6, palette })
  return {
    type: 'FeatureCollection',
    features: ov.cells.filter((c) => c[2] > 0).map(([lat, lon, v]) => ({
      type: 'Feature',
      properties: { color: scale.colorOf(v), label: `${fmtCount(v)} hotspots per year` },
      geometry: { type: 'Polygon', coordinates: [cellRing(cellId(lat, lon, ov.grid_deg), ov.grid_deg)] },
    })),
  }
}

export function areaToFeatures(geometry: GeoJSON.Polygon | null): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: geometry ? [{ type: 'Feature', properties: {}, geometry }] : [] }
}
