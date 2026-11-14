import { BedDouble, ChevronLeft, ChevronRight, Dumbbell, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useMyData, useToday } from '../app/hooks'
import { BarChart, MonthGrid, SleepChart } from '../components/charts'
import { Card, EmptyState, PageHeader, SectionTitle, Segmented, Skeleton, cx } from '../components/ui'
import { workoutIcon } from '../components/workoutIcons'
import { GOALS } from '../config/scoring'
import { repo } from '../data/repo'
import { bedtimeRank, fromBedtimeRank, longestStreak, currentStreak, qualifiesSleep, qualifiesSteps, type DayScore } from '../domain/scoring'
import type { Workout } from '../domain/types'
import {
  addDays,
  addMonths,
  clock,
  endOfMonth,
  formatDay,
  formatDayShort,
  formatMonth,
  formatMonthShort,
  formatWeekdayShort,
  startOfMonth,
  startOfWeek,
  type ISODate,
} from '../lib/dates'
import { compact, duration, formatNumber, plural } from '../lib/format'

type Tab = 'steps' | 'sleep' | 'hobbies'
type Span = 'week' | 'month'

const HISTORY_DAYS = 400

export default function StatsScreen() {
  const today = useToday()
  const [tab, setTab] = useState<Tab>('steps')
  const [span, setSpan] = useState<Span>('week')
  const [offset, setOffset] = useState(0)
  const { data } = useMyData(addDays(today, -HISTORY_DAYS), today)

  const from = span === 'week' ? addDays(startOfWeek(today), offset * 7) : addMonths(startOfMonth(today), offset)
  const to = span === 'week' ? addDays(from, 6) : endOfMonth(from)
  const label = span === 'week' ? `${formatDayShort(from)} – ${formatDayShort(to)}` : formatMonth(from)
  const oldest = addDays(today, -HISTORY_DAYS)

  const days = data?.history.filter((d) => d.date >= from && d.date <= to) ?? []
  const workouts = data?.workouts.filter((w) => w.date >= from && w.date <= to) ?? []

  return (
    <div className="animate-fade-in">
      <PageHeader subtitle="Your progress" title="Stats" />
      <div className="px-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'steps', label: 'Steps' },
            { value: 'sleep', label: 'Sleep' },
            { value: 'hobbies', label: 'Hobbies' },
          ]}
        />
        <div className="mt-3 flex items-center gap-2">
          <Segmented
            value={span}
            onChange={(s) => (setSpan(s), setOffset(0))}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            size="sm"
            className="w-40"
          />
          <div className="ml-auto flex items-center gap-1">
            <NavButton label="Previous" disabled={from <= oldest} onClick={() => setOffset(offset - 1)}>
              <ChevronLeft className="size-4" />
            </NavButton>
            <span className="min-w-28 text-center text-[13px] font-semibold">{label}</span>
            <NavButton label="Next" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
              <ChevronRight className="size-4" />
            </NavButton>
          </div>
        </div>

        {!data ? (
          <div className="mt-5 space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        ) : tab === 'steps' ? (
          <StepsStats days={days} all={data.history} span={span} today={today} />
        ) : tab === 'sleep' ? (
          <SleepStats days={days} all={data.history} span={span} today={today} />
        ) : (
          <HobbyStats days={days} workouts={workouts} span={span} today={today} />
        )}
      </div>
    </div>
  )
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-full bg-surface ring-1 ring-line disabled:opacity-30">
      {children}
    </button>
  )
}

function Kpis({ items }: { items: { label: string; value: ReactNode; tone?: string }[] }) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      {items.map((k) => (
        <Card key={k.label} className="px-3 py-3.5">
          <p className={cx('text-[19px] leading-tight font-bold tracking-tight tabular', k.tone)}>{k.value}</p>
          <p className="mt-1 text-[11px] font-medium text-muted">{k.label}</p>
        </Card>
      ))}
    </div>
  )
}

const dayLabel = (d: ISODate, span: Span) => (span === 'week' ? formatWeekdayShort(d).slice(0, 2) : String(Number(d.slice(8))))
const past = (days: DayScore[], today: ISODate) => days.filter((d) => d.date <= today)

function Records({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode }[] }) {
  return (
    <>
      <SectionTitle>Records</SectionTitle>
      <Card className="grid grid-cols-2 divide-x divide-line">
        {[0, 1].map((col) => (
          <div key={col} className="divide-y divide-line">
            {items.filter((_, i) => i % 2 === col).map((r) => (
              <div key={r.label} className="p-4">
                <p className="text-xs font-medium text-muted">{r.label}</p>
                <p className="mt-1 text-lg font-bold tabular">{r.value}</p>
                {r.sub && <p className="text-xs text-faint">{r.sub}</p>}
              </div>
            ))}
          </div>
        ))}
      </Card>
    </>
  )
}

function StepsStats({ days, all, span, today }: { days: DayScore[]; all: DayScore[]; span: Span; today: ISODate }) {
  const done = past(days, today)
  const withData = done.filter((d) => d.steps != null)
  const total = withData.reduce((s, d) => s + d.steps!, 0)
  const best = withData.reduce<DayScore | null>((b, d) => (!b || d.steps! > b.steps! ? d : b), null)
  const goalDays = withData.filter((d) => d.steps! >= GOALS.dailySteps).length

  const months = new Map<string, number>()
  for (const d of all) months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + (d.steps ?? 0))
  const bestMonth = [...months].sort((a, b) => b[1] - a[1])[0]
  const bestEver = all.reduce<DayScore | null>((b, d) => (d.steps != null && (!b || d.steps > b.steps!) ? d : b), null)
  const byDate = new Map(all.map((d) => [d.date, d]))

  return (
    <>
      <Kpis
        items={[
          { label: 'Total steps', value: compact(total) },
          { label: 'Daily average', value: withData.length ? compact(total / withData.length) : '—' },
          { label: `Days at ${compact(GOALS.dailySteps)}+`, value: `${goalDays}/${done.length}`, tone: 'text-steps-strong' },
        ]}
      />
      <Card className="mt-3 p-4 pt-6">
        <BarChart
          bars={days.map((d) => ({
            key: d.date,
            label: dayLabel(d.date, span),
            value: d.date > today ? null : d.steps,
            tone: d.stepsStars >= 3 ? 'good' : d.stepsStars >= 1 ? 'ok' : 'low',
            active: d.date === best?.date,
          }))}
          goal={GOALS.dailySteps}
          goalLabel={compact(GOALS.dailySteps)}
          format={compact}
        />
        {best && (
          <p className="mt-3 text-center text-xs text-muted">
            Best day: <b className="text-ink">{formatNumber(best.steps!)}</b> on {formatDay(best.date)}
          </p>
        )}
      </Card>

      {span === 'month' && days[0] && (
        <>
          <SectionTitle>Calendar</SectionTitle>
          <Card className="p-3">
            <MonthGrid
              month={days[0].date}
              today={today}
              render={(d) => {
                const s = byDate.get(d)
                if (!s || s.steps == null || d > today) return <span className="text-[13px] font-semibold text-line">·</span>
                const color = s.stepsStars >= 3 ? 'text-steps-strong' : s.stepsStars >= 1 ? 'text-[#0284c7]' : 'text-faint'
                return <span className={cx('text-[13px] font-bold tabular', color)}>{compact(s.steps)}</span>
              }}
            />
            <div className="mt-2 flex justify-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-steps" /> 3★+</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-[#0284c7]" /> 1–2★</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-faint" /> 0★</span>
            </div>
          </Card>
        </>
      )}

      <Records
        items={[
          { label: 'Current streak', value: plural(currentStreak(all, qualifiesSteps), 'day') },
          { label: 'Longest streak', value: plural(longestStreak(all, qualifiesSteps), 'day') },
          { label: 'Best day ever', value: bestEver ? formatNumber(bestEver.steps!) : '—', sub: bestEver && formatDay(bestEver.date) },
          { label: 'Best month', value: bestMonth && bestMonth[1] ? compact(bestMonth[1]) : '—', sub: bestMonth && bestMonth[1] ? formatMonthShort(`${bestMonth[0]}-01`) : undefined },
        ]}
      />
    </>
  )
}

function SleepStats({ days, all, span, today }: { days: DayScore[]; all: DayScore[]; span: Span; today: ISODate }) {
  const done = past(days, today)
  const nights = done.filter((d) => d.sleep)
  const avgRank = nights.length ? nights.reduce((s, d) => s + bedtimeRank(d.sleep!.bedtime), 0) / nights.length : null
  const avgMin = nights.length ? nights.reduce((s, d) => s + d.sleep!.minutes, 0) / nights.length : null
  const early = nights.filter((d) => d.sleep!.bedtimeStars >= 3).length
  const allNights = all.filter((d) => d.sleep)
  const earliest = allNights.reduce<DayScore | null>((b, d) => (!b || bedtimeRank(d.sleep!.bedtime) < bedtimeRank(b.sleep!.bedtime) ? d : b), null)
  const longest = allNights.reduce<DayScore | null>((b, d) => (!b || d.sleep!.minutes > b.sleep!.minutes ? d : b), null)
  const target = Number(GOALS.bedtime.slice(0, 2)) * 60 + Number(GOALS.bedtime.slice(3))
  const byDate = new Map(all.map((d) => [d.date, d]))

  if (allNights.length === 0)
    return (
      <Card className="mt-5">
        <EmptyState
          icon={BedDouble}
          title="No sleep data yet"
          text="Connect Health Connect, set up the iPhone Shortcut, or add last night by hand from the + button."
        />
      </Card>
    )

  return (
    <>
      <Kpis
        items={[
          { label: 'Avg bedtime', value: avgRank != null ? clock(fromBedtimeRank(avgRank)) : '—', tone: 'text-sleep-strong' },
          { label: 'Avg sleep', value: avgMin != null ? duration(avgMin) : '—' },
          { label: `By ${GOALS.bedtime}`, value: `${early}/${done.length}` },
        ]}
      />
      <Card className="mt-3 p-4 pt-6">
        <SleepChart
          target={target}
          nights={days.map((d) => ({
            key: d.date,
            label: dayLabel(d.date, span),
            bedtime: d.date > today ? null : (d.sleep?.bedtime ?? null),
            minutes: d.sleep?.minutes ?? null,
            stars: d.sleepStars,
          }))}
        />
        <p className="mt-3 text-center text-xs text-muted">
          {nights.length}/{done.length} nights tracked · bars run from falling asleep to waking up
        </p>
      </Card>

      {span === 'month' && days[0] && (
        <>
          <SectionTitle>Bedtimes</SectionTitle>
          <Card className="p-3">
            <MonthGrid
              month={days[0].date}
              today={today}
              render={(d) => {
                const s = byDate.get(d)?.sleep
                if (!s || d > today) return <span className="text-[13px] font-semibold text-line">·</span>
                const color = s.bedtimeStars >= 3 ? 'text-sleep-strong' : s.bedtimeStars >= 2 ? 'text-sleep' : s.bedtimeStars >= 1 ? 'text-star' : 'text-danger'
                return <span className={cx('text-[12px] font-bold tabular', color)}>{clock(s.bedtime)}</span>
              }}
            />
          </Card>
        </>
      )}

      <Records
        items={[
          { label: 'Current streak', value: plural(currentStreak(all, qualifiesSleep), 'night') },
          { label: 'Longest streak', value: plural(longestStreak(all, qualifiesSleep), 'night') },
          { label: 'Earliest bedtime', value: earliest ? clock(earliest.sleep!.bedtime) : '—', sub: earliest && formatDay(earliest.date) },
          { label: 'Longest sleep', value: longest ? duration(longest.sleep!.minutes) : '—', sub: longest && formatDay(longest.date) },
        ]}
      />
    </>
  )
}

function HobbyStats({ days, workouts, span, today }: { days: DayScore[]; workouts: Workout[]; span: Span; today: ISODate }) {
  const total = workouts.reduce((s, w) => s + w.duration_min, 0)
  const activeDays = new Set(workouts.map((w) => w.date)).size
  const byType = new Map<string, number>()
  for (const w of workouts) byType.set(w.type, (byType.get(w.type) ?? 0) + w.duration_min)
  const types = [...byType].sort((a, b) => b[1] - a[1])
  const max = types[0]?.[1] ?? 1

  return (
    <>
      <Kpis
        items={[
          { label: 'Sessions', value: workouts.length },
          { label: 'Total time', value: duration(total), tone: 'text-hobby' },
          { label: 'Active days', value: `${activeDays}/${past(days, today).length}` },
        ]}
      />
      {workouts.length === 0 ? (
        <Card className="mt-3">
          <EmptyState icon={Dumbbell} title="No sessions in this period" text="Log a workout or hobby from the + button. Each active day earns +1★." />
        </Card>
      ) : (
        <>
          <Card className="mt-3 p-4 pt-6">
            <BarChart
              color="hobby"
              bars={days.map((d) => ({ key: d.date, label: dayLabel(d.date, span), value: d.date > today ? null : d.workoutMinutes || null }))}
              format={(v) => duration(v)}
            />
          </Card>
          <SectionTitle>By activity</SectionTitle>
          <Card className="space-y-3 p-4">
            {types.map(([type, minutes]) => {
              const Icon = workoutIcon(type)
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-hobby-soft text-hobby">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{type}</span>
                      <span className="font-semibold tabular">{duration(minutes)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-hobby" style={{ width: `${(minutes / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </Card>
          <SectionTitle>Sessions</SectionTitle>
          <Card className="divide-y divide-line">
            {[...workouts]
              .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
              .map((w) => {
                const Icon = workoutIcon(w.type)
                return (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon className="size-[18px] text-hobby" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {w.type} <span className="font-normal text-muted">· {formatDay(w.date)}</span>
                      </p>
                      {w.note && <p className="truncate text-xs text-muted">{w.note}</p>}
                    </div>
                    <span className="text-sm font-bold tabular">{duration(w.duration_min)}</span>
                    <button type="button" aria-label="Delete session" onClick={() => void repo.deleteWorkout(w.id)} className="p-1 text-faint hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )
              })}
          </Card>
        </>
      )}
    </>
  )
}
