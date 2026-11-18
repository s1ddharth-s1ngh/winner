const nf = new Intl.NumberFormat('en-US')

export const formatNumber = (n: number) => nf.format(Math.round(n))

/** 9488 → "9.5k", 12000 → "12k", 950 → "950" */
export function compact(n: number): string {
  if (n < 1000) return String(Math.round(n))
  const k = n / 1000
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`
}

/** 475 → "7h 55m" */
export function duration(minutes: number): string {
  const m = Math.round(minutes)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}m`
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

export const greeting = (hour: number) => (hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening')
