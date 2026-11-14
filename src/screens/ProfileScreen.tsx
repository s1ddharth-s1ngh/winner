import { ChevronRight, Lock, Settings, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useMyData, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { Avatar, Card, IconButton, SectionTitle, Skeleton, cx } from '../components/ui'
import { BADGES, type BadgeTone } from '../config/badges'
import { longestStreak, qualifiesSleep, qualifiesSteps } from '../domain/scoring'
import { addDays, formatDayShort, formatMonth } from '../lib/dates'
import { formatNumber } from '../lib/format'

const TONE: Record<BadgeTone, string> = {
  steps: 'bg-[linear-gradient(135deg,#34d399,var(--steps-strong))]',
  sleep: 'bg-[linear-gradient(135deg,#a78bfa,var(--sleep-strong))]',
  star: 'bg-[linear-gradient(135deg,#ffd76a,#f59e0b)]',
  hobby: 'bg-[linear-gradient(135deg,#fdba74,var(--hobby))]',
  brand: 'bg-[linear-gradient(135deg,#818cf8,var(--brand))]',
}

export default function ProfileScreen() {
  const { profile, groups } = useSession()
  const today = useToday()
  const { data } = useMyData(addDays(today, -400), today)
  const history = data?.history
  const badges = history ? BADGES.map((b) => ({ ...b, at: b.earned(history), prog: b.progress?.(history) })) : null
  const earned = badges?.filter((b) => b.at) ?? []

  return (
    <div className="animate-fade-in">
      <div className="relative h-40 overflow-hidden bg-[radial-gradient(120%_120%_at_10%_0%,#6d6bff,#4f46e5_45%,#3b1fa8)]">
        <div className="absolute -right-16 -bottom-24 size-64 rounded-full border border-white/10" />
        <div className="absolute right-10 -bottom-10 size-32 rounded-full bg-white/5" />
        <div className="safe-top absolute top-0 right-4">
          <Link to="/settings">
            <IconButton icon={Settings} label="Settings" className="mt-3 bg-white/15 text-white ring-white/20 hover:bg-white/25" />
          </Link>
        </div>
      </div>
      <div className="relative z-10 -mt-12 px-5">
        <Avatar name={profile.username} color={profile.avatar_color} size={96} ring />
        <h1 className="mt-3 text-[26px] font-bold tracking-tight">{profile.username}</h1>
        <p className="text-[13px] text-muted">
          Member since {formatMonth(profile.created_at.slice(0, 10))} · {profile.timezone.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="px-4">
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Stars', value: history ? formatNumber(history.reduce((s, d) => s + d.total, 0)) : '–' },
            { label: 'Badges', value: badges ? `${earned.length}/${BADGES.length}` : '–' },
            { label: 'Best streak', value: history ? `${Math.max(longestStreak(history, qualifiesSteps), longestStreak(history, qualifiesSleep))}d` : '–' },
          ].map((k) => (
            <Card key={k.label} className="px-3 py-3.5 text-center">
              <p className="text-xl font-bold tabular">{k.value}</p>
              <p className="text-[11px] font-medium text-muted">{k.label}</p>
            </Card>
          ))}
        </div>

        <SectionTitle>Badges</SectionTitle>
        {!badges ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b) => (
              <Card key={b.id} className={cx('flex flex-col items-center p-3 text-center', !b.at && 'bg-surface/60')}>
                <span
                  className={cx(
                    'relative grid size-14 place-items-center rounded-2xl text-white',
                    b.at ? `${TONE[b.tone]} shadow-[0_8px_20px_-10px_rgba(0,0,0,0.5)]` : 'bg-surface-2 text-faint',
                  )}
                  title={b.description}
                >
                  <b.icon className="size-7" strokeWidth={2} />
                  {!b.at && (
                    <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-ink-2 text-white ring-2 ring-surface">
                      <Lock className="size-3" strokeWidth={2.5} />
                    </span>
                  )}
                </span>
                <p className={cx('mt-2 text-[13px] leading-tight font-bold', !b.at && 'text-muted')}>{b.name}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{b.at ? `Earned ${formatDayShort(b.at)}` : b.description}</p>
                {!b.at && b.prog && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.min(100, (b.prog[0] / b.prog[1]) * 100)}%` }} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <SectionTitle>Groups</SectionTitle>
        <Card className="divide-y divide-line">
          <Link to="/groups" className="flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <Users className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Your groups</span>
              <span className="block text-[13px] text-muted">{groups.map((g) => g.name).join(', ')}</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
          <Link to="/settings" className="flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink-2">
              <Settings className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Settings</span>
              <span className="block text-[13px] text-muted">Profile, data sources, notifications</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
        </Card>
      </div>
    </div>
  )
}
