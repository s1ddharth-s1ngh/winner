import { Bell, BedDouble, ChevronRight, Dumbbell, Flame, Footprints, MoonStar, Plus, Sunrise, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { useGroupData, useMyData, useToday } from '../app/hooks'
import { useInbox } from '../app/inbox'
import { useSession } from '../app/session'
import { useSheets } from '../app/AppShell'
import { Ring } from '../components/charts'
import { Avatar, Card, Chip, IconButton, PageHeader, SectionTitle, Skeleton, StarCount, Stars, cx } from '../components/ui'
import { workoutIcon } from '../components/workoutIcons'
import { GOALS, MAX_SLEEP_STARS, MAX_STEP_STARS, STEP_TIERS, WORKOUT_BONUS } from '../config/scoring'
import { repo } from '../data/repo'
import { buildLeaderboard, periodRange } from '../domain/leaderboard'
import { currentStreak, qualifiesSleep, qualifiesSteps, type DayScore } from '../domain/scoring'
import { addDays, clock, formatWeekdayLetter, minutesOfDayIn, startOfWeek, timeAgo, type ISODate } from '../lib/dates'
import { compact, duration, formatNumber, greeting, plural } from '../lib/format'

const SOURCE = { health_connect: 'Health Connect', ios_shortcut: 'iPhone Shortcut', manual: 'Manual' } as const

export default function TodayScreen() {
  const { profile, group } = useSession()
  const today = useToday()
  const { unread } = useInbox()
  const my = useMyData(addDays(today, -59), today)
  const day = my.data?.history.at(-1)
  const stat = my.data?.stats.find((s) => s.date === today)
  const { openEntry } = useSheets()

  const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: profile.timezone }).format(new Date())

  return (
    <div className="animate-fade-in">
      <PageHeader
        subtitle={longDate}
        title={`${greeting(Math.floor(minutesOfDayIn(new Date(), profile.timezone) / 60))}, ${profile.username}`}
        actions={
          <>
            <Link to="/inbox">
              <IconButton icon={Bell} label="Notifications" badge={unread > 0} />
            </Link>
            <Link to="/profile" aria-label="Profile">
              <Avatar name={profile.username} color={profile.avatar_color} size={40} />
            </Link>
          </>
        }
      />

      <div className="px-4">
        {!day ? (
          <Skeleton className="h-[330px]" />
        ) : (
          <StepsHero day={day} source={stat?.steps_source ? `${SOURCE[stat.steps_source]} · ${timeAgo(stat.updated_at)}` : null} onAdd={() => openEntry(today)} />
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {my.data ? (
            <>
              <StreakCard icon={Flame} tone="steps" value={currentStreak(my.data.history, qualifiesSteps)} unit="day" label="Steps streak" />
              <StreakCard icon={MoonStar} tone="sleep" value={currentStreak(my.data.history, qualifiesSleep)} unit="night" label="Sleep streak" />
            </>
          ) : (
            <>
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
            </>
          )}
        </div>

        <SectionTitle>Last night</SectionTitle>
        {day ? <SleepCard day={day} onAdd={() => openEntry(today)} /> : <Skeleton className="h-36" />}

        <SectionTitle>Today's stars</SectionTitle>
        {day && <StarsCard day={day} />}

        {my.data && <WeekStrip history={my.data.history} today={today} />}

        <WorkoutsToday workouts={my.data?.workouts.filter((w) => w.date === today) ?? []} />

        {group && <MiniRanking today={today} />}
      </div>
    </div>
  )
}

function StepsHero({ day, source, onAdd }: { day: DayScore; source: string | null; onAdd: () => void }) {
  const steps = day.steps ?? 0
  const next = STEP_TIERS.find((t) => steps < t.min)
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-steps/10 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <Chip tone="steps">
          <Footprints className="size-3.5" /> Steps
        </Chip>
        <Stars value={day.stepsStars} max={MAX_STEP_STARS} size={16} />
      </div>
      <div className="relative mt-2 flex justify-center">
        <Ring value={steps / GOALS.dailySteps} size={196} stroke={18} from="#34d399" to="var(--steps-strong)">
          <div>
            <div className="text-[44px] leading-none font-extrabold tracking-tight tabular">{formatNumber(steps)}</div>
            <div className="mt-1.5 text-[13px] font-medium text-muted">of {formatNumber(GOALS.dailySteps)} steps</div>
          </div>
        </Ring>
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {day.steps == null ? (
            'No steps yet today.'
          ) : next ? (
            <>
              <b className="text-ink tabular">{formatNumber(next.min - steps)}</b> to your next star
            </>
          ) : (
            <b className="text-steps-strong">Max stars reached. Legend.</b>
          )}
          {source && <span className="block text-xs text-faint">{source}</span>}
        </p>
        <button type="button" onClick={onAdd} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-steps-soft px-3.5 text-[13px] font-semibold text-steps-strong transition active:scale-95">
          <Plus className="size-4" /> Update
        </button>
      </div>
    </Card>
  )
}

function StreakCard({ icon: Icon, tone, value, unit, label }: { icon: typeof Flame; tone: 'steps' | 'sleep'; value: number; unit: string; label: string }) {
  return (
    <Card className="p-4">
      <span className={cx('grid size-9 place-items-center rounded-xl', tone === 'steps' ? 'bg-hobby-soft text-hobby' : 'bg-sleep-soft text-sleep')}>
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-[22px] leading-none font-bold tabular">{plural(value, unit)}</p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </Card>
  )
}

function SleepCard({ day, onAdd }: { day: DayScore; onAdd: () => void }) {
  const s = day.sleep
  if (!s)
    return (
      <Card className="flex items-center gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sleep-soft text-sleep">
          <BedDouble className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">No sleep data</p>
          <p className="text-[13px] text-muted">No data means 0★ for the night. Add it in seconds.</p>
        </div>
        <button type="button" onClick={onAdd} className="h-9 shrink-0 rounded-full bg-sleep px-4 text-[13px] font-semibold text-white">
          Add
        </button>
      </Card>
    )
  return (
    <Card className="overflow-hidden">
      <div className="bg-[linear-gradient(135deg,#2e1f7a,#5b3fd6_60%,#7c5cfa)] p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white/70">Time asleep</span>
          <Stars value={s.stars} max={MAX_SLEEP_STARS} size={16} />
        </div>
        <p className="mt-1 text-[34px] leading-none font-extrabold tracking-tight">{duration(s.minutes)}</p>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 font-semibold">
            <MoonStar className="size-4" /> {clock(s.bedtime)}
          </span>
          <span className="h-px flex-1 bg-white/25" />
          <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 font-semibold">
            <Sunrise className="size-4" /> {s.wake != null ? clock(s.wake) : '—'}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        <Chip tone={s.bedtimeStars >= 3 ? 'sleep' : s.bedtimeStars > 0 ? 'star' : 'danger'}>Bedtime +{s.bedtimeStars}★</Chip>
        <Chip tone={s.durationBonus ? 'sleep' : 'muted'}>{s.durationBonus ? '7–9h bonus +1★' : 'No 7–9h bonus'}</Chip>
      </div>
    </Card>
  )
}

function StarsCard({ day }: { day: DayScore }) {
  const parts = [
    { label: 'Steps', value: day.stepsStars, max: MAX_STEP_STARS, color: 'bg-steps' },
    { label: 'Sleep', value: day.sleepStars, max: MAX_SLEEP_STARS, color: 'bg-sleep' },
    { label: 'Hobby', value: day.workoutStars, max: WORKOUT_BONUS.stars, color: 'bg-hobby' },
  ]
  const max = parts.reduce((s, p) => s + p.max, 0)
  return (
    <Card className="p-5">
      <div className="flex items-end justify-between">
        <p className="text-[40px] leading-none font-extrabold tracking-tight tabular">
          {day.total}
          <span className="text-xl font-bold text-faint"> / {max}</span>
        </p>
        <span className="grid size-12 place-items-center rounded-2xl bg-star-soft text-2xl">⭐</span>
      </div>
      <div className="mt-4 flex h-3 gap-1 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p) => (
          <div key={p.label} className={cx('h-full rounded-full transition-[width] duration-700', p.color)} style={{ width: `${(p.value / max) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5 text-[13px]">
            <span className={cx('size-2.5 rounded-full', p.color)} />
            <span className="text-muted">{p.label}</span>
            <span className="ml-auto font-semibold tabular">
              {p.value}/{p.max}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function WeekStrip({ history, today }: { history: DayScore[]; today: ISODate }) {
  const start = startOfWeek(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDate = new Map(history.map((d) => [d.date, d]))
  const weekTotal = days.reduce((s, d) => s + (byDate.get(d)?.total ?? 0), 0)
  return (
    <>
      <SectionTitle action={<StarCount value={weekTotal} className="text-sm text-muted" />}>This week</SectionTitle>
      <Card className="grid grid-cols-7 gap-1 p-3">
        {days.map((d) => {
          const s = byDate.get(d)
          const future = d > today
          const pct = Math.min(1, (s?.steps ?? 0) / GOALS.dailySteps)
          return (
            <div key={d} className={cx('flex flex-col items-center gap-1.5 rounded-2xl py-2', d === today && 'bg-brand-soft')}>
              <span className={cx('text-[11px] font-semibold', d === today ? 'text-brand' : 'text-faint')}>{formatWeekdayLetter(d)}</span>
              <div className="relative h-14 w-2.5 overflow-hidden rounded-full bg-surface-2">
                {!future && <div className="absolute inset-x-0 bottom-0 rounded-full bg-steps transition-[height] duration-700" style={{ height: `${pct * 100}%` }} />}
              </div>
              <span className={cx('text-[11px] font-bold tabular', future ? 'text-line' : 'text-ink-2')}>{future ? '·' : `${s?.total ?? 0}★`}</span>
            </div>
          )
        })}
      </Card>
    </>
  )
}

function WorkoutsToday({ workouts }: { workouts: { id: string; type: string; duration_min: number; note: string | null }[] }) {
  const { openWorkout } = useSheets()
  return (
    <>
      <SectionTitle
        action={
          <button type="button" onClick={openWorkout} className="inline-flex items-center gap-1 text-sm font-semibold text-hobby">
            <Plus className="size-4" /> Log
          </button>
        }
      >
        Workouts & hobbies
      </SectionTitle>
      {workouts.length === 0 ? (
        <Card onClick={openWorkout} className="flex items-center gap-4 p-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-hobby-soft text-hobby">
            <Dumbbell className="size-5" />
          </span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold">Nothing logged today</p>
            <p className="text-[13px] text-muted">One session = +{WORKOUT_BONUS.stars}★ for the day</p>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {workouts.map((w) => {
            const Icon = workoutIcon(w.type)
            return (
              <div key={w.id} className="flex items-center gap-3 p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-hobby-soft text-hobby">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{w.type}</p>
                  <p className="truncate text-[13px] text-muted">{w.note ?? duration(w.duration_min)}</p>
                </div>
                <span className="text-sm font-bold tabular">{duration(w.duration_min)}</span>
                <button type="button" aria-label={`Delete ${w.type}`} onClick={() => void repo.deleteWorkout(w.id)} className="p-1 text-faint hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}
        </Card>
      )}
    </>
  )
}

function MiniRanking({ today }: { today: ISODate }) {
  const { user, group } = useSession()
  const range = periodRange('today', today)
  const { data } = useGroupData(range.from, range.to)
  const rows = data ? buildLeaderboard(data.data, 'steps', range, today) : []
  const meIndex = rows.findIndex((r) => r.profile.id === user.id)
  const shown = rows.slice(0, 3)
  if (meIndex >= 3) shown.push(rows[meIndex])
  return (
    <>
      <SectionTitle
        action={
          <Link to="/ranking" className="inline-flex items-center text-sm font-semibold text-brand">
            See all <ChevronRight className="size-4" />
          </Link>
        }
      >
        {group?.name} · steps today
      </SectionTitle>
      <Card className="divide-y divide-line">
        {!data
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="m-3 h-10" />)
          : shown.map((r) => (
              <div key={r.profile.id} className={cx('flex items-center gap-3 px-4 py-3', r.profile.id === user.id && 'bg-brand-soft/60')}>
                <span className="w-5 text-center text-sm font-bold text-muted tabular">{r.rank ?? '–'}</span>
                <Avatar name={r.profile.username} color={r.profile.avatar_color} size={34} />
                <span className="flex-1 truncate font-semibold">
                  {r.profile.username}
                  {r.profile.id === user.id && <span className="ml-1.5 text-xs font-semibold text-brand">You</span>}
                </span>
                <span className="font-bold tabular">{r.rank ? compact(r.steps) : '—'}</span>
              </div>
            ))}
      </Card>
    </>
  )
}
