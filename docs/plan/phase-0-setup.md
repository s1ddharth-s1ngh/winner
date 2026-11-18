# Phase 0 — Setup

- [x] `git init`, `.gitignore`, `.env.example`
- [x] Vite + React + TypeScript, ESLint
- [x] Tailwind v4 (`@tailwindcss/vite`), design tokens as CSS variables (light theme)
- [x] Inter via `@fontsource-variable/inter` (self-hosted, works offline)
- [x] PWA: `vite-plugin-pwa`, manifest, generated icons, auto update
- [x] `@supabase/supabase-js` client, created only when env vars exist
- [x] Vitest for pure logic
- [x] Supabase folder: `supabase/migrations/` (validated with PGlite: `npm run test:db`)

## Supabase project

Status (2026-11-18): project `winning` (`polaqebdiwycachxrdpb`, eu-west-1) created, `.env` set,
migrations pushed (`db push --remote`), `ingest-health` deployed and answering 401 without a token.
Still to do: step 4 (Confirm email off) and a full test of the app against the live project.

1. supabase.com → sign up → **New organization** (Free) → **New project**.
2. Name `winner-for-life`, generate and save the DB password, region **Central EU (Frankfurt)**.
3. Project Settings → API Keys: copy **Project URL** and **Publishable key** into `.env`:
   `VITE_SUPABASE_URL=...`, `VITE_SUPABASE_PUBLISHABLE_KEY=...`. Never the secret key.
4. Authentication → Sign In / Providers → Email: turn **Confirm email** off (for now).
5. Apply migrations: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push --remote --yes`.
6. Deploy the edge function: `npx supabase functions deploy ingest-health --no-verify-jwt --yes`.
