import { CalendarDays } from 'lucide-react'
import { addDays, formatDayShort, type ISODate } from '../../lib/dates'
import { cx } from '../../components/ui'

/** Today / Yesterday chips plus a native date input for older days. */
export function DatePicker({ value, onChange, today }: { value: ISODate; onChange: (d: ISODate) => void; today: ISODate }) {
  const yesterday = addDays(today, -1)
  const chip = (active: boolean) =>
    cx('h-10 rounded-full px-4 text-sm font-semibold transition', active ? 'bg-ink text-bg shadow-[0_8px_20px_-10px_var(--ink)]' : 'surface-card text-ink-2')
  const other = value !== today && value !== yesterday
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={chip(value === today)} onClick={() => onChange(today)}>
        Today
      </button>
      <button type="button" className={chip(value === yesterday)} onClick={() => onChange(yesterday)}>
        Yesterday
      </button>
      <label className={cx(chip(other), 'relative inline-flex cursor-pointer items-center gap-1.5')}>
        <CalendarDays className="size-4" />
        {other ? formatDayShort(value) : 'Other'}
        <input
          type="date"
          aria-label="Pick a date"
          max={today}
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
