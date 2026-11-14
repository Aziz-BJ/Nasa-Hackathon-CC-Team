// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Grid scheme from the team data contract (HANDOVER.md section 7.1):
// row = floor((lat + 90) / deg), col = floor((lon + 180) / deg), id = "row_col".
// Tiles use the same scheme with a coarser size (tile_deg).

export type Bbox = [west: number, south: number, east: number, north: number]

const round6 = (x: number) => Math.round(x * 1e6) / 1e6

export function cellId(lat: number, lon: number, deg: number): string {
  const rows = Math.round(180 / deg)
  const cols = Math.round(360 / deg)
  const row = Math.min(Math.floor((lat + 90) / deg), rows - 1)
  const col = Math.min(Math.floor((lon + 180) / deg), cols - 1)
  return `${row}_${col}`
}

export function parseCellId(id: string): { row: number; col: number } {
  const m = /^(\d+)_(\d+)$/.exec(id)
  if (!m) throw new Error(`Invalid cell id "${id}"`)
  return { row: Number(m[1]), col: Number(m[2]) }
}

export function cellCentre(id: string, deg: number): { lat: number; lon: number } {
  const { row, col } = parseCellId(id)
  return { lat: round6((row + 0.5) * deg - 90), lon: round6((col + 0.5) * deg - 180) }
}

/** Corner ring of a cell as [lon, lat] pairs, closed, counter-clockwise. */
export function cellRing(id: string, deg: number): [number, number][] {
  const { row, col } = parseCellId(id)
  const s = round6(row * deg - 90)
  const w = round6(col * deg - 180)
  const n = round6(s + deg)
  const e = round6(w + deg)
  return [[w, s], [e, s], [e, n], [w, n], [w, s]]
}

/** Ids of all tiles (same scheme, tile size tileDeg) that overlap the bbox. */
export function tilesForBbox([w, s, e, n]: Bbox, tileDeg: number): string[] {
  const maxRow = Math.round(180 / tileDeg) - 1
  const maxCol = Math.round(360 / tileDeg) - 1
  const r0 = Math.max(0, Math.floor((s + 90) / tileDeg))
  const r1 = Math.min(maxRow, Math.ceil((n + 90) / tileDeg) - 1)
  const c0 = Math.max(0, Math.floor((w + 180) / tileDeg))
  const c1 = Math.min(maxCol, Math.ceil((e + 180) / tileDeg) - 1)
  const ids: string[] = []
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) ids.push(`${r}_${c}`)
  return ids
}
