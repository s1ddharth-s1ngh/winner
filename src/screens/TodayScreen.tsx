import { Bell, BedDouble, ChevronRight, Dumbbell, Flame, Footprints, MoonStar, Plus, Star, Sunrise, Trash2, Trophy } from 'lucide-react'
import { Link } from 'react-router'
import { useGroupData, useMyData, useToday } from '../app/hooks'
import { useInbox } from '../app/inbox'
import { useSession } from '../app/session'
import { useSheets } from '../app/AppShell'
import { Ring } from '../components/charts'
import { AnimatedNumber, Avatar, Card, Chip, IconButton, IconTile, PageHeader, RankBadge, SectionTitle, Skeleton, StarCount, Stars, cx, rise } from '../components/ui'
import { workoutIcon } from '../components/workoutIcons'
import { GOALS, MAX_SLEEP_STARS, MAX_STEP_STARS, STEP_TIERS, WORKOUT_BONUS } from '../config/scoring'
import { repo } from '../data/repo'
import { buildLeaderboard, periodRange } from '../domain/leaderboard'
import { currentStreak, qualifiesSleep, qualifiesSteps, type DayScore } from '../domain/scoring'
import { addDays, clock, formatWeekdayLetter, minutesOfDayIn, startOfWeek, timeAgo, type ISODate } from '../lib/dates'
import { compact, duration, formatNumber, greeting } from '../lib/format'

const SOURCE = { health_connect: 'Health Connect', ios_shortcut: 'iPhone Shortcut', manual: 'Manual' } as const

export default function TodayScreen() {
  const { profile, group } = useSession()
  const today = useToday()
  const { unread } = useInbox()
  const my = useMyData(addDays(today, -59), today)
  const day = my.data?.history.at(-1)
  const stat = my.data?.stats.find((s) => s.date === today)
  const { openEntry } = useSheets()

  const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'short', timeZone: profile.timezone }).format(new Date())

  return (
    <div className="animate-fade-in">
      <PageHeader
        subtitle={longDate}
        title={`${greeting(Math.floor(minutesOfDayIn(new Date(), profile.timezone) / 60))} ${profile.username}`}
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

      <div className="px-4 [&>*]:animate-rise">
        {!day ? (
          <Skeleton className="h-[380px]" />
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
  const top = STEP_TIERS.at(-1)!.min
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="relative flex items-center justify-between">
        <Chip tone="steps" className="py-1 text-xs">
          <Footprints className="size-3.5" /> Steps today
        </Chip>
        <Stars value={day.stepsStars} max={MAX_STEP_STARS} size={17} />
      </div>
      <div className="relative mt-3 flex justify-center">
        <Ring value={steps / GOALS.dailySteps} size={212} stroke={20} from="var(--steps)" to="var(--steps)">
          <div>
            <div className="display text-[48px]">
              <AnimatedNumber value={steps} format={formatNumber} />
            </div>
            <div className="mt-2 text-[13px] font-medium text-muted">of {formatNumber(GOALS.dailySteps)} goal</div>
            <div className="mx-auto mt-2 w-fit rounded-full bg-steps-soft px-2.5 py-0.5 text-xs font-bold text-steps-strong tabular">
              {Math.round((steps / GOALS.dailySteps) * 100)}%
            </div>
          </div>
        </Ring>
      </div>

      {/* Star tiers along one track. */}
      <div className="relative mt-5 px-3">
        <div className="relative h-2 rounded-full bg-surface-2">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-steps transition-[width] duration-1000"
            style={{ width: `${Math.min(1, steps / top) * 100}%` }}
          />
          {STEP_TIERS.map((t) => {
            const hit = steps >= t.min
            return (
              <span key={t.min} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(t.min / top) * 100}%` }}>
                <span className={cx('grid size-6 place-items-center rounded-full ring-[3px] ring-surface transition', hit ? 'bg-star text-white' : 'bg-surface-3 text-faint')}>
                  <Star className={cx('size-3', hit && 'fill-white')} strokeWidth={2.5} />
                </span>
              </span>
            )
          })}
        </div>
        <div className="relative mt-3 h-4">
          {STEP_TIERS.map((t) => (
            <span key={t.min} className="absolute -translate-x-1/2 text-[10.5px] font-semibold text-faint tabular" style={{ left: `${(t.min / top) * 100}%` }}>
              {compact(t.min)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
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
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]"
        >
          <Plus className="size-4" strokeWidth={2.6} /> Update
        </button>
      </div>
    </Card>
  )
}

function StreakCard({ icon, tone, value, unit, label }: { icon: typeof Flame; tone: 'steps' | 'sleep'; value: number; unit: string; label: string }) {
  return (
    <Card className="relative overflow-hidden p-4">
      <IconTile icon={icon} tone={tone === 'steps' ? 'hobby' : 'sleep'} size={38} />
      <p className="display mt-3 text-[26px]">
        <AnimatedNumber value={value} />
        <span className="ml-1 text-sm font-semibold tracking-normal text-muted">{value === 1 ? unit : `${unit}s`}</span>
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </Card>
  )
}

function SleepCard({ day, onAdd }: { day: DayScore; onAdd: () => void }) {
  const s = day.sleep
  if (!s)
    return (
      <Card className="flex items-center gap-4 p-5">
        <IconTile icon={BedDouble} tone="sleep" size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">No sleep data</p>
          <p className="text-[13px] text-muted">No data means 0★ for the night. Add it in seconds.</p>
        </div>
        <button type="button" onClick={onAdd} className="h-10 shrink-0 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]">
          Add
        </button>
      </Card>
    )
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-night p-5 text-white">
        <MoonStar className="pointer-events-none absolute top-5 right-5 size-7 text-white/40" aria-hidden />
        <span className="relative text-[13px] font-semibold text-white/70">Time asleep</span>
        <p className="display relative mt-2 text-[40px]">{duration(s.minutes)}</p>
        <Stars value={s.stars} max={MAX_SLEEP_STARS} size={16} className="relative mt-3" />
        <div className="relative mt-5 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold ring-1 ring-white/15">
            <MoonStar className="size-4" /> {clock(s.bedtime)}
          </span>
          <span className="h-px flex-1 bg-white/25" />
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold ring-1 ring-white/15">
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
    <Card className="relative overflow-hidden p-5">
      <div className="relative flex items-end justify-between">
        <p className="display text-[46px]">
          <AnimatedNumber value={day.total} />
          <span className="text-xl font-bold tracking-normal text-faint"> / {max}</span>
        </p>
        <span className="grid size-12 place-items-center rounded-[16px] bg-star-soft text-star-strong">
          <Star className="size-6 fill-current" />
        </span>
      </div>
      <div className="relative mt-4 flex h-3 gap-1 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p) => (
          <div key={p.label} className={cx('h-full rounded-full transition-[width] duration-700', p.color)} style={{ width: `${(p.value / max) * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.label} className="rounded-[18px] bg-surface-2/70 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <span className={cx('size-2 rounded-full', p.color)} />
              {p.label}
            </span>
            <span className="mt-1 block text-lg leading-none font-bold tabular">
              {p.value}
              <span className="text-[13px] font-semibold text-faint">/{p.max}</span>
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
      <Card className="grid grid-cols-7 gap-1 p-2.5">
        {days.map((d) => {
          const s = byDate.get(d)
          const future = d > today
          const pct = Math.min(1, (s?.steps ?? 0) / GOALS.dailySteps)
          return (
            <div key={d} className={cx('flex flex-col items-center gap-1.5 rounded-full py-2.5', d === today && 'bg-brand-soft ring-1 ring-brand/25')}>
              <span className={cx('text-[11px] font-semibold', d === today ? 'text-brand' : 'text-faint')}>{formatWeekdayLetter(d)}</span>
              <div className="relative h-16 w-3 overflow-hidden rounded-full bg-surface-2">
                {!future && (
                  <div
                    className={cx('absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-700', pct >= 1 ? 'bg-star' : 'bg-steps')}
                    style={{ height: `${pct * 100}%` }}
                  />
                )}
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
          <button type="button" onClick={openWorkout} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-3">
            <Plus className="size-4" strokeWidth={2.6} /> Log
          </button>
        }
      >
        Workouts & hobbies
      </SectionTitle>
      {workouts.length === 0 ? (
        <Card onClick={openWorkout} className="flex items-center gap-4 p-4">
          <IconTile icon={Dumbbell} tone="hobby" size={44} />
          <div className="flex-1">
            <p className="text-[15px] font-semibold">Nothing logged today</p>
            <p className="text-[13px] text-muted">One session = +{WORKOUT_BONUS.stars}★ for the day</p>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {workouts.map((w) => {
            const Icon = workoutIcon(w.type)
            return (
              <div key={w.id} className="flex items-center gap-3 p-4">
                <IconTile icon={Icon} tone="hobby" />
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
          <Link to="/ranking" className="inline-flex h-8 items-center gap-0.5 rounded-full bg-brand-soft pr-2 pl-3 text-[13px] font-bold text-brand">
            See all <ChevronRight className="size-4" />
          </Link>
        }
      >
        <span className="inline-flex items-center gap-2">
          <Trophy className="size-[18px] text-star" /> {group?.name}
        </span>
      </SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        <p className="px-4 pt-3 pb-2 text-[11px] font-bold tracking-[0.08em] text-faint uppercase">Steps today</p>
        {!data
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="m-3 h-10" />)
          : shown.map((r, i) => (
              <div key={r.profile.id} style={rise(i)} className={cx('flex animate-rise items-center gap-3 px-4 py-3', r.profile.id === user.id && 'bg-brand-soft/60')}>
                <RankBadge rank={r.rank} />
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
