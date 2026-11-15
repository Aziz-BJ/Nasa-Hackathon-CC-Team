// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { fmtCount, type CountScale } from './colorScale'
import type { Outlines } from './data'
import { cellSquare } from './grid'

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, Record<string, unknown>>

export const EMPTY_FC: FC = { type: 'FeatureCollection', features: [] }

/** The 5 km fire cells, coloured by their total over the chosen months. Cells with 0 are left out. */
export function cellsToFeatures(
  totals: { id: string; lat: number; lon: number; total: number }[], cellKm: number, scale: CountScale, unit: string,
): FC {
  return {
    type: 'FeatureCollection',
    features: totals
      .filter((c) => c.total > 0)
      .map((c) => ({
        type: 'Feature',
        properties: { color: scale.colorOf(c.total), label: `${fmtCount(c.total)} ${unit}` },
        geometry: { type: 'Polygon', coordinates: [cellSquare(c.lat, c.lon, cellKm)] },
      })),
  }
}

/** The study regions, tinted by a colour per region id. Selected regions get almost no tint, so their cells show. */
export function regionsToFeatures(outlines: Outlines | null, colorOf: (id: string) => string, selected: string[]): FC {
  if (!outlines) return EMPTY_FC
  return {
    type: 'FeatureCollection',
    features: outlines.features.map((f) => ({
      type: 'Feature',
      properties: { id: f.properties.id, name: f.properties.name, color: colorOf(f.properties.id), selected: selected.includes(f.properties.id) },
      geometry: f.geometry,
    })),
  }
}

export function areaToFeatures(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: geometry ? [{ type: 'Feature', properties: {}, geometry }] : [] }
}
