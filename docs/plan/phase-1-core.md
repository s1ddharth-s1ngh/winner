# Phase 1 — Core

Goal: two friends can already challenge each other with manual data.

- [ ] Domain types + `Repo` interface (`src/data/repo.ts`)
- [ ] `localRepo`: auth (email + password, hashed), profiles, groups, invite codes, daily stats upsert,
      change events (live updates across tabs), demo group with seeded friends
- [ ] Auth screen: sign in / sign up, polished hero
- [ ] Onboarding: username, avatar color, timezone (auto-detected), create or join group
- [ ] App shell: bottom tab bar (Today, Ranking, +, Stats, Profile), safe areas
- [ ] Today screen: steps ring, last night's sleep, quick add
- [ ] Manual entry sheet: date, steps, fell asleep / woke up (sleep minutes derived, editable)
- [ ] Steps leaderboard of the group (today / week / month)
- [ ] Group screen: members, invite code copy/share, join/create, switch group
- [ ] Supabase: first migration (profiles, groups, group_members, daily_stats, RLS, triggers, join RPC)
- [ ] `supabaseRepo` implementing the same interface
