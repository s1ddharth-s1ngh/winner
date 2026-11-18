// POST /functions/v1/ingest-health
// Called by the iOS Shortcut. Auth: "Authorization: Bearer wfl_<64 hex>" personal token (stored hashed).
// Body: { "steps": 9488, "flights"?: 12, "sleep_start": ISO8601, "sleep_end": ISO8601, "sleep_minutes"?: 455, "date"?: "YYYY-MM-DD" }
// Idempotent: re-sending the same data just rewrites the same row. Manual entries are never overwritten.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { validate } from './validate.ts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!/^wfl_[0-9a-f]{64}$/.test(token)) return json(401, { error: 'Missing or malformed token.' })

  const raw = await req.text()
  if (raw.length > 10_000) return json(413, { error: 'Body too large.' })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'Body must be JSON.' })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: tok } = await sb.from('api_tokens').select('id, user_id').eq('token_hash', await sha256(token)).maybeSingle()
  if (!tok) return json(401, { error: 'Invalid or revoked token.' })

  const { data: profile } = await sb.from('profiles').select('timezone').eq('id', tok.user_id).single()
  const v = validate(body, profile?.timezone ?? 'Europe/Rome', new Date())
  if (!v.ok) return json(422, { error: v.error })

  const dates = [...new Set([v.steps?.date, v.flights?.date, v.sleep?.date].filter((d): d is string => !!d))]
  const { data: existing, error: readError } = await sb
    .from('daily_stats')
    .select('date, steps_source, flights_source, sleep_source')
    .eq('user_id', tok.user_id)
    .in('date', dates)
  if (readError) return json(500, { error: 'Could not read existing data.' })
  const manual = (date: string, field: 'steps_source' | 'flights_source' | 'sleep_source') =>
    existing?.find((r) => r.date === date)?.[field] === 'manual'

  const saved: Record<string, unknown> = {}
  const skipped: string[] = []
  // One upsert per date: PostgREST bulk upserts need identical columns on every row.
  for (const date of dates) {
    const row: Record<string, unknown> = { user_id: tok.user_id, date }
    if (v.steps?.date === date) {
      if (manual(date, 'steps_source')) skipped.push('steps (entered by hand)')
      else {
        Object.assign(row, { steps: v.steps.steps, steps_source: 'ios_shortcut' })
        saved.steps = v.steps
      }
    }
    if (v.flights?.date === date) {
      if (manual(date, 'flights_source')) skipped.push('flights (entered by hand)')
      else {
        Object.assign(row, { flights: v.flights.flights, flights_source: 'ios_shortcut' })
        saved.flights = v.flights
      }
    }
    if (v.sleep?.date === date) {
      if (manual(date, 'sleep_source')) skipped.push('sleep (entered by hand)')
      else {
        Object.assign(row, { sleep_start: v.sleep.start, sleep_end: v.sleep.end, sleep_minutes: v.sleep.minutes, sleep_source: 'ios_shortcut' })
        saved.sleep = v.sleep
      }
    }
    if (Object.keys(row).length > 2) {
      const { error } = await sb.from('daily_stats').upsert(row, { onConflict: 'user_id,date' })
      if (error) return json(500, { error: 'Could not save data.' })
    }
  }

  await sb.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)
  return json(200, { ok: true, saved, skipped })
})
