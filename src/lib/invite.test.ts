import { describe, expect, it } from 'vitest'
import { parseInviteCode } from './invite'

describe('parseInviteCode', () => {
  it('reads a valid code', () => expect(parseInviteCode('?join=ABC123')).toBe('ABC123'))
  it('uppercases and trims', () => expect(parseInviteCode('?join=%20abc123%20')).toBe('ABC123'))
  it('rejects junk', () => {
    expect(parseInviteCode('?join=ABC')).toBeNull()
    expect(parseInviteCode('?join=ABC1234')).toBeNull()
    expect(parseInviteCode('?join=AB%3Cs%3E1')).toBeNull()
  })
  it('returns null when missing', () => expect(parseInviteCode('?foo=1')).toBeNull())
})
