// Helpers shared by both backends.
import type { DailyStat, StatsInput } from '../domain/types'

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const hex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Personal API token for the iOS Shortcut. 32 random bytes. */
export const randomToken = () => `wfl_${hex(32)}`

// No 0/O/1/I so codes are easy to read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const inviteCode = () =>
  [...crypto.getRandomValues(new Uint8Array(6))].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

/** Merge a partial write into an existing row: only provided fields change. */
export function applyStatsInput(prev: DailyStat | null, userId: string, input: StatsInput): DailyStat {
  const next: DailyStat = prev
    ? { ...prev }
    : {
        user_id: userId,
        date: input.date,
        steps: null,
        steps_source: null,
        sleep_start: null,
        sleep_end: null,
        sleep_minutes: null,
        sleep_source: null,
        updated_at: '',
      }
  if (input.steps !== undefined) {
    next.steps = input.steps
    next.steps_source = input.steps == null ? null : input.source
  }
  if (input.sleep_start !== undefined || input.sleep_end !== undefined || input.sleep_minutes !== undefined) {
    if (input.sleep_start !== undefined) next.sleep_start = input.sleep_start
    if (input.sleep_end !== undefined) next.sleep_end = input.sleep_end
    if (input.sleep_minutes !== undefined) next.sleep_minutes = input.sleep_minutes
    next.sleep_source = next.sleep_start ? input.source : null
  }
  next.updated_at = new Date().toISOString()
  return next
}
