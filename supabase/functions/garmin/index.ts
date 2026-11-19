// POST /functions/v1/garmin — Garmin Connect Personal API sync.
//
// From the app (Authorization: Bearer <Supabase user JWT>), body { action }:
//   "connect"    { api_key }  checks the key with Garmin, stores it encrypted, imports today
//   "sync"                    imports the last 7 days
//   "disconnect"              deletes the stored key
// From pg_cron (header x-cron-secret: Vault secret "garmin_cron_secret"): imports the last 3 days for every linked user.
//
// Secret: GARMIN_ENC_KEY (random string, 32+ chars). The plain API key never leaves this function.
// Days before the connection day are never imported. Manual entries are never overwritten (as in ingest-health).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { dateIn } from '../ingest-health/validate.ts'
import { decrypt, encrypt } from './crypto.ts'
import { mapActivities, mapDailies, mapSleep } from './map.ts'

// shortcut: global server only (not personal.connectapi.garmin.cn), add a region setting if a friend is in China.
const GARMIN = 'https://personal.connectapi.garmin.com'
const DAY = 86_400_000
const DAYS = { connect: 7, sync: 7, cron: 3 } as const

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

class GarminError extends Error {}

async function garmin(path: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(GARMIN + path, { ...init, signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new GarminError('Garmin did not respond. Try again later.')
  }
  if (res.status === 401 || res.status === 403) throw new GarminError('Garmin refused the key. It may be expired or deleted: add a new one.')
  if (res.status === 429) throw new GarminError('Garmin is limiting requests. Try again later.')
  if (!res.ok) throw new GarminError(`Garmin error ${res.status}. Try again later.`)
  return res
}

/** Exchanges the API key for a 24 h bearer token (the endpoint answers with the bare JWT). */
async function garminToken(apiKey: string): Promise<string> {
  const res = await garmin('/personalapitoken-service/personal-api/personal-api-key/token', {
    method: 'POST',
    headers: { accept: '*/*', authorization: `ApiKey ${apiKey}` },
  })
  const token = (await res.text()).trim()
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw new GarminError('Garmin sent an unexpected answer. Try again later.')
  return token
}

// shortcut: a new token on every sync (token valid 24 h), cache it encrypted if Garmin starts rate limiting.
async function importDays(sb: SupabaseClient, userId: string, apiKey: string, days: number, connectedAt: string) {
  const { data: profile } = await sb.from('profiles').select('timezone').eq('id', userId).single()
  const tz = profile?.timezone ?? 'Europe/Rome'
  const now = new Date()
  const to = dateIn(now, tz)
  // Never import days before the day Garmin was connected: history stays out of the app.
  const windowStart = dateIn(new Date(now.getTime() - (days - 1) * DAY), tz)
  const connectedDay = dateIn(new Date(connectedAt), tz)
  const from = windowStart > connectedDay ? windowStart : connectedDay

  const token = await garminToken(apiKey)
  const get = async (path: string) =>
    (await garmin(path, { headers: { accept: 'application/json', authorization: `Bearer ${token}` } })).json()
  const range = `startDate=${from}&endDate=${to}`
  // shortcut: first 100 activities of the range only, paginate with `start` if someone logs more.
  const [dailies, sleeps, activities] = await Promise.all([
    get(`/usersummary-service/v2/dailysummaries?${range}`),
    get(`/sleep-service/sleep/dailySleepSummariesByDate?${range}`),
    get(`/activitylist-service/activities/search/activities?${range}&limit=100`),
  ])
  // The wake-up date of a night can differ from Garmin's calendarDate, so filter after mapping too.
  const inRange = (r: { date: string }) => r.date >= from && r.date <= to
  const dayRows = mapDailies(dailies).filter(inRange)
  const sleepRows = mapSleep(sleeps, tz).filter(inRange)
  const workoutRows = mapActivities(activities).filter(inRange)

  const dates = [...new Set([...dayRows.map((d) => d.date), ...sleepRows.map((s) => s.date)])]
  const { data: existing, error: readError } = await sb
    .from('daily_stats')
    .select('date, steps_source, flights_source, sleep_source')
    .eq('user_id', userId)
    .in('date', dates)
  if (readError) throw new Error('Could not read existing data.')
  const manual = (date: string, field: 'steps_source' | 'flights_source' | 'sleep_source') =>
    existing?.find((r) => r.date === date)?.[field] === 'manual'

  // One upsert per date: PostgREST bulk upserts need identical columns on every row.
  for (const date of dates) {
    const row: Record<string, unknown> = { user_id: userId, date }
    const day = dayRows.find((d) => d.date === date)
    const sleep = sleepRows.find((s) => s.date === date)
    if (day?.steps !== undefined && !manual(date, 'steps_source')) Object.assign(row, { steps: day.steps, steps_source: 'garmin' })
    if (day?.flights !== undefined && !manual(date, 'flights_source')) Object.assign(row, { flights: day.flights, flights_source: 'garmin' })
    if (sleep && !manual(date, 'sleep_source'))
      Object.assign(row, { sleep_start: sleep.start, sleep_end: sleep.end, sleep_minutes: sleep.minutes, sleep_source: 'garmin' })
    if (Object.keys(row).length === 2) continue
    const { error } = await sb.from('daily_stats').upsert(row, { onConflict: 'user_id,date' })
    if (error) throw new Error('Could not save data.')
  }

  if (workoutRows.length) {
    const rows = workoutRows.map((w) => ({ ...w, user_id: userId }))
    const { error } = await sb.from('workouts').upsert(rows, { onConflict: 'user_id,external_id' })
    if (error) throw new Error('Could not save workouts.')
  }
  return { days: dayRows.length, nights: sleepRows.length, workouts: workoutRows.length }
}

/** Runs one import and records the outcome on the link row (shown in Settings). */
async function syncUser(sb: SupabaseClient, encKey: string, userId: string, days: number) {
  const { data: secret } = await sb.from('garmin_secrets').select('key_ciphertext').eq('user_id', userId).maybeSingle()
  const { data: link } = await sb.from('garmin_links').select('connected_at').eq('user_id', userId).maybeSingle()
  if (!secret || !link) throw new GarminError('Garmin is not connected.')
  try {
    const result = await importDays(sb, userId, await decrypt(secret.key_ciphertext, userId, encKey), days, link.connected_at)
    await sb.from('garmin_links').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('user_id', userId)
    return result
  } catch (e) {
    const message = e instanceof GarminError ? e.message : 'Sync failed. Try again later.'
    if (!(e instanceof GarminError)) console.error('garmin sync', userId, e)
    await sb.from('garmin_links').update({ last_error: message }).eq('user_id', userId)
    throw new GarminError(message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const encKey = Deno.env.get('GARMIN_ENC_KEY') ?? ''
  if (!encKey) return json(500, { error: 'Garmin sync is not set up on the server.' })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // Scheduled run: every linked user, one after the other; one failure does not stop the others.
  const sentCron = req.headers.get('x-cron-secret')
  if (sentCron !== null) {
    const { data: cronSecret } = await sb.rpc('garmin_cron_secret')
    if (typeof cronSecret !== 'string' || cronSecret.length < 16 || sentCron !== cronSecret) return json(401, { error: 'Bad cron secret.' })
    const { data: links } = await sb.from('garmin_links').select('user_id')
    let ok = 0
    for (const { user_id } of links ?? []) {
      try {
        await syncUser(sb, encKey, user_id, DAYS.cron)
        ok++
      } catch {
        // Error already stored on the link row.
      }
    }
    return json(200, { ok: true, users: links?.length ?? 0, synced: ok })
  }

  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  const { data: auth } = await sb.auth.getUser(jwt)
  const userId = auth.user?.id
  if (!userId) return json(401, { error: 'Sign in again.' })

  const raw = await req.text()
  if (raw.length > 2_000) return json(413, { error: 'Body too large.' })
  let body: { action?: unknown; api_key?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'Body must be JSON.' })
  }

  try {
    if (body.action === 'disconnect') {
      await sb.from('garmin_links').delete().eq('user_id', userId)
      return json(200, { ok: true })
    }

    if (body.action === 'connect') {
      const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''
      if (!/^[\x21-\x7e]{8,512}$/.test(apiKey)) return json(422, { error: 'That does not look like a Garmin API key.' })
      await garminToken(apiKey) // Proves the key works before we store it.
      const link = { user_id: userId, key_hint: apiKey.slice(-4), connected_at: new Date().toISOString(), last_sync_at: null, last_error: null }
      const { error: linkError } = await sb.from('garmin_links').upsert(link)
      const { error: secretError } = await sb
        .from('garmin_secrets')
        .upsert({ user_id: userId, key_ciphertext: await encrypt(apiKey, userId, encKey) })
      if (linkError || secretError) return json(500, { error: 'Could not save the key.' })
      return json(200, { ok: true, synced: await syncUser(sb, encKey, userId, DAYS.connect) })
    }

    if (body.action === 'sync') {
      const { data: link } = await sb.from('garmin_links').select('last_sync_at').eq('user_id', userId).maybeSingle()
      if (!link) return json(404, { error: 'Garmin is not connected.' })
      if (link.last_sync_at && Date.now() - new Date(link.last_sync_at).getTime() < 60_000) return json(200, { ok: true, synced: null })
      return json(200, { ok: true, synced: await syncUser(sb, encKey, userId, DAYS.sync) })
    }

    return json(400, { error: 'Unknown action.' })
  } catch (e) {
    if (e instanceof GarminError) return json(502, { error: e.message })
    console.error('garmin', e)
    return json(500, { error: 'Something went wrong. Try again later.' })
  }
})
