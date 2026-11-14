# Phase 2 — Automatic sync

- [x] Migration: `api_tokens` (sha-256 hash only) + RLS
- [x] Settings → Data sources: create / revoke personal tokens (token shown once)
- [x] Edge function `supabase/functions/ingest-health`:
      bearer token → hash lookup → validate (steps 0–100k, sleep ≤ 16 h, date not in the future)
      → idempotent upsert on (user_id, date); updates `last_used_at`
- [x] Italian step-by-step guide for the iOS Shortcut + automation: `docs/guides/ios-shortcut.md`
- [x] Capacitor Android: `capacitor.config.ts`, `@capgo/capacitor-health`, `src/native/health.ts`
      - steps via **aggregate** query (no phone + watch double counting)
      - last sleep session → bedtime / wake time
      - sync on app open and on resume
- [x] Build instructions for the APK: `docs/guides/android-apk.md`
- [x] Android project (`android/`), minSdk 26, launcher icons + splash, privacy policy page for Health Connect
- [ ] Verify `./gradlew assembleDebug` and test on a real phone (first build attempt was stopped: PC low on memory)
- [ ] Deploy + test `ingest-health` against the live Supabase project (needs the project)

Manual entry stays available for everybody.
