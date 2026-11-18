import { BedDouble, ChevronDown, CircleHelp, Crown, Footprints, Trophy, UserPlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useGroupData, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { Avatar, Card, Chip, IconButton, PageHeader, RankBadge, Segmented, Skeleton, StarCount, cx, rise } from '../components/ui'
import { buildLeaderboard, periodRange, type Board, type Period, type Row } from '../domain/leaderboard'
import { clock, timeAgo } from '../lib/dates'
import { compact, duration, formatNumber } from '../lib/format'
import ScoringSheet from './sheets/ScoringSheet'

const BOARDS: { value: Board; label: ReactNode }[] = [
  { value: 'steps', label: <><Footprints className="size-4" /> Steps</> },
  { value: 'sleep', label: <><BedDouble className="size-4" /> Sleep</> },
  { value: 'overall', label: <><Trophy className="size-4" /> Overall</> },
]
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export default function RankingScreen() {
  const { user, group, groups, selectGroup } = useSession()
  const today = useToday()
  const [board, setBoard] = useState<Board>('steps')
  const [period, setPeriod] = useState<Period>('today')
  const [help, setHelp] = useState(false)
  const range = periodRange(period, today)
  const { data, error } = useGroupData(range.from, range.to)
  const rows = data ? buildLeaderboard(data.data, board, range, today) : null
  const podium = rows && rows.filter((r) => r.rank != null).length >= 3 ? rows.slice(0, 3) : null
  const rest = rows ? (podium ? rows.slice(3) : rows) : []

  return (
    <div className="animate-fade-in">
      <PageHeader
        subtitle={
          groups.length > 1 ? (
            <label className="relative inline-flex items-center gap-1 font-semibold text-brand">
              {group?.name}
              <ChevronDown className="size-4" />
              <select aria-label="Group" value={group?.id} onChange={(e) => selectGroup(e.target.value)} className="absolute inset-0 opacity-0">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            group?.name
          )
        }
        title="Ranking"
        actions={<IconButton icon={CircleHelp} label="How scoring works" onClick={() => setHelp(true)} />}
      />

      <div className="px-4">
        <Segmented value={board} onChange={setBoard} options={BOARDS} />
        <Segmented value={period} onChange={setPeriod} options={PERIODS} size="sm" className="mx-auto mt-2.5 w-3/4" />

        {error && <p className="mt-6 text-center text-sm text-danger">{error}</p>}
        {!rows ? (
          <div className="mt-6 space-y-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <>
            {podium && <Podium key={`${board}-${period}`} rows={podium} board={board} me={user.id} />}
            <Card className={cx('divide-y divide-line overflow-hidden', podium ? 'mt-4' : 'mt-5')}>
              {rest.map((r, i) => (
                <RankRow key={`${board}-${period}-${r.profile.id}`} index={i} row={r} board={board} period={period} me={r.profile.id === user.id} />
              ))}
              <Link to="/groups" className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-semibold text-brand">
                <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-brand/40">
                  <UserPlus className="size-[18px]" />
                </span>
                Invite your friends
                <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-1 font-mono text-xs tracking-widest">{group?.invite_code}</span>
              </Link>
            </Card>
            {board !== 'steps' && (
              <p className="mt-4 px-2 text-center text-xs leading-relaxed text-muted">
                Nights without sleep data score 0★ and show as <b>no data</b>. Add sleep by hand from the + button if you don't track it automatically.
              </p>
            )}
          </>
        )}
      </div>
      <ScoringSheet open={help} onClose={() => setHelp(false)} />
    </div>
  )
}

const value = (r: Row, board: Board) =>
  board === 'steps' ? (
    <span className="tabular">{formatNumber(r.steps)}</span>
  ) : (
    <StarCount value={board === 'sleep' ? r.sleepStars : r.totalStars} />
  )

function subline(r: Row, board: Board, period: Period) {
  if (board === 'steps') {
    if (r.rank == null) return 'No update yet'
    if (period === 'today') return r.updatedAt ? `Updated ${timeAgo(r.updatedAt)}` : ''
    return `${compact(r.steps / r.nights)} / day · ${r.stepsStars}★`
  }
  if (board === 'sleep') {
    if (r.sleepNights === 0) return null
    const bed = r.avgBedtime != null ? clock(r.avgBedtime) : '—'
    const dur = r.avgSleepMinutes != null ? duration(r.avgSleepMinutes) : '—'
    return period === 'today' ? `Asleep ${bed} · ${dur}` : `Avg ${bed} · ${dur} · ${r.sleepNights}/${r.nights} nights`
  }
  return null
}

function RankRow({ row: r, board, period, me, index }: { row: Row; board: Board; period: Period; me: boolean; index: number }) {
  const sub = subline(r, board, period)
  return (
    <div style={rise(index)} className={cx('relative flex animate-rise items-center gap-3 px-4 py-3', me && 'bg-brand-soft/60')}>
      {me && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />}
      <RankBadge rank={r.rank} size={26} />
      <Avatar name={r.profile.username} color={r.profile.avatar_color} src={r.profile.avatar_url} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">
          {r.profile.username}
          {me && <span className="ml-1.5 text-xs font-semibold text-brand">You</span>}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {board === 'sleep' && r.sleepNights === 0 ? <Chip>no data</Chip> : sub}
          {board === 'overall' && (
            <>
              <Chip tone="steps">{r.stepsStars}★ steps</Chip>
              {r.flightsStars > 0 && <Chip tone="stairs">{r.flightsStars}★ stairs</Chip>}
              {r.sleepNights === 0 ? <Chip>sleep: no data</Chip> : <Chip tone="sleep">{r.sleepStars}★ sleep</Chip>}
              {r.workoutStars > 0 && <Chip tone="hobby">{r.workoutStars}★ hobby</Chip>}
            </>
          )}
        </div>
      </div>
      <span className="text-[17px] font-bold">{r.rank == null && board === 'steps' ? <span className="text-faint">—</span> : value(r, board)}</span>
    </div>
  )
}

function Podium({ rows, board, me }: { rows: Row[]; board: Board; me: string }) {
  // Visual order: 2nd, 1st, 3rd.
  const order = [rows[1], rows[0], rows[2]]
  const height = { 1: 'h-28', 2: 'h-20', 3: 'h-14' } as Record<number, string>
  const delay = { 1: 2, 2: 1, 3: 0 } as Record<number, number>
  return (
    <div className="relative mt-5 overflow-hidden rounded-[30px] bg-hero px-3 pt-10 text-white">
      <div className="relative grid grid-cols-3 items-end gap-2">
        {order.map((r) => {
          const rank = r.rank ?? 3
          return (
            <div key={r.profile.id} style={rise(delay[rank])} className="flex animate-rise flex-col items-center">
              <div className="relative">
                {rank === 1 && <Crown className="absolute -top-7 left-1/2 size-7 -translate-x-1/2 fill-[#f5b731] text-[#f5b731]" />}
                <span className={cx('block rounded-full p-[3px]', rank === 1 ? 'bg-[#f5b731]' : 'bg-white/25')}>
                  <Avatar name={r.profile.username} color={r.profile.avatar_color} src={r.profile.avatar_url} size={rank === 1 ? 70 : 56} />
                </span>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <RankBadge rank={rank} size={24} />
                </span>
              </div>
              <p className="mt-3.5 max-w-full truncate text-sm font-semibold text-white/90">{r.profile.id === me ? 'You' : r.profile.username}</p>
              <p className="text-base font-extrabold">{board === 'steps' ? <span className="tabular">{compact(r.steps)}</span> : value(r, board)}</p>
              <div
                className={cx(
                  'mt-2.5 w-full rounded-t-[18px] bg-white/15',
                  height[rank],
                )}
              >
                <p className="pt-2 text-center text-2xl font-black text-white/40">{rank}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
