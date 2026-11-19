import type { ISODate } from '../lib/dates'

export type Source = 'health_connect' | 'ios_shortcut' | 'garmin' | 'manual'

export interface Profile {
  id: string
  username: string
  avatar_color: string
  avatar_url: string | null
  /** Null = default hero color. */
  cover_color: string | null
  cover_url: string | null
  timezone: string
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface Member {
  group_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  profile: Profile
}

/** One row per user per day. The sleep night belongs to the wake-up date. */
export interface DailyStat {
  user_id: string
  date: ISODate
  steps: number | null
  steps_source: Source | null
  flights: number | null
  flights_source: Source | null
  sleep_start: string | null
  sleep_end: string | null
  sleep_minutes: number | null
  sleep_source: Source | null
  updated_at: string
}

/** Partial write: only the provided fields change (idempotent upsert on user + date). */
export interface StatsInput {
  date: ISODate
  steps?: number | null
  flights?: number | null
  sleep_start?: string | null
  sleep_end?: string | null
  sleep_minutes?: number | null
  source: Source
}

export interface Workout {
  id: string
  user_id: string
  date: ISODate
  type: string
  duration_min: number
  note: string | null
  created_at: string
}

export interface ApiToken {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
}

/** Garmin Connect link status. The API key itself stays encrypted on the server. */
export interface GarminLink {
  key_hint: string
  connected_at: string
  last_sync_at: string | null
  last_error: string | null
}
