// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { MIN_DENOMINATOR } from '../config'
import { fmtCount } from '../lib/colorScale'
import { VERDICT_LABELS, type MonthSummary, type YearToDate } from '../lib/indices'
import { MONTH_LONG, parseYm, type YearMonth } from '../lib/months'
import { STATUS_LABELS, type MonthStatus } from '../lib/status'

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`
/** A percentage when the median is big enough to divide by, otherwise the plain difference. */
export const diff = (value: number, ref: number) =>
  ref >= MIN_DENOMINATOR ? pct(((value - ref) / ref) * 100) : `${value >= ref ? '+' : '−'}${fmtCount(Math.abs(value - ref))}`
const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}

export interface KpiRowProps {
  from: YearMonth
  to: YearMonth
  total: number | null
  monthsWithData: number
  seriesLabel: string
  unit: string
  /** The latest chosen month, or for an unfinished month its days so far against the same days of past years. */
  focus: MonthSummary
  focusLabel: string
  focusStatus: MonthStatus
  /** 90% range of the focus value, when the record has one. */
  range: [number, number] | null
  /** The range adds several regions' 90% ranges, so it is usually wider than the true range. */
  rangeSummed?: boolean
  /** "measured" (Aqua months) or "estimate" (drawn shapes), shown when there is no range. */
  rangeNote: 'measured' | 'estimate' | null
  ytd: YearToDate | null
  baselineYears: [number, number]
  sourceLine: string
  sensorsLine: string
  /** Why the month gets no verdict (incomplete month, drifted Aqua), shown instead of the verdict. */
  noVerdictReason?: string | null
}

export function KpiRow(p: KpiRowProps) {
  const f = p.focus
  const partial = p.focusStatus === 'partial'
  const calName = MONTH_LONG[parseYm(f.month).month - 1]
  const what = partial ? `years (same days)` : `${calName}s`
  const n = f.baseline?.values.length ?? 0
  // The years actually compared: a raw sensor's record starts later (S-NPP 2012, NOAA-20 2018) than the baseline.
  // The month's own year counts towards the span (it is named as "left out" in the caption).
  const fy = parseYm(f.month).year
  const used = f.baseline?.years.length ? [...f.baseline.years, ...(fy >= p.baselineYears[0] && fy <= p.baselineYears[1] ? [fy] : [])] : []
  const [y0, y1] = used.length ? [Math.min(...used), Math.max(...used)] : p.baselineYears
  const ytd = partial ? null : p.ytd
  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title">Summary</h2>
      <div className="kpis">
        <div className="kpi">
          <div className="small muted">{p.unit}, {p.from} to {p.to}</div>
          <div className="value">{p.total === null ? 'n/a' : fmtCount(p.total)}</div>
          <div className="small">{p.monthsWithData > 0 && p.total !== null ? `${fmtCount(p.total / p.monthsWithData)} per month on average` : ''}</div>
        </div>
        <div className="kpi">
          <div className="small muted">{p.focusLabel}, {STATUS_LABELS[p.focusStatus].toLowerCase()}</div>
          <div className="value">{f.value === null ? 'n/a' : fmtCount(f.value)}</div>
          <div className="small">
            {p.range ? p.rangeSummed ? `Regions' 90% ranges added: ${fmtCount(p.range[0])} to ${fmtCount(p.range[1])} (usually wider than the true range)` : `90% range ${fmtCount(p.range[0])} to ${fmtCount(p.range[1])}` : p.rangeNote === 'measured' ? 'Measured by Aqua MODIS' : p.rangeNote === 'estimate' ? 'Estimate for this shape' : ''}
          </div>
          {f.verdict && f.percentile !== null
            ? <div><span className={`verdict verdict-${f.verdict}`}>{VERDICT_LABELS[f.verdict]}</span> <span className="small">{ordinal(Math.round(f.percentile))} percentile of {n} {what}</span></div>
            : <div className="small">{p.noVerdictReason ?? 'Not enough baseline years to compare.'}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">vs typical {partial ? 'for the same days' : calName} (median)</div>
          <div className="value">{f.value === null || !f.baseline ? 'n/a' : diff(f.value, f.baseline.median)}</div>
          {f.baseline && f.value !== null && <div className="small">Median {fmtCount(f.baseline.median)}{f.z !== null ? `, robust z ${f.z.toFixed(1)}` : ''}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">Year to date (January to {calName})</div>
          <div className="value">{ytd ? diff(ytd.current, ytd.typical) : 'n/a'}</div>
          {ytd && <div className="small">{fmtCount(ytd.current)} vs typical {fmtCount(ytd.typical)}</div>}
          {partial && <div className="small">Shown once {calName} is complete.</div>}
        </div>
        <div className="kpi">
          <div className="small muted">Rank among {what}</div>
          <div className="value">{f.rank ? ordinal(f.rank.rank) : 'n/a'}</div>
          {f.rank && <div className="small">busiest of {f.rank.of} ({y0} to {y1}{fy >= y0 && fy <= y1 ? '' : ` plus ${fy}`})</div>}
        </div>
      </div>
      {partial && <p className="notice">{calName} {parseYm(f.month).year} is not finished, so it is compared with the same days in earlier years, not with whole months.</p>}
      <p className="caption">
        {p.noVerdictReason ? 'Not compared with earlier years.' : `Compared with ${y0} to ${y1}, leaving out ${fy} itself.`} {p.seriesLabel}. {p.sourceLine} {p.sensorsLine}
        {' '}Fire cell-days count satellite detections, not fires or burned area. Below a median of {MIN_DENOMINATOR}, differences are shown as plain numbers, not percentages.
      </p>
    </section>
  )
}
