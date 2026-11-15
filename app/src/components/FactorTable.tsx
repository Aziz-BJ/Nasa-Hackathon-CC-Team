// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Pierre's conversion factors (factors.csv): how many Aqua MODIS fire cell-days one VIIRS fire cell-day is worth.
import type { FactorRow, RegionInfo } from '../lib/types'

const f2 = (x: number) => x.toFixed(2)
const CELLS: { season: 'fire' | 'off'; daynight: 'D' | 'N'; label: string }[] = [
  { season: 'fire', daynight: 'D', label: 'Fire season (June to September), day' },
  { season: 'fire', daynight: 'N', label: 'Fire season, night' },
  { season: 'off', daynight: 'D', label: 'Rest of the year, day' },
  { season: 'off', daynight: 'N', label: 'Rest of the year, night' },
]

export function FactorTable({ regions, factors }: { regions: RegionInfo[]; factors: Record<string, FactorRow[]> }) {
  const shown = regions.filter((r) => factors[r.id])
  if (!shown.length) return null
  const find = (id: string, model: FactorRow['model'], c: (typeof CELLS)[number]) =>
    factors[id].find((f) => f.model === model && f.season === c.season && f.daynight === c.daynight)
  return (
    <section className="card" aria-labelledby="factors-title">
      <h2 id="factors-title">Conversion factors</h2>
      <p className="small">Aqua MODIS fire cell-days per S-NPP VIIRS fire cell-day, with the 90% range, from the months both satellites flew together (2012 to 2021). NOAA-20 goes through S-NPP.</p>
      <div className="table-scroll">
        <table className="factors">
          <thead>
            <tr><th scope="col">When</th>{shown.map((r) => <th key={r.id} scope="col">{r.name}</th>)}</tr>
          </thead>
          <tbody>
            {CELLS.map((c) => (
              <tr key={c.label}>
                <th scope="row">{c.label}</th>
                {shown.map((r) => {
                  const f = find(r.id, 'snpp_to_aqua', c)
                  return <td key={r.id}>{f ? <><strong>{f2(f.factor)}</strong> <span className="muted">({f2(f.low)} to {f2(f.high)})</span></> : 'n/a'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="caption">
        VIIRS sees between about 2 and 60 times more fire cell-days than Aqua MODIS, most of all at night and outside the fire season, so factors well below 1 are expected.
        The model also adjusts each month for fire size: months of bigger fires convert at a higher rate.
      </p>
    </section>
  )
}
