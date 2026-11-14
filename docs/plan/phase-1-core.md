# Phase 1 — Core

Goal: two friends can already challenge each other with manual data.

- [x] Domain types + `Repo` interface (`src/data/repo.ts`)
- [x] `localRepo`: auth (email + password, hashed), profiles, groups, invite codes, daily stats upsert,
      change events (live updates across tabs), demo group with seeded friends
- [x] Auth screen: sign in / sign up, polished hero
- [x] Onboarding: username, avatar color, timezone (auto-detected), create or join group
- [x] App shell: bottom tab bar (Today, Ranking, +, Stats, Profile), safe areas
- [x] Today screen: steps ring, last night's sleep, quick add
- [x] Manual entry sheet: date, steps, fell asleep / woke up (sleep minutes derived from the two times)
- [x] Steps leaderboard of the group (today / week / month)
- [x] Group screen: members, invite code copy/share, join/create, switch group
- [x] Supabase: first migration (profiles, groups, group_members, daily_stats, RLS, triggers, join RPC)
- [x] `supabaseRepo` implementing the same interface (typechecked; not yet run against a live project)
