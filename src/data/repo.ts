import type { ISODate } from '../lib/dates'
import type {
  ApiToken,
  ChatEvent,
  ChatMessage,
  ChatSummary,
  DailyStat,
  GarminLink,
  Group,
  Member,
  Profile,
  StatsInput,
  Workout,
} from '../domain/types'
import { createLocalRepo } from './localRepo'
import { createSupabaseRepo } from './supabaseRepo'

export interface AuthUser {
  id: string
  email: string
}

export type ProfileInput = Partial<Pick<Profile, 'username' | 'avatar_color' | 'avatar_url' | 'cover_color' | 'cover_url' | 'timezone'>>
export type WorkoutInput = Pick<Workout, 'date' | 'type' | 'duration_min' | 'note'>

/** Everything the UI needs from a backend. Screens never talk to a backend directly. */
export interface Repo {
  readonly kind: 'local' | 'supabase'

  getUser(): Promise<AuthUser | null>
  signUp(email: string, password: string): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  onAuthChange(cb: () => void): () => void

  getProfile(userId: string): Promise<Profile | null>
  saveProfile(input: ProfileInput): Promise<Profile>
  /** Stores a JPEG for the signed-in user and returns its URL (save it with saveProfile). */
  uploadProfileImage(kind: 'avatar' | 'cover', jpeg: Blob): Promise<string>

  listGroups(): Promise<Group[]>
  createGroup(name: string): Promise<Group>
  joinGroup(inviteCode: string): Promise<Group>
  leaveGroup(groupId: string): Promise<void>
  listMembers(groupId: string): Promise<Member[]>

  listStats(userIds: string[], from: ISODate, to: ISODate): Promise<DailyStat[]>
  saveStats(input: StatsInput): Promise<void>
  listWorkouts(userIds: string[], from: ISODate, to: ISODate): Promise<Workout[]>
  addWorkout(input: WorkoutInput): Promise<void>
  deleteWorkout(id: string): Promise<void>

  listTokens(): Promise<ApiToken[]>
  /** Returns the plain token once; only its hash is stored. */
  createToken(label: string): Promise<string>
  revokeToken(id: string): Promise<void>

  getGarmin(): Promise<GarminLink | null>
  /** Checks the key with Garmin, stores it encrypted on the server and imports today (never days before the connection). */
  connectGarmin(apiKey: string): Promise<void>
  /** Imports the last 7 days now (the server also syncs on a schedule). */
  syncGarmin(): Promise<void>
  disconnectGarmin(): Promise<void>

  /** Fires on any data change (own writes, other tabs, realtime). Returns unsubscribe. */
  subscribe(cb: () => void): () => void

  /** My chats, newest first, with unread counts. */
  listChats(): Promise<ChatSummary[]>
  /** The last `limit` messages of a chat, oldest first. */
  listMessages(conversationId: string, limit: number): Promise<ChatMessage[]>
  /** Finds or creates the direct chat with a group mate. Returns its id. */
  openDirect(userId: string): Promise<string>
  sendMessage(conversationId: string, body: string, mentions: string[], replyTo: string | null): Promise<void>
  editMessage(messageId: string, body: string, mentions: string[]): Promise<void>
  deleteMessage(messageId: string): Promise<void>
  /** Toggle: adds my reaction, or removes it if already there. */
  react(messageId: string, emoji: string): Promise<void>
  /** Moves my read mark forward to `until` (the last message shown). */
  markRead(conversationId: string, until: string): Promise<void>
  /** Chat changes only (separate from `subscribe`, so a message does not reload every screen). */
  subscribeChat(cb: (e: ChatEvent) => void): () => void

  /** Demo-only helpers (local backend). */
  demo?: {
    fillMyHistory(days: number): Promise<void>
    reset(): void
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const repo: Repo = url && key ? createSupabaseRepo(url, key) : createLocalRepo()
