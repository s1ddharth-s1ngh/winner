import { ChevronRight, Lock, Settings } from 'lucide-react'
import { Link } from 'react-router'
import { useMyData, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { Avatar, Card, SectionTitle, Skeleton, cx, rise } from '../components/ui'
import { BADGES, type BadgeTone } from '../config/badges'
import { longestStreak, qualifiesSleep, qualifiesSteps } from '../domain/scoring'
import { addDays, formatDayShort, formatMonth } from '../lib/dates'
import { formatNumber } from '../lib/format'

const TONE: Record<BadgeTone, string> = {
  steps: 'bg-steps',
  sleep: 'bg-sleep',
  star: 'bg-star',
  hobby: 'bg-hobby',
  brand: 'bg-brand',
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
      <div className="relative h-48 overflow-hidden rounded-b-[36px] bg-hero">
        <div className="safe-top absolute top-0 right-4">
          <Link
            to="/settings"
            aria-label="Settings"
            className="mt-3 grid size-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition-colors hover:bg-white/20"
          >
            <Settings className="size-[19px]" />
          </Link>
        </div>
      </div>
      <div className="relative z-10 -mt-14 flex flex-col items-center px-5 text-center">
        <Avatar name={profile.username} color={profile.avatar_color} size={100} ring />
        <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em]">{profile.username}</h1>
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
          ].map((k, i) => (
            <Card key={k.label} style={rise(i)} className="animate-rise px-3 py-4 text-center">
              <p className="display text-[22px]">{k.value}</p>
              <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{k.label}</p>
            </Card>
          ))}
        </div>

        <SectionTitle>Badges</SectionTitle>
        {!badges ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b, i) => (
              <Card key={b.id} style={rise(i)} className={cx('flex animate-rise flex-col items-center p-3 text-center', !b.at && 'opacity-80')}>
                <span
                  className={cx(
                    'relative grid size-14 place-items-center rounded-2xl text-white',
                    b.at ? TONE[b.tone] : 'bg-surface-2 text-faint',
                  )}
                  title={b.description}
                >
                  <b.icon className="size-7" strokeWidth={2} />
                  {!b.at && (
                    <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-surface-3 text-ink-2 ring-2 ring-surface">
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
        <Card className="divide-y divide-line overflow-hidden">
          <Link to="/groups" className="flex items-center gap-3 p-4">
            <span className="flex-1">
              <span className="block font-semibold">Your groups</span>
              <span className="block text-[13px] text-muted">{groups.map((g) => g.name).join(', ')}</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
          <Link to="/settings" className="flex items-center gap-3 p-4">
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
