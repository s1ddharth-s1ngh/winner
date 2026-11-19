import { addDays, startOfMonth, startOfWeek, type ISODate } from '../lib/dates'
import { bedtimeRank, fromBedtimeRank, type DayScore } from './scoring'

/** Head-to-head numbers for one side. null = no data. */
export interface Side {
  stepsToday: number | null
  stepsYesterday: number | null
  avg7: number | null
  bestDay: number | null
  bestWeek: number | null
  daysWon: number
  longestWinStreak: number
  avgSleep7: number | null
  avgBedtime7: number | null
  starsWeek: number
  starsMonth: number
  starsTotal: number
}

/** 'a', 'b', or null for a tie / no steps on either side. */
export type Winner = 'a' | 'b' | null

export interface Comparison {
  a: Side
  b: Side
  /** One entry per completed day (before today), ascending. */
  winners: { date: ISODate; winner: Winner }[]
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null)

/** Steps duel of one day. Missing steps count as 0; nobody wins when both are 0. */
export function dayWinner(a: DayScore | undefined, b: DayScore | undefined): Winner {
  const sa = a?.steps ?? 0
  const sb = b?.steps ?? 0
  return sa === sb ? null : sa > sb ? 'a' : 'b'
}

/**
 * Compares two scored histories covering the same days, ascending and ending today.
 * Today is still in progress: it shows in "today" values but never counts as won.
 */
export function compareHistories(a: DayScore[], b: DayScore[], today: ISODate): Comparison {
  const bByDate = new Map(b.map((d) => [d.date, d]))
  const winners = a.filter((d) => d.date < today).map((d) => ({ date: d.date, winner: dayWinner(d, bByDate.get(d.date)) }))

  const side = (h: DayScore[], me: 'a' | 'b'): Side => {
    const at = (date: ISODate) => h.find((d) => d.date === date)
    const last7 = h.filter((d) => d.date > addDays(today, -7))
    const withSteps = h.filter((d) => d.steps != null)
    const weeks = new Map<ISODate, number>()
    for (const d of withSteps) weeks.set(startOfWeek(d.date), (weeks.get(startOfWeek(d.date)) ?? 0) + d.steps!)
    let run = 0
    let longest = 0
    for (const w of winners) {
      run = w.winner === me ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    const nights = last7.filter((d) => d.sleep)
    const avgRank = avg(nights.map((d) => bedtimeRank(d.sleep!.bedtime)))
    const stars = (from: ISODate) => h.filter((d) => d.date >= from).reduce((s, d) => s + d.total, 0)
    return {
      stepsToday: at(today)?.steps ?? null,
      stepsYesterday: at(addDays(today, -1))?.steps ?? null,
      avg7: avg(last7.filter((d) => d.steps != null).map((d) => d.steps!)),
      bestDay: max(withSteps.map((d) => d.steps!)),
      bestWeek: max([...weeks.values()]),
      daysWon: winners.filter((w) => w.winner === me).length,
      longestWinStreak: longest,
      avgSleep7: avg(nights.map((d) => d.sleep!.minutes)),
      avgBedtime7: avgRank == null ? null : fromBedtimeRank(avgRank),
      starsWeek: stars(startOfWeek(today)),
      starsMonth: stars(startOfMonth(today)),
      starsTotal: stars(''),
    }
  }

  return { a: side(a, 'a'), b: side(b, 'b'), winners }
}
