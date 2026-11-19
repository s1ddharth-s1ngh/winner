// Supabase backend. Active when VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.
// Schema + RLS: supabase/migrations. Group create/join go through security-definer RPCs.
import { createClient, FunctionsHttpError, type AuthError, type PostgrestError } from '@supabase/supabase-js'
import { browserTimezone } from '../lib/dates'
import type { ApiToken, ChatMessage, ChatSummary, DailyStat, GarminLink, Group, Member, Profile, StatsInput, Workout } from '../domain/types'
import { randomToken, sha256 } from './shared'
import type { ProfileInput, Repo, WorkoutInput } from './repo'

// Plain-language messages for auth errors; anything unknown stays generic (details go to the console).
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong username or password.',
  user_already_exists: 'This username is already taken.',
  email_exists: 'This username is already taken.',
  weak_password: 'Password too weak. Use at least 6 characters.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  over_email_send_rate_limit: 'Sign-up is temporarily unavailable. Try again later.',
  signup_disabled: 'New accounts are closed right now.',
  email_provider_disabled: 'Sign-in is not set up on the server yet.',
  email_not_confirmed: 'Sign-in is not set up on the server yet.',
}
const authError = (e: AuthError) => {
  console.error('auth error', e.code, e.message)
  return new Error(AUTH_MESSAGES[e.code ?? ''] ?? 'Something went wrong. Try again.')
}

export function createSupabaseRepo(url: string, key: string): Repo {
  const sb = createClient(url, key)

  const check = <T>({ data, error }: { data: T; error: PostgrestError | null }): T => {
    if (error) throw new Error(error.message)
    return data
  }
  const uid = async () => {
    const { data } = await sb.auth.getSession()
    if (!data.session) throw new Error('Not signed in')
    return data.session.user.id
  }
  /** Calls the `garmin` edge function; its JSON `error` becomes the thrown message. */
  const garmin = async (body: Record<string, unknown>) => {
    const { error } = await sb.functions.invoke('garmin', { body })
    if (!error) return
    const detail = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null
    throw new Error(detail?.error ?? 'Could not reach the server. Try again.')
  }

  return {
    kind: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession()
      const u = data.session?.user
      return u ? { id: u.id, email: u.email ?? '' } : null
    },

    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { timezone: browserTimezone() } },
      })
      if (error) throw authError(error)
      if (!data.session) throw new Error(AUTH_MESSAGES.email_provider_disabled)
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw authError(error)
    },

    async signOut() {
      await sb.auth.signOut()
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cb()
      })
      return () => data.subscription.unsubscribe()
    },

    async getProfile(userId) {
      return check(await sb.from('profiles').select('*').eq('id', userId).maybeSingle()) as Profile | null
    },

    async saveProfile(input: ProfileInput) {
      return check(await sb.from('profiles').update(input).eq('id', await uid()).select().single()) as Profile
    },

    async uploadProfileImage(kind, jpeg) {
      const path = `${await uid()}/${kind}.jpg`
      const bucket = sb.storage.from('profile-images')
      const { error } = await bucket.upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw new Error(error.message)
      // Same path on every upload: the version param busts browser and CDN caches.
      return `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    },

    async listGroups() {
      return check(await sb.from('groups').select('*').order('created_at')) as Group[]
    },

    async createGroup(name) {
      return check(await sb.rpc('create_group', { p_name: name.trim() }).single()) as Group
    },

    async joinGroup(code) {
      return check(await sb.rpc('join_group', { p_code: code.trim().toUpperCase() }).single()) as Group
    },

    async leaveGroup(groupId) {
      check(await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', await uid()))
    },

    async listMembers(groupId) {
      return check(await sb.from('group_members').select('*, profile:profiles(*)').eq('group_id', groupId)) as Member[]
    },

    async listStats(userIds, from, to) {
      return check(
        await sb.from('daily_stats').select('*').in('user_id', userIds).gte('date', from).lte('date', to),
      ) as DailyStat[]
    },

    async saveStats(input: StatsInput) {
      // Partial upsert: only the columns present in `row` are written on conflict.
      const row: Record<string, unknown> = { user_id: await uid(), date: input.date }
      if (input.steps !== undefined) {
        row.steps = input.steps
        row.steps_source = input.steps == null ? null : input.source
      }
      if (input.flights !== undefined) {
        row.flights = input.flights
        row.flights_source = input.flights == null ? null : input.source
      }
      if (input.sleep_start !== undefined || input.sleep_end !== undefined || input.sleep_minutes !== undefined) {
        if (input.sleep_start !== undefined) row.sleep_start = input.sleep_start
        if (input.sleep_end !== undefined) row.sleep_end = input.sleep_end
        if (input.sleep_minutes !== undefined) row.sleep_minutes = input.sleep_minutes
        row.sleep_source = input.sleep_start === null ? null : input.source
      }
      check(await sb.from('daily_stats').upsert(row, { onConflict: 'user_id,date' }))
    },

    async listWorkouts(userIds, from, to) {
      return check(
        await sb.from('workouts').select('*').in('user_id', userIds).gte('date', from).lte('date', to),
      ) as Workout[]
    },

    async addWorkout(input: WorkoutInput) {
      check(await sb.from('workouts').insert(input))
    },

    async deleteWorkout(id) {
      check(await sb.from('workouts').delete().eq('id', id))
    },

    async listTokens() {
      return check(
        await sb.from('api_tokens').select('id, label, created_at, last_used_at').order('created_at', { ascending: false }),
      ) as ApiToken[]
    },

    async createToken(label) {
      const token = randomToken()
      check(await sb.from('api_tokens').insert({ label: label.trim() || 'Token', token_hash: await sha256(token) }))
      return token
    },

    async revokeToken(id) {
      check(await sb.from('api_tokens').delete().eq('id', id))
    },

    async getGarmin() {
      return check(
        await sb.from('garmin_links').select('key_hint, connected_at, last_sync_at, last_error').maybeSingle(),
      ) as GarminLink | null
    },

    async connectGarmin(apiKey) {
      await garmin({ action: 'connect', api_key: apiKey })
    },

    async syncGarmin() {
      await garmin({ action: 'sync' })
    },

    async disconnectGarmin() {
      await garmin({ action: 'disconnect' })
    },

    subscribe(cb) {
      const channel = sb.channel(`changes-${crypto.randomUUID()}`)
      for (const table of ['daily_stats', 'workouts', 'group_members', 'profiles'])
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, cb)
      channel.subscribe()
      // Realtime misses writes while the app is in the background (e.g. the iOS Shortcut ran): reload on return.
      const onVisible = () => document.visibilityState === 'visible' && cb()
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        document.removeEventListener('visibilitychange', onVisible)
        void sb.removeChannel(channel)
      }
    },

    // Chat tables are read directly (RLS) and written only through the chat_* RPCs.
    async listChats() {
      return check(await sb.rpc('chat_list')) as ChatSummary[]
    },

    async listMessages(conversationId, limit) {
      const rows = check(
        await sb.from('chat_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(limit),
      ) as ChatMessage[]
      return rows.reverse()
    },

    async openDirect(userId) {
      return check(await sb.rpc('chat_open_direct', { p_user: userId })) as string
    },

    async sendMessage(conversationId, body, mentions, replyTo) {
      check(await sb.rpc('chat_send', { p_conversation: conversationId, p_body: body, p_mentions: mentions, p_reply_to: replyTo }))
    },

    async editMessage(messageId, body, mentions) {
      check(await sb.rpc('chat_edit', { p_message: messageId, p_body: body, p_mentions: mentions }))
    },

    async deleteMessage(messageId) {
      check(await sb.rpc('chat_delete', { p_message: messageId }))
    },

    async react(messageId, emoji) {
      check(await sb.rpc('chat_react', { p_message: messageId, p_emoji: emoji }))
    },

    async markRead(conversationId, until) {
      check(await sb.rpc('chat_mark_read', { p_conversation: conversationId, p_until: until }))
    },

    // RLS applies to realtime too: each client only gets rows of its own chats.
    subscribeChat(cb) {
      const channel = sb
        .channel(`chat-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) =>
          cb({ type: 'message', message: p.new as ChatMessage, inserted: true }),
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (p) =>
          cb({ type: 'message', message: p.new as ChatMessage, inserted: false }),
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, () => cb({ type: 'refresh' }))
      channel.subscribe()
      return () => void sb.removeChannel(channel)
    },
  }
}
