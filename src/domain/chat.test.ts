import { describe, expect, it } from 'vitest'
import { fromTagged, plainText, splitMentions, toTagged } from './chat'

const ANN = '00000000-0000-0000-0000-00000000000a'
const ANNA = '00000000-0000-0000-0000-00000000000b'

describe('chat mentions', () => {
  it('tags only picked names, longest first, on word boundaries', () => {
    const picked = new Map([
      ['Ann', ANN],
      ['Anna', ANNA],
    ])
    const { body, mentions } = toTagged(' hi @Anna and @Ann, not @Annabel ', picked)
    expect(body).toBe(`hi @[Anna](u:${ANNA}) and @[Ann](u:${ANN}), not @Annabel`)
    expect(mentions).toEqual([ANNA, ANN])
  })

  it('drops picked people whose name was deleted from the text', () => {
    expect(toTagged('hello', new Map([['Ann', ANN]]))).toEqual({ body: 'hello', mentions: [] })
  })

  it('splits a body into text and mentions', () => {
    expect(splitMentions(`@[Ann](u:${ANN}) ok @[Anna](u:${ANNA})`)).toEqual([
      { name: 'Ann', id: ANN },
      ' ok ',
      { name: 'Anna', id: ANNA },
    ])
    expect(splitMentions('no tags')).toEqual(['no tags'])
  })

  it('round-trips for editing', () => {
    const { body } = toTagged('hey @Ann', new Map([['Ann', ANN]]))
    const { text, picked } = fromTagged(body)
    expect(text).toBe('hey @Ann')
    expect(toTagged(text, picked).body).toBe(body)
    expect(plainText(body)).toBe('hey @Ann')
  })

  it('ignores malformed tags', () => {
    expect(splitMentions('@[x](u:not-a-uuid)')).toEqual(['@[x](u:not-a-uuid)'])
  })
})
