// Demo backend: everything lives in this browser's localStorage.
// Used when no Supabase env vars are set. Demo friends are generated on the fly (see demoSeed.ts),
// so their "today" keeps moving while the app is open.
import { AVATAR_COLORS } from '../config/app'
import { browserTimezone, eachDay } from '../lib/dates'
import type { ApiToken, DailyStat, Group, Member, Profile, StatsInput, Workout } from '../domain/types'
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
}

const KEY = 'wfl:db:v1'
const SESSION = 'wfl:session'
const DEMO_ID = demoGroup().id
const PERSONAS = demoProfiles()

const empty = (): DB => ({ users: [], profiles: [], groups: [], members: [], stats: [], workouts: [], tokens: [] })

export function createLocalRepo(): Repo {
  const listeners = new Set<() => void>()
  const authListeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

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
    if (e.key === KEY) emit()
    if (e.key === SESSION) authListeners.forEach((l) => l())
  })

  // Demo friends' steps depend on the clock: nudge subscribers so the ranking moves live.
  setInterval(() => listeners.size && emit(), 30_000)

  const profileOf = (db: DB, id: string) => db.profiles.find((p) => p.id === id) ?? PERSONAS.find((p) => p.id === id)

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
      const db = load()
      const id = me()
      const mine = new Set(db.members.filter((m) => m.user_id === id).map((m) => m.group_id))
      return [...db.groups, demoGroup()].filter((g) => mine.has(g.id))
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

    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
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

