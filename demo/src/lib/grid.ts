// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Andrea's grid: 5 km squares in an equal-area projection (EPSG:3035 for Italy, EPSG:3310 for California),
// cell_id = "{epsg}_{floor(x / 5000)}_{floor(y / 5000)}". The app gets each cell's centre in lat/lon from the data.

export type Bbox = [west: number, south: number, east: number, north: number]

const KM_PER_DEG_LAT = 111.32
const round6 = (x: number) => Math.round(x * 1e6) / 1e6

/**
 * A square of side km around a cell centre, as a closed counter-clockwise [lon, lat] ring.
 * The real cell is a square in the projection, turned by a few degrees at most; at map scale this is close enough to draw.
 */
export function cellSquare(lat: number, lon: number, km: number): [number, number][] {
  const dLat = km / 2 / KM_PER_DEG_LAT
  const dLon = km / 2 / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const s = round6(lat - dLat)
  const n = round6(lat + dLat)
  const w = round6(lon - dLon)
  const e = round6(lon + dLon)
  return [[w, s], [e, s], [e, n], [w, n], [w, s]]
}

export function bboxesOverlap([aw, as, ae, an]: Bbox, [bw, bs, be, bn]: Bbox): boolean {
  return aw <= be && ae >= bw && as <= bn && an >= bs
}

export function unionBbox(boxes: Bbox[]): Bbox {
  return [
    Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3])),
  ]
}
