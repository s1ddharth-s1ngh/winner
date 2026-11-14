import { BedDouble, Footprints, Info, Sunrise, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { LIMITS, MAX_SLEEP_STARS, MAX_STEP_STARS } from '../../config/scoring'
import { repo } from '../../data/repo'
import { bedtimeStars, scoreSleep, stepStars } from '../../domain/scoring'
import type { DailyStat } from '../../domain/types'
import { addDays, timeIn, zonedTimeToInstant, type ISODate } from '../../lib/dates'
import { duration, formatNumber } from '../../lib/format'
import { useSession } from '../../app/session'
import { useToday } from '../../app/hooks'
import { Button, Chip, IconTile, Sheet, Stars, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { DatePicker } from './DatePicker'

const SOURCE_LABEL = { health_connect: 'Health Connect', ios_shortcut: 'iPhone Shortcut', manual: 'manual entry' } as const

const isFuture = (d: Date) => d.getTime() > Date.now() + 5 * 60_000

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Fell-asleep instant for a night that ended on `date` at `wake`. Bedtimes after the wake time belong to the previous day. */
function sleepInstants(date: ISODate, bed: string, wake: string, tz: string) {
  const bedDate = toMin(bed) > toMin(wake) ? addDays(date, -1) : date
  const start = zonedTimeToInstant(bedDate, bed, tz)
  const end = zonedTimeToInstant(date, wake, tz)
  return { start, end, minutes: Math.round((end.getTime() - start.getTime()) / 60_000) }
}

export default function EntrySheet({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: ISODate }) {
  const { user, profile } = useSession()
  const today = useToday()
  const toast = useToast()
  const tz = profile.timezone
  const [date, setDate] = useState(initialDate ?? today)
  const [existing, setExisting] = useState<DailyStat | null>(null)
  const [steps, setSteps] = useState('')
  const [bed, setBed] = useState('')
  const [wake, setWake] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the date each time the sheet opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDate(initialDate ?? today)
  }, [open, initialDate, today])

  // Prefill with what is already stored for that date.
  useEffect(() => {
    if (!open) return
    let alive = true
    repo.listStats([user.id], date, date).then(([s]) => {
      if (!alive) return
      setExisting(s ?? null)
      setSteps(s?.steps != null ? String(s.steps) : '')
      setBed(s?.sleep_start ? timeIn(s.sleep_start, tz) : '')
      setWake(s?.sleep_end ? timeIn(s.sleep_end, tz) : '')
      setError(null)
    })
    return () => {
      alive = false
    }
  }, [open, date, user.id, tz])

  const stepsNum = steps === '' ? null : Number(steps)
  const sleep = bed && wake ? sleepInstants(date, bed, wake, tz) : null
  const sleepScore = sleep
    ? scoreSleep({ sleep_start: sleep.start.toISOString(), sleep_end: sleep.end.toISOString(), sleep_minutes: sleep.minutes } as DailyStat, tz)
    : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (stepsNum != null && (!Number.isInteger(stepsNum) || stepsNum < 0 || stepsNum > LIMITS.maxSteps))
      return setError(`Steps must be a whole number between 0 and ${formatNumber(LIMITS.maxSteps)}.`)
    if ((bed && !wake) || (!bed && wake)) return setError('Add both the time you fell asleep and the time you woke up.')
    if (sleep && (sleep.minutes <= 0 || sleep.minutes > LIMITS.maxSleepMinutes))
      return setError(`Sleep must be between a few minutes and ${LIMITS.maxSleepMinutes / 60} hours.`)
    if (sleep && isFuture(sleep.end)) return setError("You can't log a wake-up time in the future.")
    setBusy(true)
    try {
      await repo.saveStats({
        date,
        source: 'manual',
        ...(stepsNum !== (existing?.steps ?? null) && { steps: stepsNum }),
        ...(sleep
          ? { sleep_start: sleep.start.toISOString(), sleep_end: sleep.end.toISOString(), sleep_minutes: sleep.minutes }
          : existing?.sleep_start && { sleep_start: null, sleep_end: null, sleep_minutes: null }),
      })
      toast('Saved')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const synced = [existing?.steps_source, existing?.sleep_source].find((s) => s && s !== 'manual')

  return (
    <Sheet open={open} onClose={onClose} title="Steps & sleep">
      <form onSubmit={submit}>
        <DatePicker value={date} onChange={setDate} today={today} />

        {synced && (
          <p className="mt-4 flex animate-rise gap-2 rounded-[20px] bg-brand-soft px-3.5 py-3 text-[13px] text-brand">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Synced from {SOURCE_LABEL[synced]}. Values you change here are saved as manual entries.
            </span>
          </p>
        )}

        <section className="surface-card relative mt-5 animate-rise overflow-hidden rounded-[26px] p-4">
          <span className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-steps opacity-15 blur-3xl" />
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <IconTile icon={Footprints} tone="steps" size={32} />
              Steps
            </h3>
            <Stars value={stepStars(stepsNum)} max={MAX_STEP_STARS} />
          </div>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Steps"
            placeholder="0"
            value={steps}
            onChange={(e) => setSteps(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="display relative mt-3 w-full bg-transparent text-[44px] text-ink outline-none placeholder:text-surface-3"
          />
          <p className="mt-1 text-xs text-muted">Total steps for the whole day.</p>
        </section>

        <section className="surface-card relative mt-3 animate-rise overflow-hidden rounded-[26px] p-4" style={{ animationDelay: '60ms' }}>
          <span className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-sleep opacity-15 blur-3xl" />
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <IconTile icon={BedDouble} tone="sleep" size={32} />
              Last night's sleep
            </h3>
            <Stars value={sleepScore?.stars ?? 0} max={MAX_SLEEP_STARS} />
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-3">
            <TimeInput label="Fell asleep" icon={BedDouble} value={bed} onChange={setBed} stars={bed ? bedtimeStars(toMin(bed)) : null} />
            <TimeInput label="Woke up" icon={Sunrise} value={wake} onChange={setWake} />
          </div>
          <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2 text-[13px] text-muted">
            {sleep && sleep.minutes > 0 ? (
              <>
                <span>
                  Slept <b className="text-ink">{duration(sleep.minutes)}</b>
                </span>
                {sleepScore?.durationBonus ? <Chip tone="sleep">+1★ 7–9h bonus</Chip> : <Chip>7–9h earns +1★</Chip>}
              </>
            ) : (
              <span>The night counts for the day you wake up.</span>
            )}
            {(bed || wake) && (
              <button type="button" onClick={() => (setBed(''), setWake(''))} className="ml-auto inline-flex items-center gap-1 font-semibold text-danger">
                <Trash2 className="size-3.5" /> Clear
              </button>
            )}
          </div>
        </section>

        {error && <p className="mt-4 rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="mt-5 w-full">
          Save
        </Button>
      </form>
    </Sheet>
  )
}

function TimeInput({
  label,
  icon: Icon,
  value,
  onChange,
  stars,
}: {
  label: string
  icon: typeof BedDouble
  value: string
  onChange: (v: string) => void
  stars?: number | null
}) {
  return (
    <label className={cx('block rounded-[20px] bg-surface-2 p-3 ring-1 ring-line/60 transition focus-within:bg-surface focus-within:ring-2 focus-within:ring-sleep')}>
      <span className="flex items-center justify-between text-xs font-semibold text-muted">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" /> {label}
        </span>
        {stars != null && <span className="text-star-strong">{'★'.repeat(stars) || '0★'}</span>}
      </span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="display mt-1.5 w-full bg-transparent text-2xl text-ink outline-none" />
    </label>
  )
}
