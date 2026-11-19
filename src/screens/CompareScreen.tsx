import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useLive, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { Avatar, Card, IconButton, PageHeader, SectionTitle, Skeleton, cx, rise } from '../components/ui'
import { repo } from '../data/repo'
import { compareHistories, type Side } from '../domain/compare'
import { bedtimeRank, buildHistory, fromBedtimeRank } from '../domain/scoring'
import type { Profile } from '../domain/types'
import { addDays, clock, formatWeekdayShort, type ISODate } from '../lib/dates'
import { duration, formatNumber } from '../lib/format'

// shortcut: "best" and "days won" look back one year only; widen if the group runs longer.
const LOOKBACK_DAYS = 364

type Better = 'high' | 'low'
interface Line {
  label: string
  pick: (s: Side) => number | null
  format: (n: number) => string
  better?: Better
}

const steps = (n: number) => formatNumber(n)
const SECTIONS: { title: string; lines: Line[] }[] = [
  {
    title: 'Steps',
    lines: [
      { label: 'today', pick: (s) => s.stepsToday, format: steps },
      { label: 'yesterday', pick: (s) => s.stepsYesterday, format: steps },
      { label: 'last 7 days avg', pick: (s) => s.avg7, format: steps },
      { label: 'best day', pick: (s) => s.bestDay, format: steps },
      { label: 'best week', pick: (s) => s.bestWeek, format: steps },
      { label: 'days won', pick: (s) => s.daysWon, format: String },
      { label: 'longest win streak', pick: (s) => s.longestWinStreak, format: String },
    ],
  },
  {
    title: 'Sleep · last 7 nights',
    lines: [
      { label: 'avg sleep', pick: (s) => s.avgSleep7, format: duration },
      // Compared on the evening-first clock so 23:30 beats 00:15.
      { label: 'avg bedtime', pick: (s) => (s.avgBedtime7 == null ? null : bedtimeRank(s.avgBedtime7)), format: (r) => clock(fromBedtimeRank(r)), better: 'low' },
    ],
  },
  {
    title: 'Stars',
    lines: [
      { label: 'this week', pick: (s) => s.starsWeek, format: (n) => `${n}★` },
      { label: 'this month', pick: (s) => s.starsMonth, format: (n) => `${n}★` },
      { label: 'last 12 months', pick: (s) => s.starsTotal, format: (n) => `${n}★` },
    ],
  },
]

export default function CompareScreen() {
  const { userId } = useParams()
  const { user, profile, group } = useSession()
  const today = useToday()
  const navigate = useNavigate()
  const from = addDays(today, -LOOKBACK_DAYS)
  const { data, error } = useLive(async () => {
    const members = group ? await repo.listMembers(group.id) : []
    const them = members.find((m) => m.user_id === userId)?.profile
    if (!them) return null
    const ids = [user.id, them.id]
    const [stats, workouts] = await Promise.all([repo.listStats(ids, from, today), repo.listWorkouts(ids, from, today)])
    const scored = (p: Profile) =>
      buildHistory(stats.filter((s) => s.user_id === p.id), workouts.filter((w) => w.user_id === p.id), p.timezone, from, today)
    return { them, cmp: compareHistories(scored(profile), scored(them), today) }
  }, [group?.id, userId, user.id, profile, from, today])

  if (userId === user.id || data === null) return <Navigate to="/ranking" replace />
  const them = data?.them

  return (
    <div className="animate-fade-in">
      <div className="safe-top px-4 pt-3">
        <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate(-1)} />
      </div>
      <PageHeader subtitle={group?.name} title={them ? `You vs ${them.username}` : 'Compare'} />

      <div className="px-4">
        {error && <p className="text-center text-sm text-danger">{error}</p>}
        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-72" />
          </div>
        ) : (
          <>
            <Card className="flex items-center justify-around px-4 py-5">
              <Face p={profile} label="You" />
              <span className="text-lg font-black text-faint">VS</span>
              <Face p={data.them} label={data.them.username} />
            </Card>

            {SECTIONS.map((sec, si) => (
              <div key={sec.title}>
                <SectionTitle>{sec.title}</SectionTitle>
                <Card className="divide-y divide-line overflow-hidden">
                  {sec.lines.map((l, i) => (
                    <Row key={l.label} line={l} a={data.cmp.a} b={data.cmp.b} index={si * 4 + i} />
                  ))}
                </Card>
              </div>
            ))}

            <SectionTitle>Daily winner</SectionTitle>
            <Card className="grid grid-cols-7 gap-1 px-3 py-4">
              {data.cmp.winners.slice(-7).map((w) => (
                <DayCell key={w.date} date={w.date} winner={w.winner === 'a' ? profile : w.winner === 'b' ? data.them : null} />
              ))}
            </Card>
            <p className="mt-3 px-2 text-center text-xs text-muted">Most steps wins the day. Today counts once it's over.</p>
          </>
        )}
      </div>
    </div>
  )
}

function Face({ p, label }: { p: Profile; label: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <Avatar name={p.username} color={p.avatar_color} src={p.avatar_url} size={72} />
      <span className="max-w-full truncate text-sm font-semibold">{label}</span>
    </div>
  )
}

function Row({ line, a, b, index }: { line: Line; a: Side; b: Side; index: number }) {
  const va = line.pick(a)
  const vb = line.pick(b)
  const better = line.better ?? 'high'
  const aWins = va != null && (vb == null || (better === 'high' ? va > vb : va < vb))
  const bWins = vb != null && (va == null || (better === 'high' ? vb > va : vb < va))
  const cell = (v: number | null, win: boolean, right?: boolean): ReactNode => (
    <span className={cx('w-24 tabular', right && 'text-right', v == null ? 'text-faint' : win ? 'font-extrabold text-brand' : 'font-semibold text-ink-2')}>
      {v == null ? '—' : line.format(v)}
    </span>
  )
  return (
    <div style={rise(index)} className="flex animate-rise items-center px-4 py-3 text-[15px]">
      {cell(va, aWins)}
      <span className="flex-1 text-center text-[13px] text-muted">{line.label}</span>
      {cell(vb, bWins, true)}
    </div>
  )
}

function DayCell({ date, winner }: { date: ISODate; winner: Profile | null }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[11px] font-semibold text-faint">{formatWeekdayShort(date)}</span>
      {winner ? (
        <Avatar name={winner.username} color={winner.avatar_color} src={winner.avatar_url} size={34} />
      ) : (
        <span className="grid size-[34px] place-items-center rounded-full bg-surface-2 text-xs text-faint ring-1 ring-line">—</span>
      )}
    </div>
  )
}
