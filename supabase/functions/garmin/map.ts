// Pure mapping from Garmin Connect Personal API responses to our rows (no Deno APIs, unit tested with vitest).
// Schemas: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
import { LIMITS, dateIn } from '../ingest-health/validate.ts'

export interface DayWrite {
  date: string
  steps?: number
  flights?: number
}
export interface SleepWrite {
  date: string
  start: string
  end: string
  minutes: number
}
export interface WorkoutWrite {
  external_id: string
  date: string
  type: string
  duration_min: number
  note: string | null
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const int = (v: unknown, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : undefined

/** GET /usersummary-service/v2/dailysummaries → { data: UserDailySummaryV2DTO[] }. */
export function mapDailies(body: unknown): DayWrite[] {
  const days = new Map<string, DayWrite>()
  for (const d of arr(obj(body).data).map(obj)) {
    if (!isDate(d.calendarDate)) continue
    const movement = obj(d.movement)
    const steps = int(obj(movement.steps).value, LIMITS.maxSteps)
    const flights = int(obj(movement.floorsAscended).value, LIMITS.maxFlights)
    // Several summaries for one date (different sources): keep the highest values.
    const day = days.get(d.calendarDate) ?? { date: d.calendarDate }
    if (steps !== undefined) day.steps = Math.max(day.steps ?? 0, steps)
    if (flights !== undefined) day.flights = Math.max(day.flights ?? 0, flights)
    days.set(d.calendarDate, day)
  }
  return [...days.values()].filter((d) => d.steps !== undefined || d.flights !== undefined)
}

/** Garmin sends sleep timestamps as epoch milliseconds; also accept ISO strings (UTC when no offset). */
export function toInstant(v: unknown): Date | null {
  let d: Date | null = null
  if (typeof v === 'number') d = new Date(v)
  else if (typeof v === 'string' && /^\d{10,}$/.test(v)) d = new Date(Number(v))
  else if (typeof v === 'string' && v.length <= 40) d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`)
  return d && !Number.isNaN(d.getTime()) ? d : null
}

/** GET /sleep-service/sleep/dailySleepSummariesByDate → DailySleepDTO[]. The night belongs to the wake-up date in `tz`. */
export function mapSleep(body: unknown, tz: string): SleepWrite[] {
  const out: SleepWrite[] = []
  for (const s of arr(body).map(obj)) {
    const start = toInstant(s.sleepStartTimestampGMT)
    const end = toInstant(s.sleepEndTimestampGMT)
    if (!start || !end || end <= start) continue
    const span = (end.getTime() - start.getTime()) / 60_000
    const minutes = int(s.sleepTimeSeconds, LIMITS.maxSleepMinutes * 60)
    if (minutes === undefined || span > LIMITS.maxSleepMinutes) continue
    const m = Math.round(minutes / 60)
    if (m < 1 || m > span + 1) continue
    out.push({ date: dateIn(end, tz), start: start.toISOString(), end: end.toISOString(), minutes: m })
  }
  return out
}

/** Garmin activity type key (e.g. "trail_running", "road_biking") → one of WORKOUT_TYPES in src/config/scoring.ts. */
export function workoutType(typeKey: string): string {
  const k = typeKey.toLowerCase()
  const rules: [RegExp, string][] = [
    [/stair|strength|fitness_equipment|cardio|hiit|elliptical|indoor_rowing/, 'Gym'],
    [/run/, 'Run'],
    [/cycl|bik|ride/, 'Cycling'],
    [/walk|hik/, 'Walk'],
    [/swim/, 'Swim'],
    [/yoga|pilates/, 'Yoga'],
    [/soccer|^football/, 'Football'],
    [/padel/, 'Padel'],
    [/tennis/, 'Tennis'],
    [/danc/, 'Dance'],
    [/climb|boulder/, 'Climbing'],
  ]
  return rules.find(([re]) => re.test(k))?.[1] ?? 'Other'
}

/** GET /activitylist-service/activities/search/activities → SummarizedActivityDTO[]. */
export function mapActivities(body: unknown): WorkoutWrite[] {
  const out: WorkoutWrite[] = []
  for (const a of arr(body).map(obj)) {
    const id = a.activityId
    const date = typeof a.startTimeLocal === 'string' ? a.startTimeLocal.slice(0, 10) : null
    const seconds = typeof a.duration === 'number' ? a.duration : null
    if ((typeof id !== 'number' && typeof id !== 'string') || !isDate(date) || seconds === null) continue
    const minutes = Math.min(600, Math.round(seconds / 60))
    if (minutes < 1) continue
    const typeKey = obj(a.activityType).typeKey
    const name = typeof a.activityName === 'string' ? a.activityName.trim().slice(0, 280) : ''
    out.push({
      external_id: `garmin:${id}`,
      date,
      type: workoutType(typeof typeKey === 'string' ? typeKey : ''),
      duration_min: minutes,
      note: name || null,
    })
  }
  return out
}
