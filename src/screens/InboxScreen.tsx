import { ArrowLeft, BellRing, Footprints, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { useInbox } from '../app/inbox'
import { Avatar, Card, EmptyState, IconButton, PageHeader, cx, rise } from '../components/ui'
import { timeAgo } from '../lib/dates'

export default function InboxScreen() {
  const { items, unread, markAllRead, clear } = useInbox()

  // Opening the inbox marks everything as read (after a moment, so new items are still highlighted).
  useEffect(() => {
    if (!unread) return
    const t = setTimeout(markAllRead, 1500)
    return () => clearTimeout(t)
  }, [unread, markAllRead])

  return (
    <div className="animate-fade-in">
      <div className="safe-top flex items-center justify-between px-4 pt-3">
        <Link to="/">
          <IconButton icon={ArrowLeft} label="Back" />
        </Link>
        {items.length > 0 && (
          <button type="button" onClick={clear} className="surface-card h-9 rounded-full px-4 text-sm font-semibold text-muted transition hover:text-ink active:scale-95">
            Clear all
          </button>
        )}
      </div>
      <PageHeader title="Notifications" />
      <div className="px-4">
        {items.length === 0 ? (
          <Card className="animate-rise">
            <EmptyState icon={BellRing} title="All quiet" text="You'll see it here when a friend passes you in today's steps or overall ranking." />
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {items.map((i, n) => (
              <div key={i.id} className={cx('flex animate-rise items-center gap-3 px-4 py-3.5', !i.read && 'bg-brand-soft/50')} style={rise(Math.min(n, 8))}>
                <div className="relative">
                  <Avatar name={i.username} color={i.color} size={42} />
                  <span className={cx('absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-surface', i.board === 'steps' ? 'bg-[linear-gradient(135deg,var(--steps),var(--steps-strong))]' : 'bg-[linear-gradient(135deg,var(--star),var(--hobby))]')}>
                    {i.board === 'steps' ? <Footprints className="size-3" /> : <Trophy className="size-3" />}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">
                    <b>{i.username}</b> passed you
                  </p>
                  <p className="text-[13px] text-muted">{i.board === 'steps' ? "Today's steps ranking" : "Today's overall ranking"}</p>
                </div>
                <span className="text-xs text-faint">{timeAgo(i.at)}</span>
                {!i.read && <span className="size-2 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
