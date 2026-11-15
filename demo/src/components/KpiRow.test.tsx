// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { summarizeMonth, summarizeMtd, yearToDate } from '../lib/indices'
import { monthRange } from '../lib/months'
import { KpiRow, type KpiRowProps } from './KpiRow'

// Augusts 2003..2006 = 10, 20, 40, 80; every other month = 1. Baseline for 2006-08 is 10, 20, 40: median 20, MAD 10.
const months = monthRange('2003-01', '2006-12')
const augusts: Record<string, number> = { '2003-08': 10, '2004-08': 20, '2005-08': 40, '2006-08': 80 }
const series = months.map((ym) => augusts[ym] ?? 1)
const BASE: [number, number] = [2003, 2006]

function props(over: Partial<KpiRowProps> = {}): KpiRowProps {
  return {
    from: '2003-01', to: '2006-08', total: 1234, monthsWithData: 44, seriesLabel: 'Harmonized (Aqua MODIS scale)', unit: 'fire cell-days',
    focus: summarizeMonth(series, months, '2006-08', BASE), focusLabel: 'August 2006', focusStatus: 'standard',
    range: [60, 110], rangeNote: null, ytd: yearToDate(series, months, '2006-08', BASE), baselineYears: BASE,
    sourceLine: 'This month: measured by Aqua MODIS.', sensorsLine: 'Sensors: MODIS.',
    ...over,
  }
}

describe('KpiRow, a finished month', () => {
  it('states the verdict, the number behind it and the baseline', () => {
    render(<KpiRow {...props()} />)
    expect(screen.getByText('Well above typical')).toBeInTheDocument()
    expect(screen.getByText(/100th percentile of 3 Augusts/)).toBeInTheDocument()
    expect(screen.getByText(/Compared with 2003 to 2006, leaving out 2006 itself/)).toBeInTheDocument()
    expect(screen.getByText(/not fires or burned area/)).toBeInTheDocument()
    expect(screen.getByText(/This month: measured by Aqua MODIS\./)).toBeInTheDocument()
  })
  it('uses the unit and the focus label in the headings', () => {
    render(<KpiRow {...props()} />)
    expect(screen.getByText('fire cell-days, 2003-01 to 2006-08')).toBeInTheDocument()
    expect(screen.getByText('August 2006, standard (science quality)')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('28 per month on average')).toBeInTheDocument()
  })
  it('prints the 90% range of the month', () => {
    render(<KpiRow {...props()} />)
    expect(screen.getByText('90% range 60 to 110')).toBeInTheDocument()
  })
  it('compares with the median in percent, with the robust z and the rank', () => {
    render(<KpiRow {...props()} />)
    expect(screen.getByText('vs typical August (median)')).toBeInTheDocument()
    expect(screen.getByText('+300%')).toBeInTheDocument() // (80 - 20) / 20
    expect(screen.getByText('Median 20, robust z 4.0')).toBeInTheDocument()
    expect(screen.getByText('busiest of 4 (2003 to 2006 plus 2006)')).toBeInTheDocument()
  })
  it('shows the year to date', () => {
    render(<KpiRow {...props()} />)
    expect(screen.getByText('Year to date (January to August)')).toBeInTheDocument()
    expect(screen.queryByText(/Shown once/)).not.toBeInTheDocument()
    expect(screen.queryByText(/is not finished/)).not.toBeInTheDocument()
  })
  it('says "Measured by Aqua MODIS" when there is no range for a measured month', () => {
    render(<KpiRow {...props({ range: null, rangeNote: 'measured' })} />)
    expect(screen.getByText('Measured by Aqua MODIS')).toBeInTheDocument()
    expect(screen.queryByText(/90% range/)).not.toBeInTheDocument()
  })
  it('says "Estimate for this shape" for a drawn area', () => {
    render(<KpiRow {...props({ range: null, rangeNote: 'estimate' })} />)
    expect(screen.getByText('Estimate for this shape')).toBeInTheDocument()
  })
  it('shows plain differences, not percentages, when the median is below 5', () => {
    const quiet = months.map((ym) => (ym === '2006-08' ? 4 : ym.endsWith('-08') ? 1 : 0))
    render(<KpiRow {...props({ focus: summarizeMonth(quiet, months, '2006-08', BASE), ytd: null })} />)
    expect(screen.getByText('+3')).toBeInTheDocument() // median 1, value 4
    expect(screen.getByText(/Below a median of 5, differences are shown as plain numbers/)).toBeInTheDocument()
  })
  it('says so when there are too few baseline years, and prints n/a for the comparisons', () => {
    render(<KpiRow {...props({ focus: summarizeMonth(series, months, '2006-08', [2005, 2006]), ytd: null })} />)
    expect(screen.getByText('Not enough baseline years to compare.')).toBeInTheDocument()
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(3)
  })
  it('prints n/a for a month with no value and for a missing total', () => {
    render(<KpiRow {...props({ total: null, monthsWithData: 0, focus: summarizeMonth(series, months, '2010-08', BASE), ytd: null })} />)
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(4)
  })
})

describe('KpiRow, the unfinished month', () => {
  // November, days 1-13: 2003..2005 = 10, 20, 40; 2006 = 80
  const mtd = { years: [2003, 2004, 2005, 2006], values: [10, 20, 40, 80] }
  const partial = () => props({
    to: '2006-11', focus: summarizeMtd(mtd, '2006-11', BASE), focusLabel: '1–13 November 2006', focusStatus: 'partial',
    range: [70, 95], ytd: yearToDate(series, months, '2006-11', BASE),
  })
  it('explains that the month is compared with the same days of earlier years', () => {
    render(<KpiRow {...partial()} />)
    expect(screen.getByText(/November 2006 is not finished, so it is compared with the same days in earlier years, not with whole months\./)).toBeInTheDocument()
    expect(screen.getByText('vs typical for the same days (median)')).toBeInTheDocument()
    expect(screen.getByText('1–13 November 2006, month to date: provisional')).toBeInTheDocument()
  })
  it('uses the range of the days so far', () => {
    render(<KpiRow {...partial()} />)
    expect(screen.getByText('90% range 70 to 95')).toBeInTheDocument()
    expect(screen.getByText(/100th percentile of 3 years \(same days\)/)).toBeInTheDocument()
  })
  it('hides the year to date until the month is complete', () => {
    render(<KpiRow {...partial()} />)
    expect(screen.getByText('Shown once November is complete.')).toBeInTheDocument()
  })
})
