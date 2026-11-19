// Product identity. Rename the app here (and in vite.config.ts manifest + index.html title).
export const APP = {
  name: 'Winner for Life',
  shortName: 'WinLife',
  tagline: 'Walk more. Sleep earlier. Beat your friends.',
} as const

/** Avatar background colors users can pick from. Keep it short: the picker is a single row on phones. */
/** Default app accent (pink), shown when the user has no cover color. Matches --brand in src/index.css. */
export const DEFAULT_ACCENT = '#e01d61'

export const AVATAR_COLORS = ['#4f46e5', '#db2777', '#f2700f', '#0fa36b', '#0284c7', '#475569'] as const
