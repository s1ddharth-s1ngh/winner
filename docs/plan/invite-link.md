# Invite link

Goal: "Share invite" sends a link. A friend taps it, signs up (or signs in), and lands in the group
without typing the code.

## Current problems

1. **Invite card is blank.** `Card` adds `surface-card` (white background). In
   `GroupScreen.tsx:70` it wins over `bg-hero`, so the white text and the code are invisible.
   Only the white "Share invite" button shows.
2. **Wrong link.** `inviteText` uses `location.origin`. On GitHub Pages the app lives under
   `/<repo>/`, so the link points to the site root and gives a 404.
3. **The link does nothing.** Nothing in the app reads a code from the URL. The friend still has
   to type the code by hand.

## Link format

`https://<user>.github.io/<repo>/?join=ABC123`

- Query param on the root page, not a path like `/join/ABC123`. GitHub Pages has no SPA fallback,
  so a deep path would 404. The root always loads.
- Built as `new URL(\`${import.meta.env.BASE_URL}?join=${code}\`, location.origin)`.

## Steps

- [ ] **Fix the card**: let the hero background win (plain `div` with the card radius, or a
      `surface-card` variant), so the code and both buttons are visible again.
- [ ] **Share the real link**: `navigator.share({ title, text, url })` with the link above.
      Fallback (desktop, no Web Share): copy text + link to the clipboard, toast "Invite copied".
- [ ] **Capture the code on boot** (`main.tsx` or `App.tsx`, before any redirect):
      read `?join=`, keep it only if it matches `^[A-Z0-9]{6}$`, store it in
      `localStorage['wfl:pendingJoin']`, remove the param with `history.replaceState`.
      localStorage keeps the code through sign-up and a reload.
- [ ] **Use the code after login** (in `Gate`, once the session is ready):
  - Signed out: `AuthScreen` shows a small line "You're invited to join a group".
  - No groups yet: `Onboarding` prefills the code field (step "group"). The user taps Join.
  - Already has groups: open a confirm sheet "Join <code>?" in the app. Join → `repo.joinGroup`,
    `selectGroup`, toast "Joined <name>". Cancel → drop the code.
  - Always clear `wfl:pendingJoin` after a join or a cancel. A bad code shows the repo error.
- [ ] **Tests**: unit test for the code parser (valid, lowercase, junk, missing).
      Manual test with two accounts on the deployed site: new user via link, existing user via link,
      link with a wrong code.

## No backend change

`join_group(p_code)` already exists, is idempotent (`on conflict do nothing`), and returns the
group. RLS is already covered by `supabase/tests/check-rls.mjs`.

## Known limits

- The link always opens the browser, not the installed PWA (iOS never routes links into a PWA).
  The friend joins in the browser. The group is saved on the account, so the PWA sees it after login.
- The Android Capacitor app does not catch the link (that needs App Links + a hosted
  `assetlinks.json`). Out of scope for now.
- Anyone with the link can join. Same as the code today. Rotating the code is a later feature.
