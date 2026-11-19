import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useSyncExternalStore } from 'react'
import { isAndroidApp } from '../native/health'

export type ThemePref = 'system' | 'light' | 'dark'

// Same key and logic as the inline script in index.html, which applies the theme before first paint.
const KEY = 'wfl:theme'
const BG = { light: '#f7f7f8', dark: '#000000' } as const
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

// Light is the default; 'system' is only used when picked explicitly.
function read(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'system' || v === 'dark' ? v : 'light'
}

export const resolveTheme = (pref: ThemePref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref)

function apply() {
  const theme = resolveTheme(read())
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[theme])
  // Dark style = light icons on a dark bar.
  if (isAndroidApp()) void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  listeners.forEach((l) => l())
}

export function initTheme() {
  apply()
  media.addEventListener('change', apply)
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'light') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  apply()
}

const ACCENT_KEY = 'wfl:accent'

/** The user's cover color doubles as the app accent (brand, steps, headers); null = default pink. */
export function setAccent(color: string | null) {
  const root = document.documentElement
  if (color) {
    root.dataset.accent = ''
    root.style.setProperty('--accent', color)
    localStorage.setItem(ACCENT_KEY, color)
  } else {
    delete root.dataset.accent
    root.style.removeProperty('--accent')
    localStorage.removeItem(ACCENT_KEY)
  }
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))

/** Current preference and the theme actually shown. */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, read)
  return { pref, theme: resolveTheme(pref), setPref: setThemePref }
}
