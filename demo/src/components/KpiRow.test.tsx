// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { summarizeMonth, yearToDate } from '../lib/indices'
import { monthRange } from '../lib/months'
import { KpiRow } from './KpiRow'

const months = monthRange('2003-01', '2006-12')
const series = months.map((ym) => (ym.endsWith('-08') ? (Number(ym.slice(0, 4)) - 2002) * 10 : 1))

describe('KpiRow', () => {
  it('states the verdict, the number behind it and the baseline', () => {
    render(
      <KpiRow from="2003-01" to="2006-08" total={123} monthsWithData={44} seriesLabel="Harmonized (MODIS + VIIRS)"
        focus={summarizeMonth(series, months, '2006-08', [2003, 2006])} focusStatus="standard"
        ytd={yearToDate(series, months, '2006-08', [2003, 2006])} baselineYears={[2003, 2006]} sensorsLine="Sensors: MODIS." />,
    )
    expect(screen.getByText('Well above typical')).toBeInTheDocument()
    expect(screen.getByText(/100th percentile of 3 Augusts/)).toBeInTheDocument()
    expect(screen.getByText(/Compared with 2003 to 2006/)).toBeInTheDocument()
    expect(screen.getByText(/not fires or burned area/)).toBeInTheDocument()
  })
})
