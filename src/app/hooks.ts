import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { repo } from '../data/repo'
import type { MemberData } from '../domain/leaderboard'
import { buildHistory, type DayScore } from '../domain/scoring'
import type { DailyStat, Member, Workout } from '../domain/types'
import { todayIn, type ISODate } from '../lib/dates'
import { useSession } from './session'

/** Runs `load` now and again after every data change. Keeps the last data while reloading. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const run = useCallback(() => {
    let alive = true
    loadRef
      .current()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let cancel = run()
    const unsub = repo.subscribe(() => {
      cancel()
      cancel = run()
    })
    return () => {
      cancel()
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading: data === undefined && !error }
}

/** "Today" in the user's timezone; re-renders every minute so midnight rolls over. */
export function useToday(): ISODate {
  const { profile } = useSession()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  return todayIn(profile.timezone)
}

export interface GroupData {
  members: Member[]
  data: MemberData[]
}

/** Members of the active group with their stats and workouts in a date range. */
export function useGroupData(from: ISODate, to: ISODate) {
  const { group } = useSession()
  return useLive<GroupData>(async () => {
    if (!group) return { members: [], data: [] }
    const members = await repo.listMembers(group.id)
    const ids = members.map((m) => m.user_id)
    const [stats, workouts] = await Promise.all([repo.listStats(ids, from, to), repo.listWorkouts(ids, from, to)])
    return {
      members,
      data: members.map((m) => ({
        profile: m.profile,
        stats: stats.filter((s) => s.user_id === m.user_id),
        workouts: workouts.filter((w) => w.user_id === m.user_id),
      })),
    }
  }, [group?.id, from, to])
}

export interface MyData {
  stats: DailyStat[]
  workouts: Workout[]
  history: DayScore[]
}

/** The signed-in user's raw data and scored history between two dates. */
export function useMyData(from: ISODate, to: ISODate) {
  const { user, profile } = useSession()
  const live = useLive(async () => {
    const [stats, workouts] = await Promise.all([
      repo.listStats([user.id], from, to),
      repo.listWorkouts([user.id], from, to),
    ])
    return { stats, workouts }
  }, [user.id, from, to])
  const history = useMemo(
    () => (live.data ? buildHistory(live.data.stats, live.data.workouts, profile.timezone, from, to) : undefined),
    [live.data, profile.timezone, from, to],
  )
  return { ...live, data: live.data && history ? { ...live.data, history } : undefined }
}
