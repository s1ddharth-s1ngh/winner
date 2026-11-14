import { describe, expect, it } from 'vitest'
import { validate } from './validate'

const TZ = 'Europe/Rome'
const now = new Date('2026-11-14T10:00:00Z') // 11:00 in Rome

describe('ingest-health validate', () => {
  it('accepts steps for today and numeric strings', () => {
    expect(validate({ steps: '9488.0' }, TZ, now)).toEqual({ ok: true, steps: { date: '2026-11-14', steps: 9488 } })
  })
  it('assigns the night to the wake-up date in the user timezone', () => {
    const r = validate({ sleep_start: '2026-11-13T23:10:00+01:00', sleep_end: '2026-11-14T07:05:00+01:00' }, TZ, now)
    expect(r).toMatchObject({ ok: true, sleep: { date: '2026-11-14', minutes: 475 } })
  })
  it('uses sleep_minutes when given, but never more than the span', () => {
    expect(validate({ sleep_start: '2026-11-13T22:00:00Z', sleep_end: '2026-11-14T06:00:00Z', sleep_minutes: 450 }, TZ, now)).toMatchObject({ ok: true, sleep: { minutes: 450 } })
    expect(validate({ sleep_start: '2026-11-13T22:00:00Z', sleep_end: '2026-11-14T06:00:00Z', sleep_minutes: 600 }, TZ, now).ok).toBe(false)
  })
  it.each([
    [{ steps: -1 }, 'negative steps'],
    [{ steps: 250000 }, 'absurd steps'],
    [{ steps: 'lots' }, 'non numeric'],
    [{ steps: 100, date: '2026-11-15' }, 'future date'],
    [{ steps: 100, date: '2026-10-01' }, 'too old'],
    [{ sleep_start: '2026-11-14T07:00:00Z' }, 'missing sleep_end'],
    [{ sleep_start: '2026-11-14T07:00:00Z', sleep_end: '2026-11-14T06:00:00Z' }, 'end before start'],
    [{ sleep_start: '2026-11-13T00:00:00Z', sleep_end: '2026-11-14T08:00:00Z' }, 'over 16 hours'],
    [{ sleep_start: '2026-11-14T09:00:00Z', sleep_end: '2026-11-14T12:00:00Z' }, 'ends in the future'],
    [{}, 'empty'],
    [[], 'array'],
  ])('rejects %j (%s)', (body) => {
    expect(validate(body, TZ, now).ok).toBe(false)
  })
})
