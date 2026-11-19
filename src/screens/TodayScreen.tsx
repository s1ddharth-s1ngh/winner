import { Activity, Bell, ChevronRight, Footprints, MessageCircle, MoonStar, Plus, RefreshCw, Star, Sunrise, Trash2, TrendingUp, Trophy } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useChat } from '../app/chat'
import { useGroupData, useLive, useMyData, useToday } from '../app/hooks'
import { useInbox } from '../app/inbox'
import { useSession } from '../app/session'
import { useSheets } from '../app/AppShell'
import { Ring } from '../components/charts'
import { AnimatedNumber, Avatar, Card, Chip, IconButton, PageHeader, RankBadge, SectionTitle, Skeleton, StarCount, Stars, cx, rise } from '../components/ui'
import { useToast } from '../components/toast'
import { FLIGHT_TIERS, GOALS, MAX_FLIGHT_STARS, MAX_SLEEP_STARS, MAX_STEP_STARS, STEP_TIERS, WORKOUT_BONUS } from '../config/scoring'
import { repo } from '../data/repo'
import { buildLeaderboard, periodRange } from '../domain/leaderboard'
import type { Workout } from '../domain/types'
import { currentStreak, qualifiesSleep, qualifiesSteps, type DayScore } from '../domain/scoring'
import { addDays, clock, formatWeekdayLetter, minutesOfDayIn, startOfWeek, timeAgo, type ISODate } from '../lib/dates'
import { compact, duration, formatNumber, greeting } from '../lib/format'
import { IOS_SHORTCUT_URL, isIOS } from '../native/health'

const SOURCE = { health_connect: 'Health Connect', ios_shortcut: 'iPhone Shortcut', garmin: 'Garmin', manual: 'Manual' } as const

export default function TodayScreen() {
  const { profile, group } = useSession()
  const today = useToday()
  const { unread } = useInbox()
  const { unread: chatUnread } = useChat()
  const my =useMyData(addDays(today, -59), today)
  const day = my.data?.history.at(-1)
  const stat = my.data?.stats.find((s) => s.date === today)
  const { openEntry, openWorkout } = useSheets()

  const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'short', timeZone: profile.timezone }).format(new Date())

  return (
    <div className="animate-fade-in">
      <PageHeader
        subtitle={longDate}
        title={`${greeting(Math.floor(minutesOfDayIn(new Date(), profile.timezone) / 60))} ${profile.username}`}
        actions={
          <>
            {isIOS() && <IosSyncButton updatedAt={stat?.updated_at} />}
            <Link to="/chat">
              <IconButton icon={MessageCircle} label="Chats" badge={chatUnread > 0} />
            </Link>
            <Link to="/inbox">
              <IconButton icon={Bell} label="Notifications" badge={unread > 0} />
            </Link>
            <Link to="/profile" aria-label="Profile">
              <Avatar name={profile.username} color={profile.avatar_color} src={profile.avatar_url} size={40} />
            </Link>
          </>
        }
      />

      <div className="px-4 [&>*]:animate-rise">
        {!day ? (
          <Skeleton className="h-[380px]" />
        ) : (
          <Slides labels={['Steps', 'Stairs', 'Sleep', 'Hobbies']}>
            <GoalHero
              kind="steps"
              value={day.steps}
              stars={day.stepsStars}
              source={stat?.steps_source ? `${SOURCE[stat.steps_source]} · ${timeAgo(stat.updated_at)}` : null}
              onAdd={() => openEntry(today)}
            />
            <GoalHero
              kind="flights"
              value={day.flights}
              stars={day.flightsStars}
              source={stat?.flights_source ? `${SOURCE[stat.flights_source]} · ${timeAgo(stat.updated_at)}` : null}
              onAdd={() => openEntry(today)}
            />
            <SleepHero day={day} onAdd={() => openEntry(today)} />
            <HobbyHero day={day} workouts={my.data?.workouts ?? []} today={today} onAdd={openWorkout} />
          </Slides>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {my.data ? (
            <>
              <StreakCard value={currentStreak(my.data.history, qualifiesSteps)} unit="day" label="Steps streak" />
              <StreakCard value={currentStreak(my.data.history, qualifiesSleep)} unit="night" label="Sleep streak" />
            </>
          ) : (
            <>
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[92px]" />
            </>
          )}
        </div>

        <SectionTitle>Today's stars</SectionTitle>
        {day && <StarsCard day={day} />}

        {my.data && <WeekStrip history={my.data.history} today={today} />}

        <WorkoutsToday workouts={my.data?.workouts.filter((w) => w.date === today) ?? []} />

        {group && <MiniRanking today={today} />}
      </div>
    </div>
  )
}

/** Horizontally swipeable cards with dots. Each child is one full-width slide. */
/**
 * iPhone only: runs the Apple Health shortcut, which writes to the server.
 * When the user comes back, the data reloads; we compare today's `updated_at` to tell them if anything arrived.
 */
function IosSyncButton({ updatedAt }: { updatedAt?: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const tokens = useLive(() => repo.listTokens(), [])
  const [syncing, setSyncing] = useState(false)
  const latest = useRef(updatedAt)
  useEffect(() => {
    latest.current = updatedAt
  })

  const sync = () => {
    if (tokens.data?.length === 0) {
      toast('Set up the iPhone Shortcut first')
      navigate('/settings')
      return
    }
    const before = updatedAt
    let left = false
    setSyncing(true)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') return void (left = true)
      document.removeEventListener('visibilitychange', onVisibility)
      // The reload on return (repo.subscribe) needs a moment before we judge.
      setTimeout(() => {
        setSyncing(false)
        if (latest.current !== before) toast('Synced with Apple Health')
        else toast('No new data. Open the Shortcut to check it.', 'error')
      }, 2500)
    }
    document.addEventListener('visibilitychange', onVisibility)
    location.href = IOS_SHORTCUT_URL
    // Shortcuts never opened (app missing or link blocked): stop spinning.
    setTimeout(() => {
      if (left) return
      document.removeEventListener('visibilitychange', onVisibility)
      setSyncing(false)
      toast('Could not open the Shortcuts app', 'error')
    }, 4000)
  }

  return <IconButton icon={RefreshCw} label="Sync Apple Health" onClick={sync} disabled={syncing} className={cx(syncing && '[&>svg]:animate-spin')} />
}

function Slides({ labels, children }: { labels: string[]; children: ReactNode[] }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4"
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {children.map((c, i) => (
          <div key={labels[i]} className="w-full shrink-0 snap-start" aria-roledescription="slide" aria-label={labels[i]}>
            {c}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
        {labels.map((l, i) => (
          <span key={l} className={cx('h-1.5 rounded-full transition-all', i === active ? 'w-4 bg-ink-2' : 'w-1.5 bg-surface-3')} />
        ))}
      </div>
    </div>
  )
}

const HERO = {
  steps: {
    label: 'Steps today',
    icon: Footprints,
    tiers: STEP_TIERS,
    goal: GOALS.dailySteps,
    maxStars: MAX_STEP_STARS,
    tick: compact,
    empty: 'No steps yet today.',
    color: 'var(--steps)',
    tone: 'steps',
    soft: 'bg-steps-soft text-steps-strong',
    bar: 'bg-steps',
    strong: 'text-steps-strong',
  },
  flights: {
    label: 'Flights of stairs',
    icon: TrendingUp,
    tiers: FLIGHT_TIERS,
    goal: GOALS.dailyFlights,
    maxStars: MAX_FLIGHT_STARS,
    tick: String,
    empty: 'No stairs yet today.',
    color: 'var(--stairs)',
    tone: 'stairs',
    soft: 'bg-stairs-soft text-stairs-strong',
    bar: 'bg-stairs',
    strong: 'text-stairs-strong',
  },
} as const

function GoalHero({ kind, value, stars, source, onAdd }: { kind: keyof typeof HERO; value: number | null; stars: number; source: string | null; onAdd: () => void }) {
  const h = HERO[kind]
  const Icon = h.icon
  const v = value ?? 0
  const tiers: readonly { min: number }[] = h.tiers
  const next = tiers.find((t) => v < t.min)
  const top = tiers.at(-1)!.min
  return (
    <Card className="relative h-full overflow-hidden p-5">
      <div className="relative flex items-center justify-between">
        <Chip tone={h.tone} className="py-1 text-xs">
          <Icon className="size-3.5" /> {h.label}
        </Chip>
        <Stars value={stars} max={h.maxStars} size={17} />
      </div>
      <div className="relative mt-3 flex justify-center">
        <Ring value={v / h.goal} size={212} stroke={20} from={h.color} to={h.color}>
          <div>
            <div className="display text-[48px]">
              <AnimatedNumber value={v} format={formatNumber} />
            </div>
            <div className="mt-2 text-[13px] font-medium text-muted">of {formatNumber(h.goal)} goal</div>
            <div className={cx('mx-auto mt-2 w-fit rounded-full px-2.5 py-0.5 text-xs font-bold tabular', h.soft)}>
              {Math.round((v / h.goal) * 100)}%
            </div>
          </div>
        </Ring>
      </div>

      {/* Star tiers along one track. */}
      <div className="relative mt-5 px-3">
        <div className="relative h-2 rounded-full bg-surface-2">
          <div
            className={cx('absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000', h.bar)}
            style={{ width: `${Math.min(1, v / top) * 100}%` }}
          />
          {tiers.map((t) => {
            const hit = v >= t.min
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
          {tiers.map((t) => (
            <span key={t.min} className="absolute -translate-x-1/2 text-[10.5px] font-semibold text-faint tabular" style={{ left: `${(t.min / top) * 100}%` }}>
              {h.tick(t.min)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[13px] text-muted">
          {value == null ? (
            h.empty
          ) : next ? (
            <>
              <b className="text-ink tabular">{formatNumber(next.min - v)}</b> to your next star
            </>
          ) : (
            <b className={h.strong}>Max stars reached. Legend.</b>
          )}
          {source && <span className="block text-xs text-faint">{source}</span>}
        </p>
        <UpdateButton onClick={onAdd} />
      </div>
    </Card>
  )
}

function StreakCard({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <Card className="relative overflow-hidden p-4">
      <p className="display text-[26px]">
        <AnimatedNumber value={value} />
        <span className="ml-1 text-sm font-semibold tracking-normal text-muted">{value === 1 ? unit : `${unit}s`}</span>
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </Card>
  )
}

function UpdateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]"
    >
      <Plus className="size-4" strokeWidth={2.6} /> Update
    </button>
  )
}

function SleepHero({ day, onAdd }: { day: DayScore; onAdd: () => void }) {
  const s = day.sleep
  const minutes = s?.minutes ?? 0
  return (
    <Card className="relative flex h-full flex-col overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <Chip tone="steps" className="py-1 text-xs">
          <MoonStar className="size-3.5" /> Last night
        </Chip>
        <Stars value={s?.stars ?? 0} max={MAX_SLEEP_STARS} size={17} />
      </div>
      <div className="mt-3 flex justify-center">
        <Ring value={minutes / GOALS.sleepMinutes} size={212} stroke={20} from="var(--steps)" to="var(--steps)">
          <div>
            <div className="display text-[40px]">{s ? duration(minutes) : '0h'}</div>
            <div className="mt-2 text-[13px] font-medium text-muted">of {duration(GOALS.sleepMinutes)} goal</div>
            <div className="mx-auto mt-2 w-fit rounded-full bg-steps-soft px-2.5 py-0.5 text-xs font-bold text-steps-strong tabular">
              {Math.round((minutes / GOALS.sleepMinutes) * 100)}%
            </div>
          </div>
        </Ring>
      </div>

      <div className="mt-5 mb-4 flex items-center gap-3 px-1 text-sm">
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 font-semibold tabular">
          <MoonStar className="size-4 text-sleep" /> {s ? clock(s.bedtime) : '—'}
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 font-semibold tabular">
          <Sunrise className="size-4 text-star" /> {s?.wake != null ? clock(s.wake) : '—'}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[13px] text-muted">
          {s ? (
            <>
              Bedtime <b className="text-ink">+{s.bedtimeStars}★</b> · {s.durationBonus ? <b className="text-steps-strong">7–9h bonus +1★</b> : 'no 7–9h bonus'}
            </>
          ) : (
            'No sleep data. That means 0★ for the night.'
          )}
        </p>
        <UpdateButton onClick={onAdd} />
      </div>
    </Card>
  )
}

function HobbyHero({ day, workouts, today, onAdd }: { day: DayScore; workouts: Workout[]; today: ISODate; onAdd: () => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i))
  const week = workouts.filter((w) => w.date >= days[0] && w.date <= today)
  const minutes = week.reduce((s, w) => s + w.duration_min, 0)
  const goal = GOALS.weeklyHobbyMinutes
  const todayCount = week.filter((w) => w.date === today).length
  return (
    <Card className="relative flex h-full flex-col overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <Chip tone="hobby" className="py-1 text-xs">
          <Activity className="size-3.5" /> Hobbies this week
        </Chip>
        <Stars value={day.workoutStars} max={WORKOUT_BONUS.stars} size={17} />
      </div>
      <div className="mt-3 flex justify-center">
        <Ring value={minutes / goal} size={212} stroke={20} from="var(--hobby)" to="var(--hobby)">
          <div>
            <div className="display text-[40px]">{duration(minutes)}</div>
            <div className="mt-2 text-[13px] font-medium text-muted">of {duration(goal)} goal</div>
            <div className="mx-auto mt-2 w-fit rounded-full bg-hobby-soft px-2.5 py-0.5 text-xs font-bold text-hobby-strong tabular">
              {minutes > goal ? `+${duration(minutes - goal)} extra` : `${Math.round((minutes / goal) * 100)}%`}
            </div>
          </div>
        </Ring>
      </div>

      {/* One dot per weekday: filled when at least one session was logged. */}
      <div className="mt-5 mb-4 grid grid-cols-7 px-1">
        {days.map((d) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <span className={cx('size-6 rounded-full', week.some((w) => w.date === d) ? 'bg-hobby' : d > today ? 'bg-surface-2' : 'bg-surface-3')} />
            <span className={cx('text-[11px] font-bold', d === today ? 'text-hobby-strong' : 'text-faint')}>{formatWeekdayLetter(d)}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[13px] text-muted">
          {todayCount > 0 ? (
            <>
              <b className="text-ink tabular">{todayCount}</b> {todayCount === 1 ? 'session' : 'sessions'} today · <b className="text-hobby-strong">+{WORKOUT_BONUS.stars}★</b>
            </>
          ) : (
            `Nothing logged today. One session = +${WORKOUT_BONUS.stars}★.`
          )}
        </p>
        <div className="theme-hobby shrink-0">
          <UpdateButton onClick={onAdd} />
        </div>
      </div>
    </Card>
  )
}

function StarsCard({ day }: { day: DayScore }) {
  const parts = [
    { label: 'Steps', value: day.stepsStars, max: MAX_STEP_STARS, color: 'bg-steps' },
    { label: 'Stairs', value: day.flightsStars, max: MAX_FLIGHT_STARS, color: 'bg-stairs' },
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
      </div>
      <div className="relative mt-4 flex h-3 gap-1 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p) => (
          <div key={p.label} className={cx('h-full rounded-full transition-[width] duration-700', p.color)} style={{ width: `${(p.value / max) * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2">
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
  const totals = days.map((d) => byDate.get(d)?.total ?? 0)
  const weekTotal = totals.reduce((a, b) => a + b, 0)
  const todayIdx = days.indexOf(today)
  // Scale to the best day (min 4★) so a quiet week still has some shape.
  const max = Math.max(4, ...totals)
  // Chart space is a 100×100 viewBox: 20 units of headroom for the star labels, line sits in 20..92.
  const pts = totals.map((v, i) => ({ x: ((i + 0.5) / 7) * 100, y: 92 - (v / max) * 72 }))
  const past = pts.slice(0, todayIdx + 1)
  // Smooth curve with horizontal tangents: never overshoots below zero or above the max.
  const line = past.reduce((p, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`
    const prev = past[i - 1]
    const mid = (prev.x + pt.x) / 2
    return `${p} C${mid},${prev.y} ${mid},${pt.y} ${pt.x},${pt.y}`
  }, '')
  const area = past.length > 1 ? `${line} L${past[past.length - 1].x},100 L${past[0].x},100 Z` : ''
  const t = pts[todayIdx]
  return (
    <>
      <SectionTitle action={<StarCount value={weekTotal} className="text-sm text-muted" />}>This week</SectionTitle>
      <Card className="overflow-hidden px-2 pt-3 pb-3">
        <div className="relative h-40">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="week-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20, 56, 92].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            ))}
            {t && <line x1={t.x} x2={t.x} y1={t.y} y2="100" stroke="var(--brand)" strokeOpacity="0.35" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
            {area && <path d={area} fill="url(#week-area)" />}
            <path d={line} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Dots are HTML so they stay round while the SVG stretches. */}
          {pts.map((p, i) =>
            i === todayIdx ? null : (
              <span
                key={i}
                className={cx(
                  'absolute size-2.5 -translate-1/2 rounded-full',
                  i < todayIdx ? 'bg-surface ring-[2.5px] ring-brand' : 'bg-line',
                )}
                style={{ left: `${p.x}%`, top: `${i < todayIdx ? p.y : 92}%` }}
              />
            ),
          )}
          {pts.map((p, i) =>
            i < todayIdx ? (
              <span
                key={`v${i}`}
                className={cx('absolute -translate-x-1/2 text-[15px] leading-none font-extrabold tabular', totals[i] > 0 ? 'text-ink' : 'text-faint')}
                style={{ left: `${p.x}%`, top: `calc(${p.y}% - 26px)` }}
              >
                {totals[i]}★
              </span>
            ) : null,
          )}
          {t && (
            <>
              <span className="absolute size-7 -translate-1/2 animate-ping rounded-full motion-reduce:hidden bg-brand/25" style={{ left: `${t.x}%`, top: `${t.y}%` }} />
              <span className="absolute size-3.5 -translate-1/2 rounded-full bg-brand ring-4 ring-brand/20" style={{ left: `${t.x}%`, top: `${t.y}%` }} />
              <span
                className="absolute -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-[15px] font-extrabold whitespace-nowrap text-bg tabular shadow-sm"
                style={{ left: `clamp(24px, ${t.x}%, calc(100% - 24px))`, top: `calc(${t.y}% - 36px)` }}
              >
                {totals[todayIdx]}★
              </span>
            </>
          )}
        </div>
        <div className="mt-1 grid grid-cols-7">
          {days.map((d, i) => (
            <span key={d} className={cx('text-center text-[11px] font-bold', i === todayIdx ? 'text-brand' : 'text-faint')}>
              {formatWeekdayLetter(d)}
            </span>
          ))}
        </div>
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
          <div className="flex-1">
            <p className="text-[15px] font-semibold">Nothing logged today</p>
            <p className="text-[13px] text-muted">One session = +{WORKOUT_BONUS.stars}★ for the day</p>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {workouts.map((w) => {
            return (
              <div key={w.id} className="flex items-center gap-3 p-4">
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
              <Link
                key={r.profile.id}
                to={r.profile.id === user.id ? '/stats' : `/friend/${r.profile.id}`}
                style={rise(i)}
                className={cx('flex animate-rise items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2', r.profile.id === user.id && 'bg-brand-soft/60')}
              >
                <RankBadge rank={r.rank} />
                <Avatar name={r.profile.username} color={r.profile.avatar_color} src={r.profile.avatar_url} size={34} />
                <span className="flex-1 truncate font-semibold">
                  {r.profile.username}
                  {r.profile.id === user.id && <span className="ml-1.5 text-xs font-semibold text-brand">You</span>}
                </span>
                {r.rank ? <span className="font-bold tabular">{compact(r.steps)}</span> : <span className="text-[13px] font-medium text-faint">No steps yet</span>}
              </Link>
            ))}
      </Card>
    </>
  )
}
