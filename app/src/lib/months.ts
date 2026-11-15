// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.

/** A calendar month written "YYYY-MM". FIRMS dates are UTC, so months are UTC months. */
export type YearMonth = string

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export function parseYm(ym: YearMonth): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!m) throw new Error(`Invalid month "${ym}", expected YYYY-MM`)
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) throw new Error(`Invalid month "${ym}", month must be 01-12`)
  return { year, month }
}

export function formatYm(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Whole months from a to b (b - a). */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  const pa = parseYm(a)
  const pb = parseYm(b)
  return (pb.year - pa.year) * 12 + (pb.month - pa.month)
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const { year, month } = parseYm(ym)
  const zero = year * 12 + (month - 1) + n
  return formatYm(Math.floor(zero / 12), (zero % 12) + 1)
}

/** Inclusive list of months from first to last. */
export function monthRange(first: YearMonth, last: YearMonth): YearMonth[] {
  const n = monthsBetween(first, last)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addMonths(first, i))
}

/** "Nov 2026" */
export function labelYm(ym: YearMonth): string {
  const { year, month } = parseYm(ym)
  return `${MONTH_SHORT[month - 1]} ${year}`
}

/** "November 2026" */
export function longLabelYm(ym: YearMonth): string {
  const { year, month } = parseYm(ym)
  return `${MONTH_LONG[month - 1]} ${year}`
}
