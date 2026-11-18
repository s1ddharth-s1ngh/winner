// Deterministic fake friends for the local demo backend, so every screen has something to show.
import { WORKOUT_TYPES } from '../config/scoring'
import { addDays, dateIn, minutesOfDayIn, zonedTimeToInstant, clock, type ISODate } from '../lib/dates'
import type { DailyStat, Group, Profile, Workout } from '../domain/types'

export const DEMO_GROUP_CODE = 'DEMO42'
const TZ = 'Europe/Rome'

interface Persona {
  id: string
  username: string
  color: string
  steps: [number, number]
  flights: [number, number]
  /** Mean bedtime as minutes after 18:00 and spread in minutes. null = never tracks sleep. */
  bed: [number, number] | null
  sleepHours: [number, number]
  workout: { type: (typeof WORKOUT_TYPES)[number]; perWeek: number; minutes: [number, number] }
}

const PERSONAS: Persona[] = [
  { id: 'demo-giulia', username: 'Giulia', flights: [20, 60], color: '#db2777', steps: [8500, 13500], bed: [285, 30], sleepHours: [7.3, 8.6], workout: { type: 'Yoga', perWeek: 2, minutes: [45, 60] } },
  { id: 'demo-marco', username: 'Marco', flights: [50, 130], color: '#0284c7', steps: [10500, 19000], bed: [390, 50], sleepHours: [5.8, 7.2], workout: { type: 'Gym', perWeek: 3, minutes: [50, 90] } },
  { id: 'demo-sara', username: 'Sara', flights: [10, 45], color: '#0d9488', steps: [6000, 10500], bed: [320, 30], sleepHours: [7, 8.2], workout: { type: 'Run', perWeek: 1.5, minutes: [25, 50] } },
  { id: 'demo-luca', username: 'Luca', flights: [5, 30], color: '#d97706', steps: [4000, 9500], bed: null, sleepHours: [0, 0], workout: { type: 'Padel', perWeek: 1, minutes: [60, 90] } },
  { id: 'demo-elena', username: 'Elena', flights: [30, 90], color: '#7c3aed', steps: [7500, 12500], bed: [335, 40], sleepHours: [6.5, 8], workout: { type: 'Swim', perWeek: 1, minutes: [40, 60] } },
]

export const demoPersona = (id: string): Persona => PERSONAS.find((p) => p.id === id)!

/** Small seeded PRNG (mulberry32) so the demo looks the same on every reload. */
export function rng(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t + t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (r: () => number, [lo, hi]: [number, number]) => lo + r() * (hi - lo)

/** Fraction of the day's steps already walked at this local time. */
const dayProgress = (minutes: number) => Math.min(1, Math.max(0, (minutes - 7 * 60) / (15 * 60)))

export interface GeneratedDay {
  stat: DailyStat | null
  workout: Workout | null
}

/** One persona-like day. Today's steps are scaled to the current time; tonight's sleep only once woken up. */
export function generateDay(p: Persona, date: ISODate, now: Date): GeneratedDay {
  const r = rng(`${p.id}:${date}`)
  const today = dateIn(now, TZ)
  const nowMin = minutesOfDayIn(now, TZ)
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())
  // Some days are just skipped (phone left at home…)
  if (r() < 0.04) return { stat: null, workout: null }

  let steps = Math.round(between(r, p.steps) * (weekend ? 0.9 + r() * 0.4 : 1))
  let flights = Math.round(between(r, p.flights))
  if (date === today) {
    steps = Math.round(steps * dayProgress(nowMin))
    flights = Math.round(flights * dayProgress(nowMin))
  }

  let sleep_start: string | null = null
  let sleep_end: string | null = null
  let sleep_minutes: number | null = null
  if (p.bed) {
    const bedRank = p.bed[0] + (r() * 2 - 1) * p.bed[1] + (weekend ? 30 : 0)
    const minutes = Math.round(between(r, p.sleepHours) * 60)
    const bedMin = Math.round(18 * 60 + bedRank) % 1440
    const bedDate = bedMin >= 18 * 60 ? addDays(date, -1) : date
    const start = zonedTimeToInstant(bedDate, clock(bedMin), TZ)
    const end = new Date(start.getTime() + minutes * 60_000)
    if (end <= now) {
      sleep_start = start.toISOString()
      sleep_end = end.toISOString()
      sleep_minutes = minutes
    }
  }

  const updated = date === today ? new Date(now.getTime() - Math.round(r() * 50) * 60_000) : zonedTimeToInstant(date, '22:00', TZ)
  const workoutChance = p.workout.perWeek / 7
  const hasWorkout = r() < workoutChance && (date !== today || nowMin > 19 * 60)
  return {
    stat: {
      user_id: p.id,
      date,
      steps,
      steps_source: p.id === 'demo-giulia' ? 'ios_shortcut' : 'health_connect',
      flights,
      flights_source: p.id === 'demo-giulia' ? 'ios_shortcut' : 'health_connect',
      sleep_start,
      sleep_end,
      sleep_minutes,
      sleep_source: sleep_start ? (p.id === 'demo-giulia' ? 'ios_shortcut' : 'health_connect') : null,
      updated_at: updated.toISOString(),
    },
    workout: hasWorkout
      ? {
          id: `${p.id}-w-${date}`,
          user_id: p.id,
          date,
          type: p.workout.type,
          duration_min: Math.round(between(r, p.workout.minutes) / 5) * 5,
          note: null,
          created_at: updated.toISOString(),
        }
      : null,
  }
}

export function demoProfiles(): Profile[] {
  return PERSONAS.map((p) => ({
    id: p.id,
    username: p.username,
    avatar_color: p.color,
    avatar_url: null,
    cover_color: null,
    cover_url: null,
    timezone: TZ,
    created_at: '2026-01-01T00:00:00Z',
  }))
}

export const demoGroup = (): Group => ({
  id: 'demo-group',
  name: 'Demo Squad',
  invite_code: DEMO_GROUP_CODE,
  created_by: PERSONAS[0].id,
  created_at: '2026-01-01T00:00:00Z',
})

export function demoHistory(days: number, now = new Date()) {
  const today = dateIn(now, TZ)
  const stats: DailyStat[] = []
  const workouts: Workout[] = []
  for (const p of PERSONAS)
    for (let i = days - 1; i >= 0; i--) {
      const g = generateDay(p, addDays(today, -i), now)
      if (g.stat) stats.push(g.stat)
      if (g.workout) workouts.push(g.workout)
    }
  return { stats, workouts }
}

/** A plausible personal history for the signed-in user (demo button in Settings). */
export function myDemoHistory(userId: string, tz: string, days: number, now = new Date()) {
  const me: Persona = { ...PERSONAS[2], id: userId, steps: [6500, 14500], flights: [15, 100], bed: [310, 45], workout: { type: 'Gym', perWeek: 2, minutes: [40, 75] } }
  const today = dateIn(now, tz)
  const stats: DailyStat[] = []
  const workouts: Workout[] = []
  for (let i = days; i >= 1; i--) {
    const g = generateDay(me, addDays(today, -i), now)
    if (g.stat) stats.push({ ...g.stat, steps_source: 'manual', flights_source: 'manual', sleep_source: g.stat.sleep_start ? 'manual' : null })
    if (g.workout) workouts.push(g.workout)
  }
  return { stats, workouts }
}
