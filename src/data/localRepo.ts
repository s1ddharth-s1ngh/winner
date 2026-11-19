// Demo backend: everything lives in this browser's localStorage.
// Used when no Supabase env vars are set. Demo friends are generated on the fly (see demoSeed.ts),
// so their "today" keeps moving while the app is open.
import { AVATAR_COLORS } from '../config/app'
import { browserTimezone, eachDay } from '../lib/dates'
import type { ApiToken, ChatEvent, ChatMessage, ChatSummary, DailyStat, Group, Member, Profile, StatsInput, Workout } from '../domain/types'
import { applyStatsInput, inviteCode, randomToken, sha256 } from './shared'
import { DEMO_GROUP_CODE, demoGroup, demoPersona as personaOf, demoProfiles, generateDay, myDemoHistory } from './demoSeed'
import type { AuthUser, ProfileInput, Repo, WorkoutInput } from './repo'

interface DB {
  users: { id: string; email: string; pass: string }[]
  profiles: Profile[]
  groups: Group[]
  members: Omit<Member, 'profile'>[]
  stats: DailyStat[]
  workouts: Workout[]
  tokens: (ApiToken & { user_id: string; token_hash: string })[]
  // Chat. A group chat's id is the group id; direct chats are stored.
  directs: { id: string; members: string[]; created_at: string }[]
  chatReads: { conversation_id: string; user_id: string; read_until: string }[]
  messages: ChatMessage[]
}

const KEY = 'wfl:db:v1'
const SESSION = 'wfl:session'
const DEMO_ID = demoGroup().id
const PERSONAS = demoProfiles()

const empty = (): DB => ({
  users: [],
  profiles: [],
  groups: [],
  members: [],
  stats: [],
  workouts: [],
  tokens: [],
  directs: [],
  chatReads: [],
  messages: [],
})

export function createLocalRepo(): Repo {
  const listeners = new Set<() => void>()
  const authListeners = new Set<() => void>()
  const chatListeners = new Set<(e: ChatEvent) => void>()
  const emit = () => listeners.forEach((l) => l())
  const chatEmit = (e: ChatEvent) => chatListeners.forEach((l) => l(e))

  const load = (): DB => {
    try {
      return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    } catch {
      return empty()
    }
  }
  const save = (db: DB) => {
    localStorage.setItem(KEY, JSON.stringify(db))
    emit()
  }
  const me = () => {
    const id = localStorage.getItem(SESSION)
    if (!id) throw new Error('Not signed in')
    return id
  }

  // Other tabs write → refresh this one.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      emit()
      chatEmit({ type: 'refresh' })
    }
    if (e.key === SESSION) authListeners.forEach((l) => l())
  })

  // Demo friends' steps depend on the clock: nudge subscribers so the ranking moves live.
  setInterval(() => listeners.size && emit(), 30_000)

  const profileOf = (db: DB, id: string) => db.profiles.find((p) => p.id === id) ?? PERSONAS.find((p) => p.id === id)

  const myGroups = (db: DB) => {
    const id = me()
    const mine = new Set(db.members.filter((m) => m.user_id === id).map((m) => m.group_id))
    return [...db.groups, demoGroup()].filter((g) => mine.has(g.id))
  }

  // Chat: same rules as the chat_* RPCs in supabase/migrations/20261119002331_chat.sql.
  const groupMemberIds = (db: DB, groupId: string) => [
    ...db.members.filter((m) => m.group_id === groupId).map((m) => m.user_id),
    ...(groupId === DEMO_ID ? PERSONAS.map((p) => p.id) : []),
  ]
  const chatMemberIds = (db: DB, conv: string) => db.directs.find((d) => d.id === conv)?.members ?? groupMemberIds(db, conv)
  const readUntil = (db: DB, conv: string, user: string) =>
    db.chatReads.find((r) => r.conversation_id === conv && r.user_id === user)?.read_until ??
    db.directs.find((d) => d.id === conv)?.created_at ??
    db.members.find((m) => m.group_id === conv && m.user_id === user)?.joined_at ??
    new Date().toISOString()
  const setRead = (db: DB, conv: string, user: string, until: string) => {
    const r = db.chatReads.find((x) => x.conversation_id === conv && x.user_id === user)
    if (!r) db.chatReads.push({ conversation_id: conv, user_id: user, read_until: until })
    else if (r.read_until < until) r.read_until = until
  }
  const seeChat = (db: DB, conv: string) => {
    if (!chatMemberIds(db, conv).includes(me())) throw new Error('Chat not found.')
  }
  const ownMessage = (db: DB, id: string) => {
    const m = db.messages.find((x) => x.id === id && !x.deleted_at)
    if (!m || !chatMemberIds(db, m.conversation_id).includes(me())) throw new Error('Message not found.')
    return m
  }
  const checkBody = (body: string) => {
    if (!body.trim()) throw new Error('The message is empty.')
    if (body.trim().length > 4000) throw new Error('The message is too long (4000 characters max).')
  }
  const cleanMentions = (db: DB, conv: string, ids: string[]) => {
    const members = chatMemberIds(db, conv)
    return [...new Set(ids)].filter((id) => id !== me() && members.includes(id))
  }
  // Chat writes skip `emit()`: a message must not reload every screen.
  const saveChat = (db: DB, e: ChatEvent) => {
    localStorage.setItem(KEY, JSON.stringify(db))
    chatEmit(e)
  }

  return {
    kind: 'local',

    async getUser(): Promise<AuthUser | null> {
      const id = localStorage.getItem(SESSION)
      const u = id ? load().users.find((x) => x.id === id) : undefined
      return u ? { id: u.id, email: u.email } : null
    },

    async signUp(email, password) {
      const db = load()
      const normalized = email.trim().toLowerCase()
      if (db.users.some((u) => u.email === normalized)) throw new Error('This username is already taken.')
      const id = crypto.randomUUID()
      // Demo only: a real backend never stores password hashes in the browser.
      db.users.push({ id, email: normalized, pass: await sha256(`${normalized}:${password}`) })
      db.profiles.push({
        id,
        username: normalized.split('@')[0].slice(0, 20),
        avatar_color: AVATAR_COLORS[db.users.length % AVATAR_COLORS.length],
        avatar_url: null,
        cover_color: null,
        cover_url: null,
        timezone: browserTimezone(),
        created_at: new Date().toISOString(),
      })
      save(db)
      localStorage.setItem(SESSION, id)
      authListeners.forEach((l) => l())
    },

    async signIn(email, password) {
      const normalized = email.trim().toLowerCase()
      const u = load().users.find((x) => x.email === normalized)
      if (!u || u.pass !== (await sha256(`${normalized}:${password}`))) throw new Error('Wrong username or password.')
      localStorage.setItem(SESSION, u.id)
      authListeners.forEach((l) => l())
    },

    async signOut() {
      localStorage.removeItem(SESSION)
      authListeners.forEach((l) => l())
    },

    onAuthChange(cb) {
      authListeners.add(cb)
      return () => authListeners.delete(cb)
    },

    async getProfile(userId) {
      return profileOf(load(), userId) ?? null
    },

    async saveProfile(input: ProfileInput) {
      const db = load()
      const p = db.profiles.find((x) => x.id === me())
      if (!p) throw new Error('Profile not found')
      Object.assign(p, input)
      save(db)
      return p
    },

    // Demo: the image lives inline in localStorage as a data URL.
    uploadProfileImage(_kind, jpeg) {
      return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => reject(r.error)
        r.readAsDataURL(jpeg)
      })
    },

    async listGroups() {
      return myGroups(load())
    },

    async createGroup(name) {
      const db = load()
      const group: Group = {
        id: crypto.randomUUID(),
        name: name.trim(),
        invite_code: inviteCode(),
        created_by: me(),
        created_at: new Date().toISOString(),
      }
      db.groups.push(group)
      db.members.push({ group_id: group.id, user_id: me(), role: 'owner', joined_at: group.created_at })
      save(db)
      return group
    },

    async joinGroup(code) {
      const db = load()
      const normalized = code.trim().toUpperCase()
      const group = normalized === DEMO_GROUP_CODE ? demoGroup() : db.groups.find((g) => g.invite_code === normalized)
      if (!group) throw new Error('No group found with this invite code.')
      if (!db.members.some((m) => m.group_id === group.id && m.user_id === me()))
        db.members.push({ group_id: group.id, user_id: me(), role: 'member', joined_at: new Date().toISOString() })
      save(db)
      return group
    },

    async leaveGroup(groupId) {
      const db = load()
      db.members = db.members.filter((m) => !(m.group_id === groupId && m.user_id === me()))
      save(db)
    },

    async listMembers(groupId) {
      const db = load()
      const real = db.members
        .filter((m) => m.group_id === groupId)
        .map((m) => ({ ...m, profile: profileOf(db, m.user_id)! }))
        .filter((m) => m.profile)
      const demo: Member[] =
        groupId === DEMO_ID
          ? PERSONAS.map((p) => ({ group_id: groupId, user_id: p.id, role: 'member', joined_at: p.created_at, profile: p }))
          : []
      return [...real, ...demo]
    },

    async listStats(userIds, from, to) {
      const db = load()
      const now = new Date()
      const real = db.stats.filter((s) => userIds.includes(s.user_id) && s.date >= from && s.date <= to)
      const demo = PERSONAS.filter((p) => userIds.includes(p.id)).flatMap((p) =>
        eachDay(from, to)
          .map((d) => generateDay(personaOf(p.id), d, now).stat)
          .filter((s): s is DailyStat => s != null && new Date(s.updated_at) <= now),
      )
      return [...real, ...demo]
    },

    async saveStats(input: StatsInput) {
      const db = load()
      const id = me()
      const i = db.stats.findIndex((s) => s.user_id === id && s.date === input.date)
      const next = applyStatsInput(i >= 0 ? db.stats[i] : null, id, input)
      if (i >= 0) db.stats[i] = next
      else db.stats.push(next)
      save(db)
    },

    async listWorkouts(userIds, from, to) {
      const db = load()
      const now = new Date()
      const real = db.workouts.filter((w) => userIds.includes(w.user_id) && w.date >= from && w.date <= to)
      const demo = PERSONAS.filter((p) => userIds.includes(p.id)).flatMap((p) =>
        eachDay(from, to)
          .map((d) => generateDay(personaOf(p.id), d, now).workout)
          .filter((w): w is Workout => w != null && new Date(w.created_at) <= now),
      )
      return [...real, ...demo]
    },

    async addWorkout(input: WorkoutInput) {
      const db = load()
      db.workouts.push({ ...input, id: crypto.randomUUID(), user_id: me(), created_at: new Date().toISOString() })
      save(db)
    },

    async deleteWorkout(id) {
      const db = load()
      db.workouts = db.workouts.filter((w) => !(w.id === id && w.user_id === me()))
      save(db)
    },

    async listTokens() {
      return load()
        .tokens.filter((t) => t.user_id === me())
        .map(({ id, label, created_at, last_used_at }) => ({ id, label, created_at, last_used_at }))
    },

    async createToken(label) {
      const db = load()
      const token = randomToken()
      db.tokens.push({
        id: crypto.randomUUID(),
        user_id: me(),
        label: label.trim() || 'Token',
        token_hash: await sha256(token),
        created_at: new Date().toISOString(),
        last_used_at: null,
      })
      save(db)
      return token
    },

    async revokeToken(id) {
      const db = load()
      db.tokens = db.tokens.filter((t) => !(t.id === id && t.user_id === me()))
      save(db)
    },

    // Garmin needs the server: the API key must never be stored in the browser.
    async getGarmin() {
      return null
    },
    async connectGarmin() {
      throw new Error('Garmin works only with the server, not in demo mode.')
    },
    async syncGarmin() {
      throw new Error('Garmin works only with the server, not in demo mode.')
    },
    async disconnectGarmin() {},

    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    async listChats() {
      const db = load()
      const id = me()
      const groups = myGroups(db).map((g) => ({ id: g.id, kind: 'group' as const, group_id: g.id, created_at: g.created_at }))
      const directs = db.directs.filter((d) => d.members.includes(id)).map((d) => ({ id: d.id, kind: 'direct' as const, group_id: null, created_at: d.created_at }))
      return [...groups, ...directs]
        .map((c): ChatSummary => {
          const msgs = db.messages.filter((m) => m.conversation_id === c.id)
          const last = msgs.at(-1)
          const mine = readUntil(db, c.id, id)
          const unread = msgs.filter((m) => m.created_at > mine && m.author_id !== id && !m.deleted_at)
          return {
            ...c,
            read_until: mine,
            last_message_at: last?.created_at ?? c.created_at,
            members: chatMemberIds(db, c.id).map((u) => ({ user_id: u, read_until: readUntil(db, c.id, u) })),
            last: last ? { id: last.id, author_id: last.author_id, body: last.body.slice(0, 240), deleted: !!last.deleted_at, created_at: last.created_at } : null,
            unread: unread.length,
            unread_mentions: unread.filter((m) => m.mentions.includes(id)).length,
          }
        })
        .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
    },

    async listMessages(conversationId, limit) {
      const db = load()
      seeChat(db, conversationId)
      return db.messages.filter((m) => m.conversation_id === conversationId).slice(-limit)
    },

    async openDirect(userId) {
      const db = load()
      const id = me()
      const mates = new Set(myGroups(db).flatMap((g) => groupMemberIds(db, g.id)))
      if (userId === id || !mates.has(userId)) throw new Error('You can only message friends from your groups.')
      const pair = [id, userId].sort()
      let d = db.directs.find((x) => x.members.join() === pair.join())
      if (!d) {
        d = { id: crypto.randomUUID(), members: pair, created_at: new Date().toISOString() }
        db.directs.push(d)
        saveChat(db, { type: 'refresh' })
      }
      return d.id
    },

    async sendMessage(conversationId, body, mentions, replyTo) {
      const db = load()
      seeChat(db, conversationId)
      checkBody(body)
      const now = new Date().toISOString()
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        author_id: me(),
        body: body.trim(),
        mentions: cleanMentions(db, conversationId, mentions),
        reply_to: db.messages.some((m) => m.id === replyTo && m.conversation_id === conversationId) ? replyTo : null,
        reactions: {},
        edited_at: null,
        created_at: now,
        deleted_at: null,
      }
      db.messages.push(message)
      setRead(db, conversationId, me(), now)
      saveChat(db, { type: 'message', message, inserted: true })
    },

    async editMessage(messageId, body, mentions) {
      const db = load()
      const m = ownMessage(db, messageId)
      if (m.author_id !== me()) throw new Error('You can only edit your own messages.')
      checkBody(body)
      Object.assign(m, { body: body.trim(), mentions: cleanMentions(db, m.conversation_id, mentions), edited_at: new Date().toISOString() })
      saveChat(db, { type: 'message', message: m, inserted: false })
    },

    async deleteMessage(messageId) {
      const db = load()
      const m = ownMessage(db, messageId)
      const owner = db.members.some((x) => x.group_id === m.conversation_id && x.user_id === me() && x.role === 'owner')
      if (m.author_id !== me() && !owner) throw new Error('You can only delete your own messages.')
      Object.assign(m, { body: '', mentions: [], reactions: {}, deleted_at: new Date().toISOString() })
      saveChat(db, { type: 'message', message: m, inserted: false })
    },

    async react(messageId, emoji) {
      const db = load()
      const m = ownMessage(db, messageId)
      const list = m.reactions[emoji] ?? []
      if (!list.includes(me()) && !m.reactions[emoji] && Object.keys(m.reactions).length >= 12)
        throw new Error('Too many different reactions on this message.')
      const next = list.includes(me()) ? list.filter((u) => u !== me()) : [...list, me()]
      if (next.length) m.reactions[emoji] = next
      else delete m.reactions[emoji]
      saveChat(db, { type: 'message', message: m, inserted: false })
    },

    async markRead(conversationId, until) {
      const db = load()
      if (!chatMemberIds(db, conversationId).includes(me())) return
      const now = new Date().toISOString()
      setRead(db, conversationId, me(), until < now ? until : now)
      saveChat(db, { type: 'refresh' })
    },

    subscribeChat(cb) {
      chatListeners.add(cb)
      return () => chatListeners.delete(cb)
    },

    demo: {
      async fillMyHistory(days) {
        const db = load()
        const id = me()
        const tz = profileOf(db, id)?.timezone ?? browserTimezone()
        const { stats, workouts } = myDemoHistory(id, tz, days)
        const taken = new Set(db.stats.filter((s) => s.user_id === id).map((s) => s.date))
        db.stats.push(...stats.filter((s) => !taken.has(s.date)))
        db.workouts.push(...workouts)
        save(db)
      },
      reset() {
        localStorage.removeItem(KEY)
        localStorage.removeItem(SESSION)
        authListeners.forEach((l) => l())
        emit()
      },
    },
  }
}

