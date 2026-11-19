# Plan overview

Execution order agreed on 2026-11-14: build the whole frontend first (light theme), backed by a
local demo backend, then add the Supabase layer (migrations, repo implementation, edge function)
so it can be switched on as soon as the Supabase project exists.

| File | Phase | Status |
|---|---|---|
| [phase-0-setup.md](phase-0-setup.md) | Setup | done |
| [phase-1-core.md](phase-1-core.md) | Login, profile, groups, manual entry, steps ranking | done (Supabase layer written, not yet run live) |
| [phase-2-sync.md](phase-2-sync.md) | `ingest-health`, iOS Shortcut, Capacitor + Health Connect | done; APK built and tested on emulator — real-phone + live Supabase checks are owner steps |
| [phase-3-game.md](phase-3-game.md) | Stars, rankings, streaks, badges | done |
| [phase-4-notifications.md](phase-4-notifications.md) | "X passed you" | in-app + phone notifications done; closed-app push needs Supabase |
| [phase-5-extras.md](phase-5-extras.md) | Workouts, stats and charts, polish | done (incl. dark theme) |
| [phase-6-chat.md](phase-6-chat.md) | Group chat + direct messages | done in demo + DB tests; migration not yet applied to Supabase |

## Key decisions

- **Name:** "Winner for Life" (home screen short name "WinLife"). Change in `src/config/app.ts`.
- **Login:** email + password. No magic link (opens in Safari, not in the installed PWA).
  Supabase built-in email only reaches team addresses (~2/hour), so start with "Confirm email" off.
- **Stars are computed, not stored.** They derive from raw data; changing `src/config/scoring.ts`
  re-scores all history automatically. Badges are computed too (earned date = first day the rule held).
- **No sleep data:** the night scores 0★ but is shown as "no data" everywhere, with a one-tap
  manual entry. No normalisation, so skipping sleep tracking never pays off.
- **`steps_source` / `sleep_source`** instead of one `source` column: steps can come from Health
  Connect while sleep is entered by hand.
- **Data layer:** one `Repo` interface; `localRepo` (localStorage, demo friends) now, `supabaseRepo`
  when env vars exist. Screens never import Supabase directly.
- **Theme:** light and dark ("midnight navy", inspired by Telebi's NexSuite: pill controls,
  glass surfaces). Colors are CSS variables in `src/index.css`, switched by `data-theme` on
  `<html>`. Preference (System / Light / Dark) lives in Settings → Appearance, stored in
  localStorage `wfl:theme`; `src/app/theme.ts` also sets the Android status bar icon style.
- **Hosting (later):** Cloudflare Pages (free, commercial use allowed).
