import { ChevronDown, CircleHelp, Crown, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useGroupData, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { Avatar, Card, Chip, IconButton, PageHeader, Segmented, Skeleton, StarCount, cx } from '../components/ui'
import { buildLeaderboard, periodRange, type Board, type Period, type Row } from '../domain/leaderboard'
import { clock, timeAgo } from '../lib/dates'
import { compact, duration, formatNumber } from '../lib/format'
import ScoringSheet from './sheets/ScoringSheet'

const BOARDS: { value: Board; label: string }[] = [
  { value: 'steps', label: 'Steps' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'overall', label: 'Overall' },
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
        <Segmented value={period} onChange={setPeriod} options={PERIODS} size="sm" className="mt-2 bg-transparent" />

        {error && <p className="mt-6 text-center text-sm text-danger">{error}</p>}
        {!rows ? (
          <div className="mt-6 space-y-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <>
            {podium && <Podium rows={podium} board={board} me={user.id} />}
            <Card className={cx('divide-y divide-line', podium ? 'mt-4' : 'mt-5')}>
              {rest.map((r) => (
                <RankRow key={r.profile.id} row={r} board={board} period={period} me={r.profile.id === user.id} />
              ))}
              <Link to="/groups" className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-semibold text-brand">
                <span className="grid size-10 place-items-center rounded-full border-2 border-dashed border-brand/40">
                  <UserPlus className="size-[18px]" />
                </span>
                Invite your friends
                <span className="ml-auto rounded-lg bg-brand-soft px-2 py-1 font-mono text-xs tracking-widest">{group?.invite_code}</span>
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

function RankRow({ row: r, board, period, me }: { row: Row; board: Board; period: Period; me: boolean }) {
  const sub = subline(r, board, period)
  return (
    <div className={cx('flex items-center gap-3 px-4 py-3', me && 'bg-brand-soft/60')}>
      <span className="w-6 text-center text-[15px] font-bold text-muted tabular">{r.rank ?? '–'}</span>
      <Avatar name={r.profile.username} color={r.profile.avatar_color} size={40} />
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
  const height = { 1: 'h-28', 2: 'h-20', 3: 'h-16' } as Record<number, string>
  const block = {
    1: 'from-brand/25 to-brand/5 text-brand/50',
    2: 'from-[#cbd5e1]/70 to-[#cbd5e1]/10 text-[#94a3b8]',
    3: 'from-[#f6c9a0]/70 to-[#f6c9a0]/10 text-[#d9894b]/70',
  } as Record<number, string>
  const medal = { 1: 'from-[#ffd76a] to-[#f5a524]', 2: 'from-[#e3e8f0] to-[#b6c0cf]', 3: 'from-[#f6c9a0] to-[#d9894b]' } as Record<number, string>
  return (
    <div className="mt-6 grid grid-cols-3 items-end gap-2">
      {order.map((r) => {
        const rank = r.rank ?? 3
        return (
          <div key={r.profile.id} className="flex animate-pop flex-col items-center">
            <div className="relative">
              {rank === 1 && <Crown className="absolute -top-6 left-1/2 size-6 -translate-x-1/2 fill-star text-star" />}
              <Avatar name={r.profile.username} color={r.profile.avatar_color} size={rank === 1 ? 68 : 56} ring />
              <span className={cx('absolute -bottom-2 left-1/2 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b text-xs font-extrabold text-white ring-2 ring-bg', medal[rank])}>
                {rank}
              </span>
            </div>
            <p className={cx('mt-3 max-w-full truncate text-sm font-semibold', r.profile.id === me && 'text-brand')}>
              {r.profile.id === me ? 'You' : r.profile.username}
            </p>
            <p className="text-[15px] font-bold">{board === 'steps' ? <span className="tabular">{compact(r.steps)}</span> : value(r, board)}</p>
            <div className={cx('mt-2 grid w-full place-items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-2xl font-extrabold', height[rank], block[rank])}>{rank}</div>
          </div>
        )
      })}
    </div>
  )
}
