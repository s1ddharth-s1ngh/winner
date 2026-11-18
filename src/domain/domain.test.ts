import { describe, expect, it } from 'vitest'
import { BADGES } from '../config/badges'
import { addDays, dateIn, minutesOfDayIn, startOfWeek, zonedTimeToInstant } from '../lib/dates'
import { buildLeaderboard, periodRange } from './leaderboard'
import { findOvertakes } from './overtakes'
import {
  bedtimeStars,
  buildHistory,
  currentStreak,
  longestStreak,
  qualifiesSleep,
  qualifiesSteps,
  scoreSleep,
  stepStars,
} from './scoring'
import type { DailyStat, Profile } from './types'

const TZ = 'Europe/Rome'
const hm = (h: number, m = 0) => h * 60 + m

const stat = (date: string, steps: number | null, bed?: [string, string], wake?: [string, string]): DailyStat => ({
  user_id: 'u',
  date,
  steps,
  steps_source: steps == null ? null : 'manual',
  sleep_start: bed ? zonedTimeToInstant(bed[0], bed[1], TZ).toISOString() : null,
  sleep_end: wake ? zonedTimeToInstant(wake[0], wake[1], TZ).toISOString() : null,
  sleep_minutes: null,
  sleep_source: bed ? 'manual' : null,
  updated_at: `${date}T10:00:00Z`,
})

describe('dates', () => {
  it('converts local wall time to instant and back, across DST', () => {
    for (const [d, t] of [
      ['2026-03-29', '01:30'], // day DST starts in Rome
      ['2026-10-25', '23:15'],
      ['2026-07-01', '00:05'],
    ]) {
      const i = zonedTimeToInstant(d, t, TZ)
      expect(dateIn(i, TZ)).toBe(d)
      const [h, m] = t.split(':').map(Number)
      expect(minutesOfDayIn(i, TZ)).toBe(hm(h, m))
    }
  })
  it('weeks start on Monday', () => {
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09') // Sunday → Monday
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09')
  })
})

describe('step stars', () => {
  it.each([
    [null, 0],
    [9_999, 0],
    [10_000, 1],
    [15_000, 2],
    [19_999, 2],
    [20_000, 3],
    [27_999, 3],
    [28_000, 4],
    [40_000, 4],
  ])('%s steps → %s★', (steps, stars) => expect(stepStars(steps)).toBe(stars))
})

describe('bedtime stars', () => {
  it.each([
    [hm(21, 30), 3],
    [hm(23, 0), 3],
    [hm(23, 1), 2],
    [hm(0, 0), 2],
    [hm(0, 30), 1],
    [hm(1, 0), 1],
    [hm(1, 1), 0],
    [hm(4, 0), 0],
  ])('asleep at %s min → %s★', (m, stars) => expect(bedtimeStars(m)).toBe(stars))

  it('adds the duration bonus between 7 and 9 hours', () => {
    const s = scoreSleep(stat('2026-11-10', null, ['2026-11-09', '22:45'], ['2026-11-10', '06:45']), TZ)!
    expect(s.minutes).toBe(480)
    expect(s.stars).toBe(4)
    const short = scoreSleep(stat('2026-11-10', null, ['2026-11-10', '00:30'], ['2026-11-10', '06:00']), TZ)!
    expect(short.stars).toBe(1)
  })

  it('no sleep data scores null (shown as "no data")', () => {
    expect(scoreSleep(stat('2026-11-10', 9000), TZ)).toBeNull()
  })
})

describe('streaks', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']
  it('today in progress does not break the streak', () => {
    const stats = [stat(days[0], 3000), stat(days[1], 11000), stat(days[2], 12000), stat(days[3], 10500), stat(days[4], 2000)]
    const h = buildHistory(stats, [], TZ, days[0], days[4])
    expect(currentStreak(h, qualifiesSteps)).toBe(3)
    expect(longestStreak(h, qualifiesSteps)).toBe(3)
  })
  it('a missed past day breaks it', () => {
    const stats = [stat(days[0], 11000), stat(days[2], 12000), stat(days[3], 4000), stat(days[4], 10000)]
    const h = buildHistory(stats, [], TZ, days[0], days[4])
    expect(currentStreak(h, qualifiesSteps)).toBe(1)
  })
  it('sleep streak counts nights with ≥2★', () => {
    const stats = days.map((d) => stat(d, null, [addDays(d, -1), '23:30'], [d, '07:00']))
    const h = buildHistory(stats, [], TZ, days[0], days[4])
    expect(currentStreak(h, qualifiesSleep)).toBe(5)
  })
})

describe('badges', () => {
  it('Early Bird needs 7 nights in a row asleep by 23:00', () => {
    const start = '2026-11-01'
    const dates = Array.from({ length: 8 }, (_, i) => addDays(start, i))
    const stats = dates.map((d) => stat(d, null, [addDays(d, -1), '22:40'], [d, '06:40']))
    const h = buildHistory(stats, [], TZ, start, dates[7])
    const early = BADGES.find((b) => b.id === 'early-bird')!
    expect(early.earned(h)).toBe(dates[6])
    expect(early.earned(h.slice(0, 6))).toBeNull()
  })
  it('10K Club unlocks on the first 10k day', () => {
    const h = buildHistory([stat('2026-11-01', 9000), stat('2026-11-02', 10001)], [], TZ, '2026-11-01', '2026-11-02')
    expect(BADGES.find((b) => b.id === '10k-club')!.earned(h)).toBe('2026-11-02')
  })
})

describe('leaderboard', () => {
  const profile = (id: string): Profile => ({
    id,
    username: id,
    avatar_color: '#000',
    avatar_url: null,
    timezone: TZ,
    created_at: '',
  })
  const today = '2026-11-14'
  it('ranks by steps with shared ranks and puts members without data last', () => {
    const rows = buildLeaderboard(
      [
        { profile: profile('a'), stats: [{ ...stat(today, 5000), user_id: 'a' }], workouts: [] },
        { profile: profile('b'), stats: [{ ...stat(today, 9000), user_id: 'b' }], workouts: [] },
        { profile: profile('c'), stats: [{ ...stat(today, 5000), user_id: 'c' }], workouts: [] },
        { profile: profile('d'), stats: [], workouts: [] },
      ],
      'steps',
      periodRange('today', today),
      today,
    )
    expect(rows.map((r) => [r.profile.id, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', null],
    ])
  })
  it('does not score future days of the week', () => {
    const rows = buildLeaderboard(
      [{ profile: profile('a'), stats: [{ ...stat(today, 12000), user_id: 'a' }], workouts: [] }],
      'overall',
      periodRange('week', today),
      today,
    )
    expect(rows[0].nights).toBe(6) // Mon 9 → Sat 14
  })
})

describe('overtakes', () => {
  it('reports users who moved above me', () => {
    expect(findOvertakes({ me: 1, a: 2, b: 3 }, { a: 1, me: 2, b: 3 }, 'me')).toEqual(['a'])
    expect(findOvertakes({ me: 2, a: 1 }, { a: 1, me: 2 }, 'me')).toEqual([])
    expect(findOvertakes({ me: 1, a: null }, { a: 1, me: 2 }, 'me')).toEqual(['a'])
  })
})
