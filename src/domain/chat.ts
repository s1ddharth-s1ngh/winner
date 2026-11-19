// Chat message text. A mention is stored in the body as @[name](u:<uuid>) and drawn as a pill.
// While typing, the composer shows plain "@name"; tags are added only when sending.

// Ids are uuids on the server; demo friends have ids like "demo-giulia".
const TAG = /@\[([^\]\n]{1,40})\]\(u:([\w-]{1,64})\)/g

export type TextPart = string | { name: string; id: string }

/** Body split into plain text and mentions, in order. */
export function splitMentions(body: string): TextPart[] {
  const parts: TextPart[] = []
  let at = 0
  for (const m of body.matchAll(TAG)) {
    if (m.index > at) parts.push(body.slice(at, m.index))
    parts.push({ name: m[1], id: m[2] })
    at = m.index + m[0].length
  }
  if (at < body.length) parts.push(body.slice(at))
  return parts
}

/** Body with tags turned back into "@name" (previews, notifications, editing). */
export const plainText = (body: string) => body.replace(TAG, '@$1')

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Turns "@name" for each picked person into a tag. Returns the body and the ids actually mentioned.
 * Longer names go first, and a name must end at a non-letter, so "@Ann" never eats "@Anna".
 */
export function toTagged(text: string, picked: Map<string, string>): { body: string; mentions: string[] } {
  let body = text.trim()
  const mentions: string[] = []
  for (const [name, id] of [...picked].sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`@${escape(name)}(?![\\p{L}\\p{N}_])`, 'gu')
    if (!re.test(body)) continue
    body = body.replace(re, `@[${name.replace(/[[\]()\n]/g, '')}](u:${id})`)
    mentions.push(id)
  }
  return { body, mentions }
}

/** The reverse of toTagged, to edit a sent message. */
export function fromTagged(body: string): { text: string; picked: Map<string, string> } {
  const picked = new Map<string, string>()
  for (const m of body.matchAll(TAG)) picked.set(m[1], m[2])
  return { text: plainText(body), picked }
}
