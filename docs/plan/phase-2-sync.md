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
- [x] `./gradlew assembleDebug` builds `app-debug.apk` (7 MB; minSdk 26, target 36; READ_STEPS + READ_SLEEP; web assets + privacy policy bundled).
      Low-memory build: `./gradlew assembleDebug --no-daemon --max-workers=2 -Dorg.gradle.jvmargs="-Xmx1g" -Pkotlin.compiler.execution.strategy=in-process`
- [x] Tested on the Android 17 emulator: install, sign-up, demo group, Health Connect permission sheet
      (shows app name + privacy policy), "Connected" state, sync runs the aggregate steps + sleep queries without errors.
      Fixed during the test: `favicon.ico` broke service-worker precache in the app; raw "+00:00" device timezone;
      content scrolling under the transparent status bar.

- [x] Garmin Connect Personal API (`supabase/functions/garmin`, guide `docs/guides/garmin.md`):
      Settings → Garmin Connect card; the API key is checked with Garmin, stored AES-GCM encrypted in
      `garmin_secrets` (no RLS policy, server only); imports steps, floors, sleep and activities (→ workouts,
      idempotent via `external_id`). pg_cron calls it every 3 hours. Unit + RLS + stubbed smoke test only.

## Next — needs the owner
- Garmin: set `GARMIN_ENC_KEY` + `CRON_SECRET`, deploy `garmin`, schedule the cron (see the guide),
  then connect a real key and check the values (response shapes come from the Garmin Swagger docs, not from real data).
- Install the APK on the real phone and check that Garmin steps/sleep appear after "Sync now"
  (the emulator has no health data, so the value mapping was only unit-checked, not seen with real data).
- Create the Supabase project, then deploy and test `ingest-health` from the iPhone Shortcut.

Manual entry stays available for everybody.
