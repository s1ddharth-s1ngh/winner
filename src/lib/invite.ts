// Invite links: <app url>?join=ABC123. The code is kept in localStorage until it is used,
// so it survives sign-up and reloads.

const KEY = 'wfl:pendingJoin'

/** Returns the invite code from a URL query string, or null if missing/invalid. */
export function parseInviteCode(search: string): string | null {
  const code = new URLSearchParams(search).get('join')?.trim().toUpperCase()
  return code && /^[A-Z0-9]{6}$/.test(code) ? code : null
}

/** Public link for a group. VITE_PUBLIC_URL is needed in the Android app, where the origin is localhost. */
export function inviteUrl(code: string): string {
  const base = import.meta.env.VITE_PUBLIC_URL || new URL(import.meta.env.BASE_URL, location.origin).href
  const url = new URL(base)
  url.searchParams.set('join', code)
  return url.href
}

/** Call once on boot: stores ?join= and removes it from the address bar. */
export function capturePendingJoin() {
  const url = new URL(location.href)
  if (!url.searchParams.has('join')) return
  const code = parseInviteCode(url.search)
  if (code) localStorage.setItem(KEY, code)
  url.searchParams.delete('join')
  history.replaceState(history.state, '', url.href)
}

export const pendingJoin = () => localStorage.getItem(KEY)
export const clearPendingJoin = () => localStorage.removeItem(KEY)
