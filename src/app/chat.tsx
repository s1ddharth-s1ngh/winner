// Chat state shared by the whole signed-in app: the chat list with unread counts, the people
// I can talk to, one realtime subscription, and the new-message toasts.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../components/toast'
import { repo } from '../data/repo'
import { plainText } from '../domain/chat'
import type { ChatEvent, ChatSummary, Group, Profile } from '../domain/types'
import { getPrefs } from './inbox'
import { useSession } from './session'

interface ChatState {
  chats: ChatSummary[] | undefined
  /** Unread messages in all chats. */
  unread: number
  /** Everyone in my groups, by user id. */
  people: Map<string, Profile>
  /** The chat on screen: no alert for it while the page is visible. */
  setOpen(id: string | null): void
  /** Thread screens hear every chat event here. */
  listen(cb: (e: ChatEvent) => void): () => void
  markRead(id: string, until: string): void
}

const Ctx = createContext<ChatState | null>(null)

export function useChat() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useChat outside ChatProvider')
  return c
}

export function chatTitle(chat: ChatSummary, groups: Group[], people: Map<string, Profile>, me: string) {
  if (chat.kind === 'group') return groups.find((g) => g.id === chat.group_id)?.name ?? 'Group'
  const other = chat.members.find((m) => m.user_id !== me)
  return (other && people.get(other.user_id)?.username) ?? 'Former member'
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, groups } = useSession()
  const toast = useToast()
  const [chats, setChats] = useState<ChatSummary[]>()
  const [people, setPeople] = useState(new Map<string, Profile>())
  const listeners = useRef(new Set<(e: ChatEvent) => void>())
  const open = useRef<string | null>(null)
  const latest = useRef({ chats, people, toast })
  useEffect(() => {
    latest.current = { chats, people, toast }
  })

  const load = useCallback(() => {
    repo.listChats().then(setChats, () => {})
  }, [])
  // A burst of events (everyone moving their read mark) becomes one reload.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reload = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 500)
  }, [load])

  const groupIds = groups.map((g) => g.id).join()
  useEffect(() => {
    let alive = true
    load()
    Promise.all(groupIds.split(',').filter(Boolean).map((id) => repo.listMembers(id))).then(
      (lists) => alive && setPeople(new Map(lists.flat().map((m) => [m.user_id, m.profile]))),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [groupIds, load])

  useEffect(() => {
    const notify = (e: ChatEvent) => {
      if (e.type !== 'message' || !e.inserted) return
      const m = e.message
      const { chats, people, toast } = latest.current
      if (m.author_id === user.id || m.deleted_at) return
      const visible = document.visibilityState === 'visible'
      if (open.current === m.conversation_id && visible) return
      // shortcut: a chat not in the list yet is taken as a new direct chat (group chats exist from the start).
      const kind = chats?.find((c) => c.id === m.conversation_id)?.kind ?? 'direct'
      // Group chat messages only raise the counter, unless they mention me.
      if (kind === 'group' && !m.mentions.includes(user.id)) return
      const name = (m.author_id && people.get(m.author_id)?.username) || 'Someone'
      const text = plainText(m.body).slice(0, 80)
      if (visible) return toast(`${name}: ${text}`, 'chat')
      if (getPrefs().system && 'Notification' in window && Notification.permission === 'granted')
        void navigator.serviceWorker?.ready.then((reg) =>
          reg.showNotification(name, { body: text, icon: `${import.meta.env.BASE_URL}pwa-192x192.png`, tag: `chat-${m.conversation_id}` }),
        )
    }
    const unsub = repo.subscribeChat((e) => {
      listeners.current.forEach((l) => l(e))
      notify(e)
      reload()
    })
    // Safety net if realtime drops.
    const t = setInterval(load, 60_000)
    return () => {
      unsub()
      clearInterval(t)
      clearTimeout(timer.current)
    }
  }, [user.id, load, reload])

  const setOpen = useCallback((id: string | null) => {
    open.current = id
  }, [])
  const listen = useCallback((cb: (e: ChatEvent) => void) => {
    listeners.current.add(cb)
    return () => void listeners.current.delete(cb)
  }, [])
  const markRead = useCallback(
    (id: string, until: string) => {
      // Counters drop at once; the server mark follows.
      setChats((cs) => cs?.map((c) => (c.id === id ? { ...c, unread: 0, unread_mentions: 0, read_until: until } : c)))
      repo.markRead(id, until).catch(() => reload())
    },
    [reload],
  )

  const unread = chats?.reduce((n, c) => n + c.unread, 0) ?? 0
  return <Ctx.Provider value={{ chats, unread, people, setOpen, listen, markRead }}>{children}</Ctx.Provider>
}
