# Winner for Life

Private steps + sleep challenge app for a small group of friends. Full brief: `docs/PROJECT_BRIEF.md`. Roadmap and status: `docs/plan/`.

## Working rules
- Talk to the owner in **Italian**, simple explanations. Everything in the app and code (UI text, names, comments, commits) in **English**.
- Zero cost: Supabase free tier, no Apple Developer account, no Play Store.
- Never commit secrets. `.env` is gitignored; document variables in `.env.example`.
- Local commits only unless the owner asks to push.

## Stack
- Vite + React + TypeScript + Tailwind v4, PWA via `vite-plugin-pwa`, font Manrope (`@fontsource-variable/manrope`).
- Data access goes through `src/data/repo.ts` (`Repo` interface). Two implementations:
  - `localRepo` — localStorage demo backend, used when `VITE_SUPABASE_URL` is not set.
  - `supabaseRepo` — used when Supabase env vars are present.
- All scoring numbers live in `src/config/scoring.ts`. Badges in `src/config/badges.ts`. Pure logic in `src/domain/` (unit tested).
- Stars and badges are **computed** from raw `daily_stats` + `workouts`, never stored.
- Dates: a sleep night belongs to the wake-up date; all dates in the user's timezone (`src/lib/dates.ts`).

## Commands
- `npm run dev` — dev server
- `npm test` — unit tests (vitest)
- `npm run build` — typecheck + production build
- `npm run lint` — eslint
