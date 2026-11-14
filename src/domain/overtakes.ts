/** Rank snapshot: userId → rank (null = unranked, counts as last). */
export type RankSnapshot = Record<string, number | null>

const pos = (r: number | null | undefined) => r ?? Number.POSITIVE_INFINITY

/** Users who were not above `me` in `prev` and are strictly above `me` in `next`. */
export function findOvertakes(prev: RankSnapshot, next: RankSnapshot, me: string): string[] {
  if (!(me in prev) || !(me in next)) return []
  return Object.keys(next).filter(
    (u) => u !== me && u in prev && pos(prev[u]) >= pos(prev[me]) && pos(next[u]) < pos(next[me]),
  )
}
