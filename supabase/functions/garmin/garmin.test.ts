import { describe, expect, it } from 'vitest'
import { decrypt, encrypt } from './crypto'
import { mapActivities, mapDailies, mapSleep, toInstant, workoutType } from './map'

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))

describe('crypto', () => {
  it('round-trips and is bound to the user', async () => {
    const box = await encrypt('my-garmin-key', 'user-a', KEY)
    expect(box).not.toContain('my-garmin-key')
    expect(await decrypt(box, 'user-a', KEY)).toBe('my-garmin-key')
    await expect(decrypt(box, 'user-b', KEY)).rejects.toThrow()
  })
  it('rejects a short secret', async () => {
    await expect(encrypt('x', 'u', btoa('short'))).rejects.toThrow(/32 bytes/)
  })
})

describe('mapDailies', () => {
  it('reads steps and floors, keeps the highest per date, skips junk', () => {
    const body = {
      data: [
        { calendarDate: '2026-11-18', movement: { steps: { value: 9488 }, floorsAscended: { value: 12 } } },
        { calendarDate: '2026-11-18', movement: { steps: { value: 300 } } },
        { calendarDate: '2026-11-17', movement: { steps: { value: 250_000 } } },
        { calendarDate: 'bad', movement: { steps: { value: 1 } } },
        { calendarDate: '2026-11-16' },
      ],
    }
    expect(mapDailies(body)).toEqual([{ date: '2026-11-18', steps: 9488, flights: 12 }])
    expect(mapDailies(null)).toEqual([])
  })
})

describe('mapSleep', () => {
  it('uses the wake-up date in the user timezone and the measured sleep time', () => {
    const start = Date.parse('2026-11-17T22:30:00Z')
    const end = Date.parse('2026-11-18T06:30:00Z')
    expect(mapSleep([{ sleepStartTimestampGMT: start, sleepEndTimestampGMT: end, sleepTimeSeconds: 27_000 }], 'Europe/Rome')).toEqual([
      { date: '2026-11-18', start: '2026-11-17T22:30:00.000Z', end: '2026-11-18T06:30:00.000Z', minutes: 450 },
    ])
  })
  it('skips nights without times or with impossible values', () => {
    const t = Date.parse('2026-11-18T06:30:00Z')
    expect(mapSleep([{ sleepTimeSeconds: 100 }, { sleepStartTimestampGMT: t, sleepEndTimestampGMT: t - 1, sleepTimeSeconds: 60 }], 'UTC')).toEqual([])
    expect(mapSleep([{ sleepStartTimestampGMT: t - 3_600_000, sleepEndTimestampGMT: t, sleepTimeSeconds: 7_200 }], 'UTC')).toEqual([])
  })
  it('parses ms, numeric strings and ISO without offset as UTC', () => {
    expect(toInstant(0)?.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(toInstant('1763447400000')?.toISOString()).toBe('2025-11-18T06:30:00.000Z')
    expect(toInstant('2026-11-18T06:30:00.0')?.toISOString()).toBe('2026-11-18T06:30:00.000Z')
    expect(toInstant('nope')).toBeNull()
  })
})

describe('activities', () => {
  it('maps Garmin type keys to workout types', () => {
    expect(workoutType('trail_running')).toBe('Run')
    expect(workoutType('road_biking')).toBe('Cycling')
    expect(workoutType('indoor_cycling')).toBe('Cycling')
    expect(workoutType('hiking')).toBe('Walk')
    expect(workoutType('lap_swimming')).toBe('Swim')
    expect(workoutType('strength_training')).toBe('Gym')
    expect(workoutType('stair_climbing')).toBe('Gym')
    expect(workoutType('indoor_climbing')).toBe('Climbing')
    expect(workoutType('soccer')).toBe('Football')
    expect(workoutType('padel')).toBe('Padel')
    expect(workoutType('golf')).toBe('Other')
  })
  it('builds idempotent workout rows', () => {
    const body = [
      { activityId: 123, activityName: 'Morning Ride', startTimeLocal: '2026-11-18 07:05:00', duration: 3725.4, activityType: { typeKey: 'road_biking' } },
      { activityId: 124, startTimeLocal: '2026-11-18 09:00:00', duration: 20, activityType: { typeKey: 'walking' } },
      { activityId: 125, startTimeLocal: '2026-11-18 09:00:00', duration: 50_000, activityType: {} },
      { startTimeLocal: '2026-11-18 09:00:00', duration: 600 },
    ]
    expect(mapActivities(body)).toEqual([
      { external_id: 'garmin:123', date: '2026-11-18', type: 'Cycling', duration_min: 62, note: 'Morning Ride' },
      { external_id: 'garmin:125', date: '2026-11-18', type: 'Other', duration_min: 600, note: null },
    ])
  })
})
