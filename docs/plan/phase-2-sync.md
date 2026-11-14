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
- [ ] Install on the owner's phone and connect Health Connect (no device was connected during the build)
- [ ] Deploy + test `ingest-health` against the live Supabase project (owner creates the project later)

Manual entry stays available for everybody.
