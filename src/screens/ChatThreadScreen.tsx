import { ArrowLeft, Copy, Pencil, Reply, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { chatTitle, useChat } from '../app/chat'
import { useSession } from '../app/session'
import { useToast } from '../components/toast'
import { Avatar, EmptyState, IconButton, Sheet, cx } from '../components/ui'
import { fromTagged, plainText, splitMentions } from '../domain/chat'
import type { ChatMessage, Profile } from '../domain/types'
import { dateIn, relativeDay, timeIn, todayIn } from '../lib/dates'
import { repo } from '../data/repo'
import Composer from './chat/Composer'

const PAGE = 50
const EMOJI = ['👍', '❤️', '😂', '🔥', '👏', '💪']
// Messages closer than this from the same author are drawn as one run.
const RUN_MS = 5 * 60_000

const nameOf = (people: Map<string, Profile>, id: string | null) => (id && people.get(id)?.username) || 'Someone'

export default function ChatThreadScreen() {
  const { id = '' } = useParams()
  const { user, profile, groups } = useSession()
  const { chats, people, setOpen, listen, markRead } = useChat()
  const toast = useToast()
  const chat = chats?.find((c) => c.id === id)

  const [limit, setLimit] = useState(PAGE)
  const [messages, setMessages] = useState<ChatMessage[]>()
  const [pending, setPending] = useState<ChatMessage[]>([])
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [actions, setActions] = useState<ChatMessage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(
    () => repo.listMessages(id, limit).then(setMessages, (e: Error) => toast(e.message, 'error')),
    [id, limit, toast],
  )
  useEffect(() => {
    void load()
  }, [load])

  useEffect(
    () =>
      listen((e) => {
        if (e.type === 'refresh') return void load()
        const m = e.message
        if (m.conversation_id !== id) return
        setMessages((ms) => ms && (ms.some((x) => x.id === m.id) ? ms.map((x) => (x.id === m.id ? m : x)) : [...ms, m]))
      }),
    [listen, load, id],
  )

  useEffect(() => {
    setOpen(id)
    return () => setOpen(null)
  }, [id, setOpen])

  // Read up to the last message shown, while the page is visible.
  const last = messages?.at(-1)
  useEffect(() => {
    if (!chat || !last || new Date(last.created_at) <= new Date(chat.read_until)) return
    const run = () => document.visibilityState === 'visible' && markRead(id, last.created_at)
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [chat, last, id, markRead])

  // Stay at the bottom when new messages arrive, unless the user scrolled up to read.
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const heightBefore = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (heightBefore.current !== null) {
      el.scrollTop += el.scrollHeight - heightBefore.current
      heightBefore.current = null
    } else if (stick.current) el.scrollTop = el.scrollHeight
  }, [messages, pending])

  if (chats && !chat)
    return (
      <div className="mx-auto max-w-md px-4 pt-16">
        <EmptyState title="Chat not found" text="It may belong to a group you left." action={<Link to="/chat" className="font-semibold text-brand">Back to chats</Link>} />
      </div>
    )

  const isGroup = chat?.kind === 'group'
  const group = groups.find((g) => g.id === chat?.group_id)
  const title = chat ? chatTitle(chat, groups, people, user.id) : ''
  const other = chat?.kind === 'direct' ? people.get(chat.members.find((m) => m.user_id !== user.id)?.user_id ?? '') : undefined
  const members = (chat?.members ?? []).map((m) => people.get(m.user_id)).filter((p): p is Profile => !!p && p.id !== user.id)
  const all = [...(messages ?? []), ...pending]
  const byId = new Map(all.map((m) => [m.id, m]))
  const today = todayIn(profile.timezone)
  // "Seen" under my last message in a direct chat, once the other person read past it.
  const myLast = all.findLast((m) => m.author_id === user.id && !m.sending)
  const otherRead = chat?.kind === 'direct' ? chat.members.find((m) => m.user_id !== user.id)?.read_until : undefined
  const seenId = myLast && otherRead && new Date(otherRead) >= new Date(myLast.created_at) ? myLast.id : null

  const send = async (body: string, mentions: string[]) => {
    if (editing) {
      await repo.editMessage(editing.id, body, mentions)
      setEditing(null)
      void load()
      return
    }
    const temp: ChatMessage = {
      id: `sending-${Date.now()}`,
      conversation_id: id,
      author_id: user.id,
      body,
      mentions,
      reply_to: reply?.id ?? null,
      reactions: {},
      edited_at: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
      sending: true,
    }
    stick.current = true
    setPending((p) => [...p, temp])
    setReply(null)
    try {
      await repo.sendMessage(id, body, mentions, temp.reply_to)
      await load()
    } finally {
      setPending((p) => p.filter((x) => x !== temp))
    }
  }

  const react = (m: ChatMessage, emoji: string) => {
    setActions(null)
    setMessages((ms) =>
      ms?.map((x) => {
        if (x.id !== m.id) return x
        const list = x.reactions[emoji] ?? []
        const next = list.includes(user.id) ? list.filter((u) => u !== user.id) : [...list, user.id]
        const reactions = { ...x.reactions, [emoji]: next }
        if (!next.length) delete reactions[emoji]
        return { ...x, reactions }
      }),
    )
    repo.react(m.id, emoji).catch((e: Error) => {
      toast(e.message, 'error')
      void load()
    })
  }

  const remove = async (m: ChatMessage) => {
    setActions(null)
    try {
      await repo.deleteMessage(m.id)
      void load()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const closeActions = () => {
    setActions(null)
    setConfirmDelete(false)
  }
  const canDelete = (m: ChatMessage) => m.author_id === user.id || (isGroup && group?.created_by === user.id)

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="safe-top flex items-center gap-3 border-b border-line px-3 pt-3 pb-3">
        <Link to="/chat">
          <IconButton icon={ArrowLeft} label="Back to chats" />
        </Link>
        {other ? <Avatar name={other.username} color={other.avatar_color} src={other.avatar_url} size={38} /> : <Avatar name={title} color="var(--brand)" size={38} />}
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold">{title}</h1>
          {isGroup && <p className="text-xs text-muted">{chat?.members.length} members</p>}
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
        className="no-scrollbar flex-1 overflow-y-auto px-3 py-3"
      >
        {messages && messages.length >= limit && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => {
                heightBefore.current = scroller.current?.scrollHeight ?? null
                setLimit((n) => n + PAGE)
              }}
              className="h-8 rounded-full bg-surface-2 px-4 text-[13px] font-semibold text-muted ring-1 ring-line hover:text-ink"
            >
              Load earlier messages
            </button>
          </div>
        )}
        {messages && all.length === 0 && <EmptyState title="No messages yet" text={isGroup ? 'Say hi to the group.' : `Say hi to ${title}.`} />}
        {all.map((m, i) => {
          const prev = all[i - 1]
          const day = dateIn(m.created_at, profile.timezone)
          const newDay = !prev || dateIn(prev.created_at, profile.timezone) !== day
          const run = !newDay && prev.author_id === m.author_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < RUN_MS
          const mine = m.author_id === user.id
          const author = m.author_id ? people.get(m.author_id) : undefined
          const quoted = m.reply_to ? byId.get(m.reply_to) : undefined
          return (
            <div key={m.id}>
              {newDay && <div className="my-3 text-center text-xs font-semibold text-faint">{relativeDay(day, today)}</div>}
              <div className={cx('flex gap-2', mine ? 'justify-end' : 'justify-start', run ? 'mt-0.5' : 'mt-2.5')}>
                {!mine && isGroup && (run ? <span className="w-7 shrink-0" /> : <Avatar name={author?.username ?? '?'} color={author?.avatar_color ?? 'var(--faint)'} src={author?.avatar_url} size={28} />)}
                <div className={cx('flex max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
                  {!mine && isGroup && !run && <span className="mb-0.5 px-3 text-xs font-semibold text-muted">{nameOf(people, m.author_id)}</span>}
                  <button
                    type="button"
                    disabled={m.sending || !!m.deleted_at}
                    onClick={() => setActions(m)}
                    className={cx(
                      'rounded-[20px] px-3.5 py-2 text-left text-[15px] break-words whitespace-pre-wrap',
                      mine ? 'bg-brand text-white' : 'bg-surface-2 text-ink ring-1 ring-line',
                      m.sending && 'opacity-60',
                    )}
                  >
                    {m.reply_to && (
                      <span className={cx('mb-1 block border-l-2 pl-2 text-[13px]', mine ? 'border-white/60 text-white/80' : 'border-brand text-muted')}>
                        {quoted ? (
                          <>
                            <b>{nameOf(people, quoted.author_id)}</b> {quoted.deleted_at ? 'Message deleted' : plainText(quoted.body).slice(0, 80)}
                          </>
                        ) : (
                          'Earlier message'
                        )}
                      </span>
                    )}
                    {m.deleted_at ? <i className="opacity-70">Message deleted</i> : <MessageText body={m.body} people={people} me={user.id} mine={mine} />}
                    <span className={cx('ml-2 inline-block text-[11px]', mine ? 'text-white/70' : 'text-faint')}>
                      {m.edited_at && !m.deleted_at && 'edited · '}
                      {timeIn(m.created_at, profile.timezone)}
                    </span>
                  </button>
                  {Object.keys(m.reactions).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(m.reactions).map(([emoji, ids]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(m, emoji)}
                          title={ids.map((u) => nameOf(people, u)).join(', ')}
                          className={cx('rounded-full px-2 py-0.5 text-[13px] ring-1', ids.includes(user.id) ? 'bg-brand-soft ring-brand' : 'bg-surface ring-line')}
                        >
                          {emoji} {ids.length}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.id === seenId && <span className="mt-0.5 px-2 text-[11px] text-faint">Seen</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Composer
        key={editing?.id ?? 'new'}
        people={members}
        initial={editing ? fromTagged(editing.body) : undefined}
        onSend={send}
        banner={
          (reply || editing) && (
            <div className="mb-2 flex items-center gap-2 rounded-[18px] bg-surface-2 px-3 py-2 text-[13px] ring-1 ring-line">
              {editing ? <Pencil className="size-4 shrink-0 text-brand" /> : <Reply className="size-4 shrink-0 text-brand" />}
              <span className="min-w-0 flex-1 truncate">
                {editing ? (
                  'Editing message'
                ) : (
                  <>
                    <b>{nameOf(people, reply!.author_id)}</b> {plainText(reply!.body)}
                  </>
                )}
              </span>
              <button type="button" aria-label="Cancel" onClick={() => (setReply(null), setEditing(null))} className="text-faint hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
          )
        }
      />

      <Sheet open={!!actions} onClose={closeActions} title="Message">
        {actions && (
          <div className="grid gap-3">
            <div className="flex justify-between">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`React ${e}`}
                  onClick={() => react(actions, e)}
                  className={cx('grid size-12 place-items-center rounded-full text-2xl transition-transform active:scale-90', actions.reactions[e]?.includes(user.id) ? 'bg-brand-soft ring-1 ring-brand' : 'bg-surface-2')}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface ring-1 ring-line">
              <Action icon={Reply} label="Reply" onClick={() => (setReply(actions), setEditing(null), closeActions())} />
              <Action icon={Copy} label="Copy text" onClick={() => (void navigator.clipboard?.writeText(plainText(actions.body)), closeActions())} />
              {actions.author_id === user.id && <Action icon={Pencil} label="Edit" onClick={() => (setEditing(actions), setReply(null), closeActions())} />}
              {canDelete(actions) && (
                <Action
                  icon={Trash2}
                  label={confirmDelete ? 'Tap again to delete' : 'Delete'}
                  danger
                  onClick={() => (confirmDelete ? (void remove(actions), setConfirmDelete(false)) : setConfirmDelete(true))}
                />
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Action({ icon: Icon, label, onClick, danger }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold transition-colors hover:bg-surface-2', danger && 'text-danger')}>
      <Icon className="size-5" />
      {label}
    </button>
  )
}

/** Message text with mentions drawn as pills. The name comes from the profile when known. */
function MessageText({ body, people, me, mine }: { body: string; people: Map<string, Profile>; me: string; mine: boolean }) {
  return (
    <>
      {splitMentions(body).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <span key={i} className={cx('rounded-md px-1 font-semibold', mine ? 'bg-white/20' : part.id === me ? 'bg-brand text-white' : 'bg-brand-soft text-brand')}>
            @{people.get(part.id)?.username ?? part.name}
          </span>
        ),
      )}
    </>
  )
}
