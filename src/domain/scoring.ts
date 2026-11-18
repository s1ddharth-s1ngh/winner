import {
  BEDTIME_DAY_START,
  BEDTIME_TIERS,
  FLIGHT_TIERS,
  SLEEP_DURATION_BONUS,
  STEP_TIERS,
  STREAKS,
  WORKOUT_BONUS,
} from '../config/scoring'
import { eachDay, minutesOfDayIn, type ISODate } from '../lib/dates'
import type { DailyStat, Workout } from './types'

export interface SleepScore {
  /** Local minutes since midnight when the user fell asleep. */
  bedtime: number
  /** Local minutes since midnight when the user woke up (null if unknown). */
  wake: number | null
  minutes: number
  bedtimeStars: number
  durationBonus: number
  stars: number
}

export interface DayScore {
  date: ISODate
  steps: number | null
  stepsStars: number
  flights: number | null
  flightsStars: number
  /** null = no sleep data for the night that ended on this date. */
  sleep: SleepScore | null
  sleepStars: number
  workouts: number
  workoutMinutes: number
  workoutStars: number
  total: number
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const DAY_START = toMinutes(BEDTIME_DAY_START)

/** Position of a bedtime on the evening-first clock (0 = BEDTIME_DAY_START). Lower = earlier. */
export const bedtimeRank = (minutesOfDay: number) => (minutesOfDay - DAY_START + 1440) % 1440
export const fromBedtimeRank = (rank: number) => (Math.round(rank) + DAY_START) % 1440

function tierStars(value: number | null, tiers: readonly { min: number; stars: number }[]): number {
  if (value == null) return 0
  let stars = 0
  for (const tier of tiers) if (value >= tier.min) stars = tier.stars
  return stars
}

export const stepStars = (steps: number | null) => tierStars(steps, STEP_TIERS)
export const flightStars = (flights: number | null) => tierStars(flights, FLIGHT_TIERS)

export function bedtimeStars(minutesOfDay: number): number {
  const rank = bedtimeRank(minutesOfDay)
  for (const tier of BEDTIME_TIERS) if (rank <= bedtimeRank(toMinutes(tier.until))) return tier.stars
  return 0
}

export function sleepMinutesOf(stat: Pick<DailyStat, 'sleep_start' | 'sleep_end' | 'sleep_minutes'>): number | null {
  if (stat.sleep_minutes != null) return stat.sleep_minutes
  if (stat.sleep_start && stat.sleep_end)
    return Math.round((new Date(stat.sleep_end).getTime() - new Date(stat.sleep_start).getTime()) / 60_000)
  return null
}

export function scoreSleep(stat: DailyStat | undefined, tz: string): SleepScore | null {
  if (!stat?.sleep_start) return null
  const bedtime = minutesOfDayIn(stat.sleep_start, tz)
  const minutes = sleepMinutesOf(stat) ?? 0
  const bStars = bedtimeStars(bedtime)
  const bonus =
    minutes >= SLEEP_DURATION_BONUS.minMinutes && minutes <= SLEEP_DURATION_BONUS.maxMinutes
      ? SLEEP_DURATION_BONUS.stars
      : 0
  return {
    bedtime,
    wake: stat.sleep_end ? minutesOfDayIn(stat.sleep_end, tz) : null,
    minutes,
    bedtimeStars: bStars,
    durationBonus: bonus,
    stars: bStars + bonus,
  }
}

export function scoreDay(date: ISODate, stat: DailyStat | undefined, workouts: Workout[], tz: string): DayScore {
  const steps = stat?.steps ?? null
  const stepsStars = stepStars(steps)
  const flights = stat?.flights ?? null
  const flightsStars = flightStars(flights)
  const sleep = scoreSleep(stat, tz)
  const sleepStars = sleep?.stars ?? 0
  const dayWorkouts = workouts.filter((w) => w.date === date)
  const workoutStars = dayWorkouts.length > 0 ? WORKOUT_BONUS.stars : 0
  return {
    date,
    steps,
    stepsStars,
    flights,
    flightsStars,
    sleep,
    sleepStars,
    workouts: dayWorkouts.length,
    workoutMinutes: dayWorkouts.reduce((s, w) => s + w.duration_min, 0),
    workoutStars,
    total: stepsStars + flightsStars + sleepStars + workoutStars,
  }
}

/** Contiguous, ascending day scores for one user between two dates (inclusive). */
export function buildHistory(
  stats: DailyStat[],
  workouts: Workout[],
  tz: string,
  from: ISODate,
  to: ISODate,
): DayScore[] {
  const byDate = new Map(stats.map((s) => [s.date, s]))
  return eachDay(from, to).map((d) => scoreDay(d, byDate.get(d), workouts, tz))
}

export const qualifiesSteps = (d: DayScore) => d.stepsStars >= STREAKS.stepsMinStars
export const qualifiesSleep = (d: DayScore) => d.sleepStars >= STREAKS.sleepMinStars

/**
 * Current streak ending today. Today still in progress does not break it:
 * if today does not qualify (yet), counting starts from yesterday.
 */
export function currentStreak(history: DayScore[], qualifies: (d: DayScore) => boolean): number {
  let i = history.length - 1
  if (i >= 0 && !qualifies(history[i])) i--
  let n = 0
  while (i >= 0 && qualifies(history[i])) {
    n++
    i--
  }
  return n
}

export function longestStreak(history: DayScore[], qualifies: (d: DayScore) => boolean): number {
  let best = 0
  let run = 0
  for (const d of history) {
    run = qualifies(d) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

/** Date on which a run of `n` consecutive qualifying days was first completed, or null. */
export function firstRunDate(history: DayScore[], qualifies: (d: DayScore) => boolean, n: number): ISODate | null {
  let run = 0
  for (const d of history) {
    run = qualifies(d) ? run + 1 : 0
    if (run >= n) return d.date
  }
  return null
}
