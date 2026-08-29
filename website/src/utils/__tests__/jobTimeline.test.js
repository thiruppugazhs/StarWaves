import { describe, expect, it } from 'vitest'
import {
  buildApplicationTimeline,
  monthKey,
  monthLabel,
} from '../jobTimeline'

const NOW = new Date('2026-08-12T00:00:00Z')

describe('job application timeline', () => {
  it('buckets applications across the trailing 12 months', () => {
    const jobs = [
      { appliedDate: '2026-08-01' },
      { appliedDate: '2026-08-20' },
      { appliedDate: '2026-08-31' },
      { appliedDate: '2026-03-15' },
      { appliedDate: '2025-09-01' },
    ]
    const { months, total } = buildApplicationTimeline(jobs, NOW)

    expect(months).toHaveLength(12)
    expect(total).toBe(5)
    expect(months.at(-1)).toMatchObject({ key: '2026-08', count: 3 })
    expect(months.find((month) => month.key === '2026-03').count).toBe(1)
    expect(months.find((month) => month.key === '2025-09').count).toBe(1)
  })

  it('excludes jobs older than 12 months and jobs without an applied date', () => {
    const jobs = [
      { appliedDate: '2025-09-10' }, // within window (Sep 2025): included
      { appliedDate: '2025-08-31' }, // older than 12 months: excluded
      { status: 'Applied' }, // no applied date: excluded
      {},
    ]
    const { months, total } = buildApplicationTimeline(jobs, NOW)

    expect(total).toBe(1)
    expect(months.at(0)).toMatchObject({ key: '2025-09', count: 1 })
    expect(months.at(-1)).toMatchObject({ key: '2026-08', count: 0 })
  })

  it('computes the max bucket count for chart scaling', () => {
    const jobs = [
      { appliedDate: '2026-08-01' },
      { appliedDate: '2026-08-02' },
      { appliedDate: '2026-07-01' },
    ]
    const { max } = buildApplicationTimeline(jobs, NOW)

    expect(max).toBe(2)
  })

  it('returns zeroed months when there are no applications', () => {
    const { months, max, total } = buildApplicationTimeline([], NOW)

    expect(total).toBe(0)
    expect(max).toBe(0)
    expect(months.every((month) => month.count === 0)).toBe(true)
    expect(months.map((month) => month.label)).toEqual([
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
    ])
  })

  it('formats month keys and labels', () => {
    expect(monthKey(new Date('2026-01-05'))).toBe('2026-01')
    expect(monthLabel(new Date('2026-12-05'))).toBe('Dec')
  })
})