// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { MIN_DENOMINATOR } from '../config'
import { fmtCount } from '../lib/colorScale'
import { relativeAnomaly, VERDICT_LABELS, type MonthSummary, type YearToDate } from '../lib/indices'
import { longLabelYm, MONTH_LONG, parseYm, type YearMonth } from '../lib/months'
import { STATUS_LABELS, type MonthStatus } from '../lib/status'

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`
/** A percentage when the reference is big enough to divide by, otherwise the plain difference in hotspots. */
const diff = (value: number, ref: number) =>
  ref >= MIN_DENOMINATOR ? pct(relativeAnomaly(value, ref)) : `${value >= ref ? '+' : '−'}${fmtCount(Math.abs(value - ref))}`
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
  focus: MonthSummary
  focusStatus: MonthStatus
  ytd: YearToDate | null
  baselineYears: [number, number]
  sensorsLine: string
}

export function KpiRow(p: KpiRowProps) {
  const partial = p.focusStatus === 'partial'
  // A month that is not finished is not compared: its total is still growing.
  const f = partial ? { ...p.focus, verdict: null, percentile: null, rank: null } : p.focus
  const calName = MONTH_LONG[parseYm(f.month).month - 1]
  const n = f.baseline?.values.length ?? 0
  const [y0, y1] = p.baselineYears
  const ytd = partial ? null : p.ytd
  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title">Summary</h2>
      <div className="kpis">
        <div className="kpi">
          <div className="small muted">Hotspots detected, {p.from} to {p.to}</div>
          <div className="value">{p.total === null ? 'n/a' : fmtCount(p.total)}</div>
          <div className="small">{p.monthsWithData > 0 && p.total !== null ? `${fmtCount(p.total / p.monthsWithData)} per month on average` : ''}</div>
        </div>
        <div className="kpi">
          <div className="small muted">{longLabelYm(f.month)} ({STATUS_LABELS[p.focusStatus]})</div>
          <div className="value">{f.value === null ? 'n/a' : fmtCount(f.value)}</div>
          {f.verdict && f.percentile !== null
            ? <div><span className={`verdict verdict-${f.verdict}`}>{VERDICT_LABELS[f.verdict]}</span> <span className="small">{ordinal(Math.round(f.percentile))} percentile of {n} {calName}s</span></div>
            : <div className="small">{partial ? 'Month not finished: no comparison yet.' : 'Not enough baseline years to compare.'}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">vs multi-year average for {calName}</div>
          <div className="value">{partial || f.value === null || !f.baseline ? 'n/a' : diff(f.value, f.baseline.mean)}</div>
          {!partial && f.baseline && f.value !== null && <div className="small">Average {fmtCount(f.baseline.mean)}, median {fmtCount(f.baseline.median)} ({diff(f.value, f.baseline.median)}){f.z !== null ? `, z = ${f.z.toFixed(1)}` : ''}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">Year to date (January to {calName})</div>
          <div className="value">{ytd ? diff(ytd.current, ytd.typical) : 'n/a'}</div>
          {ytd && <div className="small">{fmtCount(ytd.current)} vs typical {fmtCount(ytd.typical)}</div>}
        </div>
        <div className="kpi">
          <div className="small muted">Rank among {calName}s</div>
          <div className="value">{f.rank ? ordinal(f.rank.rank) : 'n/a'}</div>
          {f.rank && <div className="small">busiest of {f.rank.of} ({y0} to {y1} plus {parseYm(f.month).year})</div>}
        </div>
      </div>
      {p.focusStatus === 'partial' && <p className="notice">{longLabelYm(f.month)} is not finished yet, so its total is lower than a full month would be. Compare with care.</p>}
      <p className="caption">
        Compared with {y0} to {y1}, same calendar month, leaving out {parseYm(f.month).year} itself. {p.seriesLabel}. {p.sensorsLine}
        {' '}Counts are satellite hotspot detections, not fires or burned area.
      </p>
    </section>
  )
}
