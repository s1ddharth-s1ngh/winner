# Phase 4 — "X passed you" notifications

Simplest approach that works for everyone:

- **In-app inbox** (bell icon): when the leaderboard is refreshed, compare the current ranking with
  the last one seen; if someone moved above you, record "X passed you" (steps today + overall).
  Max N per day (`NOTIFICATIONS.maxPerDay` in `src/config/scoring.ts`).
- **Phone notifications while the app is open/backgrounded:** done via the service worker
  (`showNotification`), opt-in from Settings.
- **Push when the app is closed (needs Supabase):** Web Push (VAPID) for the PWA. On iPhone it works only
  when the PWA is on the Home Screen (iOS 16.4+). Web Push does NOT work inside the Android app's WebView,
  so Android users either also install the PWA for push, or we add FCM later.

Tasks:
- [x] `src/domain/overtakes.ts` + tests: diff two rankings → overtake events, daily cap
- [x] Inbox screen + unread badge on the bell
- [x] Settings toggles (steps / overall / phone notifications)
- [ ] Push backend (todo once Supabase exists). Design (documented here, implemented once Supabase exists):
  - table `push_subscriptions(user_id, endpoint, p256dh, auth)`
  - DB trigger on `daily_stats` → edge function `notify-overtakes` → `web-push` with VAPID keys
    stored as Supabase secrets
