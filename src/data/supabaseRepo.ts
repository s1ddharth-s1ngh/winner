// Supabase backend. Active when VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.
// Schema + RLS: supabase/migrations. Group create/join go through security-definer RPCs.
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import { browserTimezone } from '../lib/dates'
import type { ApiToken, DailyStat, Group, Member, Profile, StatsInput, Workout } from '../domain/types'
import { randomToken, sha256 } from './shared'
import type { ProfileInput, Repo, WorkoutInput } from './repo'

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
      if (error) throw new Error(error.message)
      if (!data.session) throw new Error('Account created. Check your inbox to confirm your email, then sign in.')
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
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

    subscribe(cb) {
      const channel = sb.channel(`changes-${crypto.randomUUID()}`)
      for (const table of ['daily_stats', 'workouts', 'group_members', 'profiles'])
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, cb)
      channel.subscribe()
      return () => void sb.removeChannel(channel)
    },
  }
}
