// Every game number lives here. Change a value and the whole history is re-scored
// (stars are computed from raw data, never stored).

/** Stars for daily steps. Highest matching tier wins. */
export const STEP_TIERS = [
  { min: 5_000, stars: 1 },
  { min: 8_000, stars: 2 },
  { min: 10_000, stars: 3 },
  { min: 15_000, stars: 4 },
] as const

/** Stars for the time you fall asleep (local time). First tier whose `until` is not passed wins; later = 0★. */
export const BEDTIME_TIERS = [
  { until: '23:00', stars: 3 },
  { until: '00:00', stars: 2 },
  { until: '01:00', stars: 1 },
] as const

/**
 * Bedtimes are compared on a clock that starts at this hour, so 22:30 < 23:59 < 00:30 < 01:15.
 * Falling asleep between this hour and the first tier counts as early.
 */
export const BEDTIME_DAY_START = '18:00'

/** Bonus when the night's sleep duration is inside this range (inclusive). */
export const SLEEP_DURATION_BONUS = { minMinutes: 7 * 60, maxMinutes: 9 * 60, stars: 1 } as const

/** Bonus on days with at least one logged workout / hobby session (max once a day). */
export const WORKOUT_BONUS = { stars: 1 } as const

/** A day / night extends a streak when it reaches these stars. */
export const STREAKS = { stepsMinStars: 3, sleepMinStars: 2 } as const

/** Personal targets shown in the UI (rings, chart goal lines). */
export const GOALS = { dailySteps: 10_000, bedtime: '23:00', sleepMinutes: 8 * 60 } as const

/** Leaderboard notifications ("X passed you"). */
export const NOTIFICATIONS = { maxPerDay: 5 } as const

/** Input validation shared by manual entry and the ingest endpoint. */
export const LIMITS = { maxSteps: 100_000, maxSleepMinutes: 16 * 60 } as const

export const MAX_STEP_STARS = Math.max(...STEP_TIERS.map((t) => t.stars))
export const MAX_SLEEP_STARS = Math.max(...BEDTIME_TIERS.map((t) => t.stars)) + SLEEP_DURATION_BONUS.stars
export const MAX_DAY_STARS = MAX_STEP_STARS + MAX_SLEEP_STARS + WORKOUT_BONUS.stars

/** Workout / hobby types for the log. Add or remove freely. */
export const WORKOUT_TYPES = [
  'Gym',
  'Run',
  'Walk',
  'Cycling',
  'Swim',
  'Yoga',
  'Football',
  'Padel',
  'Tennis',
  'Dance',
  'Climbing',
  'Other',
] as const
