import { addDays, endOfMonth, startOfMonth, startOfWeek, type ISODate } from '../lib/dates'
import { bedtimeRank, buildHistory, fromBedtimeRank, type DayScore } from './scoring'
import type { DailyStat, Profile, Workout } from './types'

export type Board = 'steps' | 'sleep' | 'overall'
export type Period = 'today' | 'week' | 'month'

export interface Range {
  from: ISODate
  to: ISODate
}

export function periodRange(period: Period, today: ISODate): Range {
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') return { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }
  return { from: startOfMonth(today), to: endOfMonth(today) }
}

export interface MemberData {
  profile: Profile
  stats: DailyStat[]
  workouts: Workout[]
}

export interface Row {
  profile: Profile
  /** Competition rank (1, 1, 3…). null = no data for this board in the period. */
  rank: number | null
  steps: number
  stepsStars: number
  flightsStars: number
  sleepStars: number
  /** Nights with sleep data / nights elapsed in the period. */
  sleepNights: number
  nights: number
  /** Average bedtime (minutes of day) over nights with data. */
  avgBedtime: number | null
  avgSleepMinutes: number | null
  workoutStars: number
  totalStars: number
  /** Latest data update in the period. */
  updatedAt: string | null
  days: DayScore[]
}

export function summarize(m: MemberData, range: Range, today: ISODate): Row {
  // Never score future days of the period.
  const to = range.to > today ? today : range.to
  const days = buildHistory(m.stats, m.workouts, m.profile.timezone, range.from, to)
  const slept = days.filter((d) => d.sleep)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const avgRank = avg(slept.map((d) => bedtimeRank(d.sleep!.bedtime)))
  const inRange = m.stats.filter((s) => s.date >= range.from && s.date <= to)
  return {
    profile: m.profile,
    rank: null,
    steps: days.reduce((s, d) => s + (d.steps ?? 0), 0),
    stepsStars: days.reduce((s, d) => s + d.stepsStars, 0),
    flightsStars: days.reduce((s, d) => s + d.flightsStars, 0),
    sleepStars: days.reduce((s, d) => s + d.sleepStars, 0),
    sleepNights: slept.length,
    nights: days.length,
    // Average on the evening-first clock, then convert back to a time of day.
    avgBedtime: avgRank == null ? null : fromBedtimeRank(avgRank),
    avgSleepMinutes: avg(slept.map((d) => d.sleep!.minutes)),
    workoutStars: days.reduce((s, d) => s + d.workoutStars, 0),
    totalStars: days.reduce((s, d) => s + d.total, 0),
    updatedAt: inRange.reduce<string | null>((a, s) => (a && a > s.updated_at ? a : s.updated_at), null),
    days,
  }
}

const hasData = (r: Row, board: Board) =>
  board === 'steps'
    ? r.days.some((d) => d.steps != null)
    : board === 'sleep'
      ? r.sleepNights > 0
      : r.days.some((d) => d.steps != null || d.flights != null || d.sleep != null || d.workouts > 0)

export const boardValue = (r: Row, board: Board) =>
  board === 'steps' ? r.steps : board === 'sleep' ? r.sleepStars : r.totalStars

/** Rows sorted best first, ranked with ties sharing a rank; members without data go last, unranked. */
export function buildLeaderboard(members: MemberData[], board: Board, range: Range, today: ISODate): Row[] {
  const rows = members.map((m) => summarize(m, range, today))
  const ranked = rows.filter((r) => hasData(r, board))
  const unranked = rows.filter((r) => !hasData(r, board))
  ranked.sort((a, b) => {
    const diff = boardValue(b, board) - boardValue(a, board)
    if (diff !== 0) return diff
    // Sleep tie-break: earlier average bedtime wins.
    if (board === 'sleep' && a.avgBedtime != null && b.avgBedtime != null)
      return bedtimeRank(a.avgBedtime) - bedtimeRank(b.avgBedtime)
    return a.profile.username.localeCompare(b.profile.username)
  })
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1]
    r.rank = prev && boardValue(prev, board) === boardValue(r, board) ? prev.rank : i + 1
  })
  unranked.sort((a, b) => a.profile.username.localeCompare(b.profile.username))
  return [...ranked, ...unranked]
}
