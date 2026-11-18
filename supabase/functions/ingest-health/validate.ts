// Pure validation for the ingest-health endpoint (no Deno APIs, so it is unit tested with vitest).

export const LIMITS = {
  maxSteps: 100_000,
  maxFlights: 500,
  maxSleepMinutes: 16 * 60,
  /** How far back a steps date / wake-up time may be. */
  maxAgeDays: 7,
  /** Clock skew allowed for "future" timestamps. */
  skewMinutes: 10,
} as const

export interface StepsWrite {
  date: string
  steps: number
}
export interface FlightsWrite {
  date: string
  flights: number
}
export interface SleepWrite {
  date: string
  start: string
  end: string
  minutes: number
}
export type Validated = { ok: true; steps?: StepsWrite; flights?: FlightsWrite; sleep?: SleepWrite } | { ok: false; error: string }

export function dateIn(instant: Date, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}`
}

/** Accepts numbers or numeric strings (Shortcuts sometimes sends "9488" or "9488.0"). */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v)) return Number(v)
  return null
}

function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' || v.length > 40) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const DAY = 86_400_000

export function validate(body: unknown, tz: string, now: Date): Validated {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object.' }
  const b = body as Record<string, unknown>
  const today = dateIn(now, tz)
  const oldest = dateIn(new Date(now.getTime() - LIMITS.maxAgeDays * DAY), tz)
  const out: { ok: true; steps?: StepsWrite; flights?: FlightsWrite; sleep?: SleepWrite } = { ok: true }

  const has = (v: unknown) => v !== undefined && v !== null && v !== ''
  if (has(b.steps) || has(b.flights)) {
    // Steps and flights are daily totals for the same `date`.
    const date = b.date === undefined ? today : b.date
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'date must look like YYYY-MM-DD.' }
    if (date > today || date < oldest) return { ok: false, error: `date must be within the last ${LIMITS.maxAgeDays} days.` }
    if (has(b.steps)) {
      const steps = toNumber(b.steps)
      if (steps == null || steps < 0 || steps > LIMITS.maxSteps) return { ok: false, error: `steps must be a number between 0 and ${LIMITS.maxSteps}.` }
      out.steps = { date, steps: Math.round(steps) }
    }
    if (has(b.flights)) {
      const flights = toNumber(b.flights)
      if (flights == null || flights < 0 || flights > LIMITS.maxFlights) return { ok: false, error: `flights must be a number between 0 and ${LIMITS.maxFlights}.` }
      out.flights = { date, flights: Math.round(flights) }
    }
  }

  const hasStart = b.sleep_start !== undefined && b.sleep_start !== ''
  const hasEnd = b.sleep_end !== undefined && b.sleep_end !== ''
  if (hasStart || hasEnd) {
    const start = toDate(b.sleep_start)
    const end = toDate(b.sleep_end)
    if (!start || !end) return { ok: false, error: 'sleep_start and sleep_end must both be ISO 8601 dates.' }
    if (end <= start) return { ok: false, error: 'sleep_end must be after sleep_start.' }
    if (end.getTime() > now.getTime() + LIMITS.skewMinutes * 60_000) return { ok: false, error: 'sleep_end is in the future.' }
    if (end.getTime() < now.getTime() - LIMITS.maxAgeDays * DAY) return { ok: false, error: `sleep must have ended within the last ${LIMITS.maxAgeDays} days.` }
    const span = Math.round((end.getTime() - start.getTime()) / 60_000)
    const given = b.sleep_minutes === undefined || b.sleep_minutes === '' ? null : toNumber(b.sleep_minutes)
    if (b.sleep_minutes !== undefined && b.sleep_minutes !== '' && given == null) return { ok: false, error: 'sleep_minutes must be a number.' }
    const minutes = Math.round(given ?? span)
    if (span > LIMITS.maxSleepMinutes || minutes < 1 || minutes > span + 1)
      return { ok: false, error: `sleep must last between 1 minute and ${LIMITS.maxSleepMinutes / 60} hours.` }
    out.sleep = { date: dateIn(end, tz), start: start.toISOString(), end: end.toISOString(), minutes }
  }

  if (!out.steps && !out.flights && !out.sleep) return { ok: false, error: 'Send steps, flights and/or sleep_start + sleep_end.' }
  return out
}
