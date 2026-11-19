# Phase 6 — Chat

Ported from Telebi's chat module (2026-11-19), cut down for a small group of friends.

## What it does

- [x] One chat per group, with everyone in the group. Created by a trigger with the group; members
      follow `group_members` (leave the group = leave its chat; rejoin = back in).
- [x] Direct chats 1:1 with anyone who shares a group with you. One per pair.
- [x] Replies, `@` mentions (only chat members), reactions (toggle, max 12 emoji per message),
      edit own messages, delete own messages (the group owner can delete any message in the group chat).
      Deleted messages stay, emptied ("Message deleted").
- [x] Unread counters and read mark (only moves forward), "Seen" under my last message in a direct chat.
- [x] Realtime: one subscription for the whole app (`src/app/chat.tsx`), list reload debounced 500 ms,
      60 s polling as safety net.
- [x] Alerts: a toast for direct messages and mentions (not for ordinary group messages, not for the
      chat already open). With the tab hidden, a system notification if enabled in Settings.
- [x] Chat screens are lazy-loaded.

## Where

- DB: `supabase/migrations/20261119150000_chat.sql`. Tables are read through RLS and written only by
  the `chat_*` RPCs. Single visibility rule: `chat_can_see` = active member.
- Tests: chat section of `supabase/tests/check-rls.mjs` (`npm run test:db`), tag parsing in
  `src/domain/chat.test.ts`.
- App: `src/app/chat.tsx` (provider), `src/screens/ChatListScreen.tsx`, `src/screens/ChatThreadScreen.tsx`,
  `src/screens/chat/Composer.tsx`. Demo backend: chat part of `src/data/localRepo.ts`.

## Not done (on purpose)

- Named or private channels, group DMs, chats attached to workouts, "urgent" flag, "For you" tab.
- Push notifications when the app is closed (same blocker as phase 4).
- Demo friends do not write messages.

## Owner steps

- Apply the migration to the Supabase project.
