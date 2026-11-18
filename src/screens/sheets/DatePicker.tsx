import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, addMonths, eachDay, endOfMonth, formatDayShort, formatMonth, startOfMonth, weekday, type ISODate } from '../../lib/dates'
import { cx } from '../../components/ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Today / Yesterday chips plus an inline month calendar for older days. */
export function DatePicker({ value, onChange, today }: { value: ISODate; onChange: (d: ISODate) => void; today: ISODate }) {
  const yesterday = addDays(today, -1)
  const other = value !== today && value !== yesterday
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(startOfMonth(value))

  const chip = (active: boolean) =>
    cx('h-10 rounded-full px-4 text-sm font-semibold transition', active ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2 ring-1 ring-line')
  const pickChip = (d: ISODate) => {
    onChange(d)
    setOpen(false)
  }

  const days = eachDay(month, endOfMonth(month))
  const canNext = month < startOfMonth(today)

  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" className={chip(value === today && !open)} onClick={() => pickChip(today)}>
          Today
        </button>
        <button type="button" className={chip(value === yesterday && !open)} onClick={() => pickChip(yesterday)}>
          Yesterday
        </button>
        <button
          type="button"
          aria-expanded={open}
          className={cx(chip(other || open), 'inline-flex items-center gap-1.5')}
          onClick={() => {
            setMonth(startOfMonth(value))
            setOpen(!open)
          }}
        >
          <CalendarDays className="size-4" />
          {other ? formatDayShort(value) : 'Other'}
        </button>
      </div>

      {open && (
        <div className="animate-rise mt-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2 transition active:scale-95"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-sm font-bold text-ink">{formatMonth(month)}</div>
            <button
              type="button"
              aria-label="Next month"
              disabled={!canNext}
              className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2 transition active:scale-95 disabled:opacity-30"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="pb-1 text-xs font-semibold text-faint">
                {w}
              </div>
            ))}
            {Array.from({ length: weekday(month) }, (_, i) => (
              <div key={`pad${i}`} />
            ))}
            {days.map((d) => {
              const future = d > today
              const selected = d === value
              return (
                <button
                  key={d}
                  type="button"
                  disabled={future}
                  aria-label={formatDayShort(d)}
                  aria-pressed={selected}
                  onClick={() => pickChip(d)}
                  className={cx(
                    'mx-auto grid size-10 place-items-center rounded-full text-sm font-semibold transition active:scale-90',
                    selected ? 'bg-brand text-white' : future ? 'text-faint/50' : 'text-ink hover:bg-surface-2',
                    d === today && !selected && 'ring-1 ring-brand text-brand',
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
