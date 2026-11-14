import { useEffect, useId, useState, type ReactNode } from 'react'
import { addDays, clock, endOfMonth, startOfMonth, weekday, type ISODate } from '../lib/dates'
import { bedtimeRank, fromBedtimeRank } from '../domain/scoring'
import { cx } from './ui'

/** Circular progress ring with content in the middle. Fills in on mount, with a soft glow. */
export function Ring({
  value,
  size = 180,
  stroke = 16,
  from,
  to,
  track = 'var(--surface-2)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  from: string
  to: string
  track?: string
  children?: ReactNode
}) {
  const id = useId()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = ready ? Math.max(0, Math.min(1, value)) : 0
  const arc = {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: 'none',
    stroke: `url(#${id})`,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeDasharray: c,
    strokeDashoffset: c * (1 - p),
    style: { transition: 'stroke-dashoffset 1100ms cubic-bezier(.2,.8,.2,1)' },
    opacity: value <= 0 ? 0 : 1,
  }
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={stroke * 0.55} />
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle {...arc} filter={`url(#${id}-glow)`} opacity={value <= 0 ? 0 : 0.45} />
        <circle {...arc} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export interface Bar {
  key: string
  label: string
  value: number | null
  tone?: 'good' | 'ok' | 'low'
  active?: boolean
}

/** Vertical bar chart with an optional dashed goal line. Pure CSS, responsive. */
export function BarChart({
  bars,
  goal,
  goalLabel,
  height = 168,
  color = 'steps',
  format = String,
}: {
  bars: Bar[]
  goal?: number
  goalLabel?: string
  height?: number
  color?: 'steps' | 'hobby' | 'brand'
  format?: (v: number) => string
}) {
  const max = Math.max(goal ?? 0, ...bars.map((b) => b.value ?? 0)) * 1.12 || 1
  const toneCls = {
    steps: { good: 'bg-steps', ok: 'bg-steps/45', low: 'bg-steps/20' },
    hobby: { good: 'bg-hobby', ok: 'bg-hobby/60', low: 'bg-hobby/25' },
    brand: { good: 'bg-brand', ok: 'bg-brand/50', low: 'bg-brand/20' },
  }[color]
  const dense = bars.length > 14
  return (
    <div>
      <div className="relative" style={{ height }}>
        {goal != null && (
          <div className="absolute inset-x-0 border-t-[1.5px] border-dashed border-ink/20" style={{ bottom: `${(goal / max) * 100}%` }}>
            {goalLabel && <span className="absolute -top-5 right-0 rounded bg-bg px-1 text-[10px] font-semibold text-muted">{goalLabel}</span>}
          </div>
        )}
        <div className={cx('absolute inset-0 flex items-end', dense ? 'gap-[3px]' : 'gap-2')}>
          {bars.map((b) => (
            <div key={b.key} className="group relative flex h-full flex-1 flex-col justify-end" title={b.value != null ? `${b.label}: ${format(b.value)}` : `${b.label}: no data`}>
              {b.active && b.value != null && !dense && (
                <span className="mb-1 text-center text-[11px] font-bold text-ink tabular">{format(b.value)}</span>
              )}
              <div
                className={cx(
                  'w-full rounded-[7px] transition-[height] duration-500',
                  b.value == null ? 'bg-transparent' : toneCls[b.tone ?? 'good'],
                  b.active && 'ring-2 ring-ink/80 ring-offset-2 ring-offset-surface',
                )}
                style={{ height: b.value == null ? 0 : `max(4px, ${(b.value / max) * 100}%)` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={cx('mt-2 flex', dense ? 'gap-[3px]' : 'gap-2')}>
        {bars.map((b, i) => (
          <span key={b.key} className={cx('flex-1 text-center text-[11px] font-medium', b.active ? 'text-ink' : 'text-faint')}>
            {dense ? (i % 5 === 0 || b.active ? b.label : '') : b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export interface Night {
  key: string
  label: string
  /** minutes of day */
  bedtime: number | null
  minutes: number | null
  stars: number
  active?: boolean
}

/** Bedtime → wake bars per night on an evening-first clock, with a target bedtime line. */
export function SleepChart({ nights, target, height = 220 }: { nights: Night[]; target: number; height?: number }) {
  const withData = nights.filter((n) => n.bedtime != null && n.minutes != null)
  const starts = withData.map((n) => bedtimeRank(n.bedtime!))
  const ends = withData.map((n) => bedtimeRank(n.bedtime!) + n.minutes!)
  // Show at least 21:00 → 09:00, extend to fit the data, snap to whole hours.
  const lo = Math.floor(Math.min(bedtimeRank(21 * 60), ...starts) / 60) * 60
  const hi = Math.ceil(Math.max(bedtimeRank(9 * 60), ...ends) / 60) * 60
  const span = hi - lo
  const y = (rank: number) => ((rank - lo) / span) * 100
  const ticks: number[] = []
  for (let r = lo; r <= hi; r += span > 14 * 60 ? 180 : 120) ticks.push(r)
  const tone = (s: number) => (s >= 4 ? 'from-sleep to-sleep-strong' : s >= 3 ? 'from-sleep/80 to-sleep' : s >= 2 ? 'from-sleep/45 to-sleep/70' : 'from-star/70 to-hobby/80')
  const dense = nights.length > 14
  return (
    <div className="flex gap-2">
      <div className="relative w-9 shrink-0" style={{ height }}>
        {ticks.map((r) => (
          <span key={r} className="absolute right-0 -translate-y-1/2 text-[10px] font-medium text-faint tabular" style={{ top: `${y(r)}%` }}>
            {clock(fromBedtimeRank(r))}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((r) => (
            <div key={r} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(r)}%` }} />
          ))}
          <div className="absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-sleep" style={{ top: `${y(bedtimeRank(target))}%` }}>
            <span className="absolute -top-[18px] right-0 rounded bg-sleep-soft px-1 text-[10px] font-bold text-sleep-strong">Target {clock(target)}</span>
          </div>
          <div className={cx('absolute inset-0 flex', dense ? 'gap-[3px]' : 'gap-2')}>
            {nights.map((n) => (
              <div key={n.key} className="relative flex-1" title={n.bedtime != null ? `${n.label}: ${clock(n.bedtime)} → ${clock(n.bedtime + (n.minutes ?? 0))}` : `${n.label}: no data`}>
                {n.bedtime != null && n.minutes != null ? (
                  <div
                    className={cx('absolute inset-x-0 rounded-full bg-gradient-to-b', tone(n.stars), n.active && 'ring-2 ring-ink/80 ring-offset-2 ring-offset-surface')}
                    style={{ top: `${y(bedtimeRank(n.bedtime))}%`, height: `${(n.minutes / span) * 100}%` }}
                  />
                ) : (
                  <div className="absolute inset-x-[30%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className={cx('mt-2 flex', dense ? 'gap-[3px]' : 'gap-2')}>
          {nights.map((n, i) => (
            <span key={n.key} className={cx('flex-1 text-center text-[11px] font-medium', n.active ? 'text-ink' : 'text-faint')}>
              {dense ? (i % 5 === 0 || n.active ? n.label : '') : n.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Month grid (Mon-first) with a custom renderer per day. */
export function MonthGrid({
  month,
  today,
  render,
}: {
  month: ISODate
  today: ISODate
  render: (date: ISODate) => ReactNode
}) {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const lead = weekday(first)
  const cells: (ISODate | null)[] = Array.from({ length: lead }, () => null)
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d)
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-faint">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) =>
          d ? (
            <div
              key={d}
              className={cx(
                'flex h-12 flex-col items-center justify-center rounded-xl',
                d === today && 'bg-brand-soft ring-1 ring-brand/30',
                d > today && 'opacity-35',
              )}
            >
              {render(d)}
              <span className="text-[10px] font-medium text-faint tabular">{Number(d.slice(8))}</span>
            </div>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  )
}
