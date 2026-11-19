// Badge catalogue. Add, remove or tweak freely: badges are computed from history, never stored.
import { Activity, BedDouble, Crown, Flag, Footprints, Moon, Mountain, Sunrise, Trophy, Zap, type LucideIcon } from 'lucide-react'
import { firstRunDate, qualifiesSteps, type DayScore } from '../domain/scoring'
import type { ISODate } from '../lib/dates'

export type BadgeTone = 'steps' | 'sleep' | 'star' | 'hobby' | 'brand'

export interface BadgeDef {
  id: string
  name: string
  description: string
  icon: LucideIcon
  tone: BadgeTone
  /** Date the badge was earned, or null. `history` is contiguous and ascending. */
  earned: (history: DayScore[]) => ISODate | null
  /** Optional progress for locked badges: [current best, target]. */
  progress?: (history: DayScore[]) => [number, number]
}

const firstDay = (h: DayScore[], pred: (d: DayScore) => boolean) => h.find(pred)?.date ?? null

const bestRun = (h: DayScore[], pred: (d: DayScore) => boolean) => {
  let best = 0
  let run = 0
  for (const d of h) {
    run = pred(d) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

const asleepBy23 = (d: DayScore) => d.sleep != null && d.sleep.bedtimeStars >= 3
const asleepAfter1 = (d: DayScore) => d.sleep != null && d.sleep.bedtimeStars === 0
const wellRested = (d: DayScore) => d.sleep != null && d.sleep.durationBonus > 0
const maxSteps = (h: DayScore[]) => Math.max(0, ...h.map((d) => d.steps ?? 0))

export const BADGES: BadgeDef[] = [
  {
    id: 'first-step',
    name: 'First Step',
    description: 'Log your first day of data.',
    icon: Flag,
    tone: 'brand',
    earned: (h) => firstDay(h, (d) => d.steps != null || d.sleep != null),
  },
  {
    id: '10k-club',
    name: '10K Club',
    description: 'Walk 10,000 steps in a single day.',
    icon: Footprints,
    tone: 'steps',
    earned: (h) => firstDay(h, (d) => (d.steps ?? 0) >= 10_000),
    progress: (h) => [maxSteps(h), 10_000],
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    description: 'Keep a 7-day steps streak.',
    icon: Zap,
    tone: 'steps',
    earned: (h) => firstRunDate(h, qualifiesSteps, 7),
    progress: (h) => [bestRun(h, qualifiesSteps), 7],
  },
  {
    id: 'ultra-walker',
    name: 'Ultra Walker',
    description: 'Walk 25,000 steps in a single day.',
    icon: Mountain,
    tone: 'steps',
    earned: (h) => firstDay(h, (d) => (d.steps ?? 0) >= 25_000),
    progress: (h) => [maxSteps(h), 25_000],
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Fall asleep by 23:00 for 7 nights in a row.',
    icon: Sunrise,
    tone: 'sleep',
    earned: (h) => firstRunDate(h, asleepBy23, 7),
    progress: (h) => [bestRun(h, asleepBy23), 7],
  },
  {
    id: 'well-rested',
    name: 'Well Rested',
    description: 'Sleep 7–9 hours for 5 nights in a row.',
    icon: BedDouble,
    tone: 'sleep',
    earned: (h) => firstRunDate(h, wellRested, 5),
    progress: (h) => [bestRun(h, wellRested), 5],
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Fall asleep after 01:00 three nights in a row. Not a compliment.',
    icon: Moon,
    tone: 'brand',
    earned: (h) => firstRunDate(h, asleepAfter1, 3),
  },
  {
    id: 'perfect-day',
    name: 'Perfect Day',
    description: 'Max stars for both steps and sleep on the same day.',
    icon: Crown,
    tone: 'star',
    earned: (h) => firstDay(h, (d) => d.stepsStars >= 4 && d.sleepStars >= 4),
  },
  {
    id: 'hobbyist',
    name: 'Hobbyist',
    description: 'Log 10 workout or hobby sessions.',
    icon: Activity,
    tone: 'hobby',
    earned: (h) => {
      let n = 0
      for (const d of h) if ((n += d.workouts) >= 10) return d.date
      return null
    },
    progress: (h) => [Math.min(10, h.reduce((s, d) => s + d.workouts, 0)), 10],
  },
  {
    id: 'star-collector',
    name: 'Star Collector',
    description: 'Collect 100 stars in total.',
    icon: Trophy,
    tone: 'star',
    earned: (h) => {
      let n = 0
      for (const d of h) if ((n += d.total) >= 100) return d.date
      return null
    },
    progress: (h) => [Math.min(100, h.reduce((s, d) => s + d.total, 0)), 100],
  },
]

