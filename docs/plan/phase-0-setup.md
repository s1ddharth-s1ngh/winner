# Phase 0 — Setup

- [ ] `git init`, `.gitignore`, `.env.example`
- [ ] Vite + React + TypeScript, ESLint
- [ ] Tailwind v4 (`@tailwindcss/vite`), design tokens as CSS variables (light theme)
- [ ] Inter via `@fontsource-variable/inter` (self-hosted, works offline)
- [ ] PWA: `vite-plugin-pwa`, manifest, generated icons, auto update
- [ ] `@supabase/supabase-js` client, created only when env vars exist
- [ ] Vitest for pure logic
- [ ] Supabase folder: `supabase/migrations/` with the first migration (validated with PGlite)

## Supabase project (owner does this later)

1. supabase.com → sign up → **New organization** (Free) → **New project**.
2. Name `winner-for-life`, generate and save the DB password, region **Central EU (Frankfurt)**.
3. Project Settings → API Keys: copy **Project URL** and **Publishable key** into `.env`:
   `VITE_SUPABASE_URL=...`, `VITE_SUPABASE_PUBLISHABLE_KEY=...`. Never the secret key.
4. Authentication → Sign In / Providers → Email: turn **Confirm email** off (for now).
5. Apply migrations: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
6. Deploy the edge function: `npx supabase functions deploy ingest-health --no-verify-jwt`.
