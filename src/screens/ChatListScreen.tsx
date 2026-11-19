import { ArrowLeft, SquarePen } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { chatTitle, useChat } from '../app/chat'
import { useSession } from '../app/session'
import { useToast } from '../components/toast'
import { Avatar, Card, EmptyState, IconButton, PageHeader, Sheet, Skeleton, cx, rise } from '../components/ui'
import { repo } from '../data/repo'
import { plainText } from '../domain/chat'
import type { ChatSummary } from '../domain/types'
import { timeAgo } from '../lib/dates'

export default function ChatListScreen() {
  const { user, groups } = useSession()
  const { chats, people } = useChat()
  const toast = useToast()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)

  const mates = [...people.values()].filter((p) => p.id !== user.id).sort((a, b) => a.username.localeCompare(b.username))
  const start = async (userId: string) => {
    try {
      navigate(`/chat/${await repo.openDirect(userId)}`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const preview = (c: ChatSummary) => {
    if (!c.last) return 'No messages yet'
    if (c.last.deleted) return 'Message deleted'
    const who = c.last.author_id === user.id ? 'You: ' : c.kind === 'group' ? `${people.get(c.last.author_id ?? '')?.username ?? 'Someone'}: ` : ''
    return who + plainText(c.last.body)
  }

  return (
    <div className="animate-fade-in">
      <div className="safe-top flex items-center justify-between px-4 pt-3">
        <Link to="/">
          <IconButton icon={ArrowLeft} label="Back" />
        </Link>
        <IconButton icon={SquarePen} label="New chat" onClick={() => setPicking(true)} />
      </div>
      <PageHeader title="Chats" />
      <div className="px-4">
        {!chats ? (
          <Skeleton className="h-48" />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {chats.map((c, n) => {
              const other = c.kind === 'direct' ? people.get(c.members.find((m) => m.user_id !== user.id)?.user_id ?? '') : undefined
              const title = chatTitle(c, groups, people, user.id)
              return (
                <Link key={c.id} to={`/chat/${c.id}`} className="flex animate-rise items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2" style={rise(Math.min(n, 8))}>
                  {other ? <Avatar name={other.username} color={other.avatar_color} src={other.avatar_url} size={46} /> : <Avatar name={title} color="var(--brand)" size={46} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cx('truncate text-[15px]', c.unread ? 'font-bold' : 'font-semibold')}>{title}</p>
                      {c.last && <span className="shrink-0 text-xs text-faint">{timeAgo(c.last.created_at)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={cx('flex-1 truncate text-[13px]', c.unread ? 'text-ink' : 'text-muted')}>{preview(c)}</p>
                      {c.unread_mentions > 0 && <span className="text-[13px] font-bold text-brand">@</span>}
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{c.unread > 99 ? '99+' : c.unread}</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </Card>
        )}
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="New chat">
        {mates.length === 0 ? (
          <EmptyState title="No friends yet" text="Invite friends to your group, then you can message them here." />
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface ring-1 ring-line">
            {mates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => (setPicking(false), void start(p.id))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold transition-colors hover:bg-surface-2"
              >
                <Avatar name={p.username} color={p.avatar_color} src={p.avatar_url} size={36} />
                {p.username}
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  )
}
