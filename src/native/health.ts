// Health Connect sync for the Android (Capacitor) build. No-ops on the web.
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Health, type HealthSample } from '@capgo/capacitor-health'
import { useEffect } from 'react'
import { LIMITS } from '../config/scoring'
import { repo } from '../data/repo'
import type { DailyStat } from '../domain/types'
import { addDays, dateIn, todayIn, zonedTimeToInstant } from '../lib/dates'

export const isAndroidApp = () => Capacitor.getPlatform() === 'android'

/** iPhone/iPad web (iPadOS reports itself as a Mac with touch). */
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Runs the Apple Health shortcut; the name must match docs/guides/ios-shortcut.md. */
export const IOS_SHORTCUT_URL = 'shortcuts://run-shortcut?name=Winner%20for%20Life%20sync'

const LAST_SYNC = 'wfl:health:lastSync'
const READ = { read: ['steps', 'flightsClimbed', 'sleep'] as ('steps' | 'flightsClimbed' | 'sleep')[] }

export const lastHealthSync = () => localStorage.getItem(LAST_SYNC)

export async function healthStatus(): Promise<'unavailable' | 'needs-permission' | 'connected'> {
  if (!isAndroidApp()) return 'unavailable'
  const { available } = await Health.isAvailable()
  if (!available) return 'unavailable'
  const s = await Health.checkAuthorization(READ)
  return s.readAuthorized.includes('steps') ? 'connected' : 'needs-permission'
}

export async function connectHealth(): Promise<boolean> {
  const s = await Health.requestAuthorization(READ)
  return s.readAuthorized.includes('steps')
}

export const openHealthSettings = () => Health.openHealthConnectSettings()

/** Minutes actually asleep: sum of non-awake stages when available, else the session length. */
function asleepMinutes(s: HealthSample): number {
  if (s.stages?.length) return Math.round(s.stages.filter((x) => x.stage !== 'awake' && x.stage !== 'inBed').reduce((t, x) => t + x.durationMinutes, 0))
  return Math.round(s.value)
}

/**
 * Pulls the last `days` days from Health Connect and upserts them.
 * Steps use an aggregate query (Health Connect de-duplicates phone + watch).
 * Fields the user entered by hand are never overwritten.
 */
export async function syncHealth(userId: string, tz: string, days = 3): Promise<number> {
  const today = todayIn(tz)
  const fromDate = addDays(today, -(days - 1))
  const start = zonedTimeToInstant(fromDate, '00:00', tz)
  const now = new Date()

  const existing = new Map((await repo.listStats([userId], fromDate, today)).map((s) => [s.date, s]))
  const manual = (d: string, field: 'steps_source' | 'flights_source' | 'sleep_source') => existing.get(d)?.[field] === 'manual'

  const { samples: stepBuckets } = await Health.queryAggregated({
    dataType: 'steps',
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    bucket: 'day',
    aggregation: 'sum',
  })

  // Health Connect cannot aggregate floors, so sum the raw records per local day.
  // shortcut: phone + watch records are not de-duplicated; upgrade if someone's flights look doubled.
  const flightsByDate = new Map<string, number>()
  const { samples: floors } = await Health.readSamples({
    dataType: 'flightsClimbed',
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    limit: 1000,
  }).catch(() => ({ samples: [] as HealthSample[] })) // permission not granted yet: skip flights
  for (const f of floors) {
    const date = dateIn(f.startDate, tz)
    flightsByDate.set(date, (flightsByDate.get(date) ?? 0) + f.value)
  }

  // Sessions that ended in the window; the night belongs to the wake-up date.
  const { samples: sleeps } = await Health.readSamples({
    dataType: 'sleep',
    startDate: addHours(start, -18).toISOString(),
    endDate: now.toISOString(),
    limit: 200,
  })
  const nights = new Map<string, HealthSample>()
  for (const s of sleeps) {
    const date = dateIn(s.endDate, tz)
    if (date < fromDate) continue
    const prev = nights.get(date)
    // Keep the main (longest) session; naps are ignored.
    if (!prev || asleepMinutes(s) > asleepMinutes(prev)) nights.set(date, s)
  }

  let written = 0
  for (const b of stepBuckets) {
    const date = dateIn(b.startDate, tz)
    const steps = Math.round(b.value)
    if (date < fromDate || manual(date, 'steps_source') || steps > LIMITS.maxSteps) continue
    if (existing.get(date)?.steps === steps) continue
    await repo.saveStats({ date, steps, source: 'health_connect' })
    written++
  }
  for (const [date, total] of flightsByDate) {
    const flights = Math.round(total)
    if (date < fromDate || manual(date, 'flights_source') || flights > LIMITS.maxFlights) continue
    if (existing.get(date)?.flights === flights) continue
    await repo.saveStats({ date, flights, source: 'health_connect' })
    written++
  }
  for (const [date, s] of nights) {
    const minutes = asleepMinutes(s)
    if (manual(date, 'sleep_source') || minutes <= 0 || minutes > LIMITS.maxSleepMinutes) continue
    const prev: DailyStat | undefined = existing.get(date)
    if (prev?.sleep_start === s.startDate && prev.sleep_minutes === minutes) continue
    await repo.saveStats({ date, sleep_start: s.startDate, sleep_end: s.endDate, sleep_minutes: minutes, source: 'health_connect' })
    written++
  }
  localStorage.setItem(LAST_SYNC, now.toISOString())
  return written
}

const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000)

const MIN_INTERVAL_MS = 10 * 60_000

/** Android app only: sync on open and whenever the app comes back to the foreground. */
export function useHealthAutoSync(userId: string, tz: string) {
  useEffect(() => {
    if (!isAndroidApp()) return
    const run = async () => {
      const last = lastHealthSync()
      if (last && Date.now() - new Date(last).getTime() < MIN_INTERVAL_MS) return
      if ((await healthStatus()) !== 'connected') return
      await syncHealth(userId, tz).catch((e) => console.warn('Health sync failed', e))
    }
    void run()
    const sub = App.addListener('resume', () => void run())
    return () => void sub.then((s) => s.remove())
  }, [userId, tz])
}
