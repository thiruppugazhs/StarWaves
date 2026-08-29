const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const TIMELINE_MONTHS = 12

export function monthKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function monthLabel(date) {
  return MONTH_LABELS[date.getMonth()] ?? ''
}

export function monthLabelWithYear(date) {
  return `${MONTH_LABELS[date.getMonth()] ?? ''} ${String(date.getFullYear()).slice(2)}`
}

/**
 * Build a 12-month application frequency timeline from the stored jobs.
 *
 * Each job is bucketed by its `appliedDate` (YYYY-MM-DD). Jobs without an
 * applied date are excluded so the visual reflects actual applications.
 *
 * @param {Array<{ appliedDate?: string }>} jobs
 * @param {Date} [now] Reference date (defaults to the current time).
 * @returns {{ months: Array<{ key, label, count }>, max: number, total: number }}
 */
export function buildApplicationTimeline(jobs, now = new Date()) {
  const months = []
  const reference = new Date(now.getFullYear(), now.getMonth(), 1)

  for (let offset = TIMELINE_MONTHS - 1; offset >= 0; offset--) {
    const date = new Date(reference.getFullYear(), reference.getMonth() - offset, 1)
    months.push({
      key: monthKey(date),
      label: monthLabel(date),
      fullLabel: monthLabelWithYear(date),
      count: 0,
    })
  }

  for (const job of jobs) {
    if (!job.appliedDate) continue
    const bucket = months.find((month) => month.key === job.appliedDate.slice(0, 7))
    if (bucket) bucket.count += 1
  }

  const max = Math.max(...months.map((month) => month.count))
  const total = months.reduce((sum, month) => sum + month.count, 0)
  return { months, max: max || 0, total }
}