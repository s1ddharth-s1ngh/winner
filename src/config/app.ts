// Product identity. Rename the app here (and in vite.config.ts manifest + index.html title).
export const APP = {
  name: 'Winner for Life',
  shortName: 'WinLife',
  tagline: 'Walk more. Sleep earlier. Beat your friends.',
} as const

/** Avatar background colors users can pick from. */
export const AVATAR_COLORS = [
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#e5484d',
  '#f2700f',
  '#d97706',
  '#0fa36b',
  '#0d9488',
  '#0284c7',
  '#475569',
] as const
