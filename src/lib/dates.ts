// Calendar dates are plain 'YYYY-MM-DD' strings. Instants are ISO strings / Date.
// Every conversion between the two takes an IANA timezone (the user's, from their profile).

export type ISODate = string

const formatters = new Map<string, Intl.DateTimeFormat>()

function zonedParts(instant: Date, tz: string) {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(tz, f)
  }
  const p: Record<string, number> = {}
  for (const part of f.formatToParts(instant)) if (part.type !== 'literal') p[part.type] = Number(part.value)
  return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second }
}

const pad = (n: number) => String(n).padStart(2, '0')
const toISODate = (y: number, mo: number, d: number) => `${y}-${pad(mo)}-${pad(d)}`

/** Calendar date of an instant in a timezone. */
export function dateIn(instant: Date | string, tz: string): ISODate {
  const p = zonedParts(new Date(instant), tz)
  return toISODate(p.y, p.mo, p.d)
}

export function todayIn(tz: string, now = new Date()): ISODate {
  return dateIn(now, tz)
}

/** Minutes since local midnight (0–1439) of an instant in a timezone. */
export function minutesOfDayIn(instant: Date | string, tz: string): number {
  const p = zonedParts(new Date(instant), tz)
  return p.h * 60 + p.mi
}

/** Instant for a local wall-clock time ('HH:MM') on a date in a timezone. DST-safe. */
export function zonedTimeToInstant(date: ISODate, time: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const offset = (ts: number) => {
    const p = zonedParts(new Date(ts), tz)
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000
  }
  const first = guess - offset(guess)
  const second = guess - offset(first)
  return new Date(second)
}

const utc = (date: ISODate) => {
  const [y, mo, d] = date.split('-').map(Number)
  return Date.UTC(y, mo - 1, d)
}
const fromUtc = (ts: number) => new Date(ts).toISOString().slice(0, 10)

export const addDays = (date: ISODate, n: number): ISODate => fromUtc(utc(date) + n * 86_400_000)
export const diffDays = (a: ISODate, b: ISODate): number => Math.round((utc(a) - utc(b)) / 86_400_000)
/** 0 = Monday … 6 = Sunday */
export const weekday = (date: ISODate): number => (new Date(utc(date)).getUTCDay() + 6) % 7
export const startOfWeek = (date: ISODate): ISODate => addDays(date, -weekday(date))
export const startOfMonth = (date: ISODate): ISODate => `${date.slice(0, 7)}-01`
export const endOfMonth = (date: ISODate): ISODate => {
  const [y, mo] = date.split('-').map(Number)
  return fromUtc(Date.UTC(y, mo, 0))
}
export const addMonths = (date: ISODate, n: number): ISODate => {
  const [y, mo] = date.split('-').map(Number)
  return fromUtc(Date.UTC(y, mo - 1 + n, 1))
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

// ---- Display helpers (English UI) ----

const label = (date: ISODate, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(utc(date)))

export const formatDay = (date: ISODate) => label(date, { weekday: 'short', day: 'numeric', month: 'short' })
export const formatDayShort = (date: ISODate) => label(date, { day: 'numeric', month: 'short' })
export const formatWeekdayLetter = (date: ISODate) => label(date, { weekday: 'narrow' })
export const formatWeekdayShort = (date: ISODate) => label(date, { weekday: 'short' })
export const formatMonth = (date: ISODate) => label(date, { month: 'long', year: 'numeric' })
export const formatMonthShort = (date: ISODate) => label(date, { month: 'short', year: '2-digit' })

export function relativeDay(date: ISODate, today: ISODate): string {
  const diff = diffDays(today, date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return formatDay(date)
}

/** 'HH:MM' for minutes since midnight. */
export const clock = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export const timeIn = (instant: Date | string, tz: string) => clock(minutesOfDayIn(instant, tz))

export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86_400)}d ago`
}

/** Device IANA timezone. Some Android WebViews report a raw offset like "+00:00": fall back to Europe/Rome then. */
export function browserTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return tz && (tz.includes('/') || tz === 'UTC') ? tz : 'Europe/Rome'
}
