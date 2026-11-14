# Phase 4 — "X passed you" notifications

Simplest approach that works for everyone:

- **In-app inbox** (bell icon): when the leaderboard is refreshed, compare the current ranking with
  the last one seen; if someone moved above you, record "X passed you" (steps today + overall).
  Max N per day (`NOTIFICATIONS.maxPerDay` in `src/config/scoring.ts`).
- **Push (needs Supabase):** Web Push (VAPID) for the PWA — works on iPhone only when installed on
  the Home Screen (iOS 16.4+) — and also inside the Android app's WebView is NOT supported, so Android
  users get push by installing the PWA too, or FCM later.

Tasks:
- [ ] `src/domain/overtakes.ts` + tests: diff two rankings → overtake events, daily cap
- [ ] Inbox screen + unread badge on the bell
- [ ] Settings toggles (steps / overall)
- [ ] Push backend design (documented here, implemented once Supabase exists):
  - table `push_subscriptions(user_id, endpoint, p256dh, auth)`
  - DB trigger on `daily_stats` → edge function `notify-overtakes` → `web-push` with VAPID keys
    stored as Supabase secrets
