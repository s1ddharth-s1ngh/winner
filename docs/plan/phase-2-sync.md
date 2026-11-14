# Phase 2 — Automatic sync

- [ ] Migration: `api_tokens` (sha-256 hash only) + RLS
- [ ] Settings → Data sources: create / revoke personal tokens (token shown once)
- [ ] Edge function `supabase/functions/ingest-health`:
      bearer token → hash lookup → validate (steps 0–100k, sleep ≤ 16 h, date not in the future)
      → idempotent upsert on (user_id, date); updates `last_used_at`
- [ ] Italian step-by-step guide for the iOS Shortcut + automation: `docs/guides/ios-shortcut.md`
- [ ] Capacitor Android: `capacitor.config.ts`, `@capgo/capacitor-health`, `src/native/health.ts`
      - steps via **aggregate** query (no phone + watch double counting)
      - last sleep session → bedtime / wake time
      - sync on app open and on resume
- [ ] Build instructions for the APK: `docs/guides/android-apk.md`

Manual entry stays available for everybody.
