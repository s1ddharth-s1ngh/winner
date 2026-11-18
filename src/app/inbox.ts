// "X passed you" inbox. Client-side for now: compares today's ranking with the last one this device saw.
// Server push (Web Push) is planned in docs/plan/phase-4-notifications.md.
import { useEffect, useSyncExternalStore } from 'react'
import { NOTIFICATIONS } from '../config/scoring'
import { buildLeaderboard, periodRange, type Board } from '../domain/leaderboard'
import { findOvertakes, type RankSnapshot } from '../domain/overtakes'
import { useGroupData, useToday } from './hooks'
import { useSession } from './session'

export interface InboxItem {
  id: string
  at: string
  board: Extract<Board, 'steps' | 'overall'>
  userId: string
  username: string
  color: string
  read: boolean
}

export interface NotifyPrefs {
  steps: boolean
  overall: boolean
  system: boolean
}

const EVENT = 'wfl:inbox'
const inboxKey = (me: string) => `wfl:inbox:${me}`
const PREFS_KEY = 'wfl:notify'

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event(EVENT))
}

export const getPrefs = (): NotifyPrefs => ({ steps: true, overall: true, system: false, ...read<Partial<NotifyPrefs>>(PREFS_KEY, {}) })
export const setPrefs = (p: NotifyPrefs) => write(PREFS_KEY, p)

const cache = new Map<string, { raw: string | null; items: InboxItem[] }>()
function getItems(me: string): InboxItem[] {
  const raw = localStorage.getItem(inboxKey(me))
  const hit = cache.get(me)
  if (hit && hit.raw === raw) return hit.items
  const items = read<InboxItem[]>(inboxKey(me), [])
  cache.set(me, { raw, items })
  return items
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useInbox() {
  const { user } = useSession()
  const items = useSyncExternalStore(subscribe, () => getItems(user.id))
  return {
    items,
    unread: items.filter((i) => !i.read).length,
    markAllRead: () => write(inboxKey(user.id), items.map((i) => ({ ...i, read: true }))),
    clear: () => write(inboxKey(user.id), []),
  }
}

export function usePrefs(): [NotifyPrefs, (p: NotifyPrefs) => void] {
  useSyncExternalStore(subscribe, () => localStorage.getItem(PREFS_KEY))
  return [getPrefs(), setPrefs]
}

/** Watches today's steps + overall rankings and records overtakes of the signed-in user. */
export function useOvertakeWatcher() {
  const { user, group } = useSession()
  const today = useToday()
  const { from, to } = periodRange('today', today)
  const { data } = useGroupData(from, to)

  useEffect(() => {
    if (!data || !group || data.data.length < 2) return
    const prefs = getPrefs()
    const fresh: InboxItem[] = []
    for (const board of ['steps', 'overall'] as const) {
      const rows = buildLeaderboard(data.data, board, { from, to }, today)
      const next: RankSnapshot = Object.fromEntries(rows.map((r) => [r.profile.id, r.rank]))
      const key = `wfl:ranks:${user.id}:${group.id}:${board}:${today}`
      const prev = read<RankSnapshot | null>(key, null)
      localStorage.setItem(key, JSON.stringify(next))
      if (!prev || !prefs[board]) continue
      for (const id of findOvertakes(prev, next, user.id)) {
        const p = rows.find((r) => r.profile.id === id)!.profile
        fresh.push({ id: crypto.randomUUID(), at: new Date().toISOString(), board, userId: id, username: p.username, color: p.avatar_color, read: false })
      }
    }
    if (!fresh.length) return
    const items = getItems(user.id)
    const sentToday = items.filter((i) => i.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
    const allowed = fresh.slice(0, Math.max(0, NOTIFICATIONS.maxPerDay - sentToday))
    if (!allowed.length) return
    write(inboxKey(user.id), [...allowed, ...items].slice(0, 100))
    if (prefs.system && 'Notification' in window && Notification.permission === 'granted')
      for (const i of allowed)
        void navigator.serviceWorker?.ready.then((reg) =>
          reg.showNotification(`${i.username} passed you`, {
            body: i.board === 'steps' ? "in today's steps ranking" : "in today's overall ranking",
            icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
            tag: `overtake-${i.board}`,
          }),
        )
  }, [data, group, user.id, today, from, to])
}
