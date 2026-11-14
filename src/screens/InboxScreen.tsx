import { ArrowLeft, BellRing, Footprints, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { useInbox } from '../app/inbox'
import { Avatar, Card, EmptyState, IconButton, PageHeader, cx } from '../components/ui'
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
          <button type="button" onClick={clear} className="text-sm font-semibold text-muted">
            Clear all
          </button>
        )}
      </div>
      <PageHeader title="Notifications" />
      <div className="px-4">
        {items.length === 0 ? (
          <Card>
            <EmptyState icon={BellRing} title="All quiet" text="You'll see it here when a friend passes you in today's steps or overall ranking." />
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {items.map((i) => (
              <div key={i.id} className={cx('flex items-center gap-3 px-4 py-3.5', !i.read && 'bg-brand-soft/50')}>
                <div className="relative">
                  <Avatar name={i.username} color={i.color} size={42} />
                  <span className={cx('absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-white ring-2 ring-surface', i.board === 'steps' ? 'bg-steps' : 'bg-star')}>
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
                {!i.read && <span className="size-2 rounded-full bg-brand" />}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
