import { useEffect, useState, type FormEvent } from 'react'
import { WORKOUT_BONUS, WORKOUT_TYPES } from '../../config/scoring'
import { repo } from '../../data/repo'
import { useToday } from '../../app/hooks'
import { Button, Chip, Sheet, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { workoutIcon } from '../../components/workoutIcons'
import { duration } from '../../lib/format'
import { DatePicker } from './DatePicker'

const PRESETS = [15, 30, 45, 60, 90, 120]

export default function WorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = useToday()
  const toast = useToast()
  const [date, setDate] = useState(today)
  const [type, setType] = useState<string>('Gym')
  const [minutes, setMinutes] = useState(45)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(today)
      setNote('')
      setError(null)
    }
  }, [open, today])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) return setError('Duration must be between 1 and 600 minutes.')
    setBusy(true)
    try {
      await repo.addWorkout({ date, type, duration_min: minutes, note: note.trim() || null })
      toast(`${type} logged`)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Workout or hobby">
      <form onSubmit={submit}>
        <DatePicker value={date} onChange={setDate} today={today} />

        <h3 className="mt-6 mb-2.5 text-[13px] font-semibold text-ink-2">Activity</h3>
        <div className="grid grid-cols-4 gap-2">
          {WORKOUT_TYPES.map((t) => {
            const Icon = workoutIcon(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cx(
                  'flex flex-col items-center gap-1.5 rounded-[20px] py-3 text-[12px] font-semibold transition active:scale-95',
                  type === t
                    ? 'bg-[linear-gradient(135deg,var(--star),var(--hobby))] text-white shadow-[0_10px_24px_-10px_var(--hobby),inset_0_1px_0_rgb(255_255_255/0.3)]'
                    : 'surface-card text-ink-2',
                )}
              >
                <Icon className="size-5" />
                {t}
              </button>
            )
          })}
        </div>

        <h3 className="mt-6 mb-2.5 flex items-center justify-between text-[13px] font-semibold text-ink-2">
          Duration <span className="display text-xl text-hobby-strong">{duration(minutes || 0)}</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={cx('h-10 min-w-14 rounded-full px-3 text-sm font-semibold transition', minutes === m ? 'bg-ink text-bg' : 'surface-card text-ink-2')}
            >
              {duration(m)}
            </button>
          ))}
          <label className="flex h-10 items-center gap-1 rounded-full bg-surface px-3 text-sm ring-1 ring-line transition focus-within:ring-2 focus-within:ring-hobby">
            <input
              inputMode="numeric"
              aria-label="Custom minutes"
              value={PRESETS.includes(minutes) ? '' : minutes || ''}
              placeholder="Custom"
              onChange={(e) => setMinutes(Number(e.target.value.replace(/\D/g, '').slice(0, 3)))}
              className="w-16 bg-transparent font-semibold outline-none placeholder:font-medium placeholder:text-faint"
            />
            <span className="text-muted">min</span>
          </label>
        </div>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Note (optional)</span>
          <textarea
            value={note}
            maxLength={280}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Legs day, 5k in the park…"
            className="w-full resize-none rounded-[20px] bg-surface-2 px-4 py-3 text-[15px] text-ink ring-1 ring-line/60 outline-none placeholder:text-faint focus:bg-surface focus:ring-2 focus:ring-hobby"
          />
        </label>

        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <Chip tone="hobby">+{WORKOUT_BONUS.stars}★</Chip> on days with at least one session.
        </p>
        {error && <p className="mt-4 rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" loading={busy} className="mt-5 w-full !bg-[linear-gradient(120deg,var(--star),var(--hobby))] !shadow-[0_14px_34px_-10px_var(--hobby)]">
          Log {type.toLowerCase()}
        </Button>
      </form>
    </Sheet>
  )
}
