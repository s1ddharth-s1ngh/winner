import type { ReactNode } from 'react'
import { BEDTIME_TIERS, FLIGHT_TIERS, SLEEP_DURATION_BONUS, STEP_TIERS, STREAKS, WORKOUT_BONUS } from '../../config/scoring'
import { Sheet, Stars, rise } from '../../components/ui'
import { formatNumber } from '../../lib/format'

const bedtimeRows = [
  ...BEDTIME_TIERS.map((t, i) => ({ label: i ? `${BEDTIME_TIERS[i - 1].until} – ${t.until}` : `By ${t.until}`, stars: t.stars as number })),
  { label: `After ${BEDTIME_TIERS.at(-1)!.until}`, stars: 0 },
]

/** Generated from config/scoring.ts so it always matches the real rules. */
export default function ScoringSheet({ open, onClose }: { open: boolean; onClose: () => void }) {

  return (
    <Sheet open={open} onClose={onClose} title="How scoring works">
      <Section i={0} title="Steps per day">
        {STEP_TIERS.map((t) => (
          <Line key={t.min} label={`${formatNumber(t.min)}+ steps`} stars={t.stars} max={4} />
        ))}
      </Section>
      <Section i={1} title="Flights of stairs per day">
        {FLIGHT_TIERS.map((t) => (
          <Line key={t.min} label={`${t.min}+ flights`} stars={t.stars} max={4} />
        ))}
      </Section>
      <Section i={2} title="Sleep: when you fall asleep">
        {bedtimeRows.map((r) => (
          <Line key={r.label} label={r.label} stars={r.stars} max={3} />
        ))}
        <p className="pt-2 text-[13px] text-muted">
          <b className="text-ink">+{SLEEP_DURATION_BONUS.stars}★ bonus</b> when you sleep between {SLEEP_DURATION_BONUS.minMinutes / 60} and{' '}
          {SLEEP_DURATION_BONUS.maxMinutes / 60} hours. The night counts for the day you wake up. No data = 0★, shown as "no data".
        </p>
      </Section>
      <Section i={3} title="Workouts & hobbies">
        <p className="text-[13px] text-muted">
          <b className="text-ink">+{WORKOUT_BONUS.stars}★</b> on days with at least one logged session (max once a day).
        </p>
      </Section>
      <Section i={4} title="Streaks">
        <p className="text-[13px] text-muted">
          Steps streak: days in a row with at least {STREAKS.stepsMinStars}★ of steps. Sleep streak: nights in a row with at least {STREAKS.sleepMinStars}★ of sleep.
          Today never breaks a streak while it is still in progress.
        </p>
      </Section>
      <p className="mt-4 text-center text-xs text-muted">Overall ranking = steps + stairs + sleep + hobby stars.</p>
    </Sheet>
  )
}

function Section({ i, title, children }: { i: number; title: string; children: ReactNode }) {
  return (
    <section className="surface-card mt-3 animate-rise rounded-[26px] p-4" style={rise(i)}>
      <h3 className="mb-2 flex items-center gap-2.5 font-bold">
        {title}
      </h3>
      <div className="divide-y divide-line">{children}</div>
    </section>
  )
}

function Line({ label, stars, max }: { label: string; stars: number; max: number }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="font-medium text-ink-2 tabular">{label}</span>
      <Stars value={stars} max={max} />
    </div>
  )
}
