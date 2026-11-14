# Phase 3 — Game

- [x] `src/config/scoring.ts`: step tiers, bedtime tiers, duration bonus, workout bonus, streak rules
- [x] `src/domain/scoring.ts`: stars per day (steps / sleep / workout), "no data" states — unit tested
- [x] Streaks in `src/domain/scoring.ts`: current + longest streaks (today in progress does not break a streak)
- [x] `src/config/badges.ts` (rules computed from history): 10K Club, Early Bird, Week Warrior, Night Owl, more
- [x] Leaderboard: Steps / Sleep / Overall × Today / Week / Month, star totals, "no data" chips
- [x] Profile: badges grid (earned + locked with progress hint), streak cards
- [x] "How scoring works" sheet generated from the config (always in sync with the numbers)
