# Winner for Life

Private steps + sleep challenge for a small group of friends: stars, rankings, streaks and badges.
Web app (PWA) + Android app (Capacitor + Health Connect) + iPhone Shortcut sync, on Supabase's free tier.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Without a `.env` the app runs in **demo mode**: accounts and data live in the browser, and a demo group
with sample friends is available (invite code `DEMO42`).

## Connect Supabase

1. Create a free project (region Central EU / Frankfurt). Steps: `docs/plan/phase-0-setup.md`.
2. `cp .env.example .env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Apply the schema and deploy the edge function:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   npx supabase functions deploy ingest-health --no-verify-jwt
   ```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build (PWA) |
| `npm test` | Unit tests (scoring, streaks, badges, ranking, ingest validation) |
| `npm run test:db` | Applies all migrations to in-memory Postgres and checks RLS |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate PWA icons from `public/favicon.svg` |

## Where things live

- `src/config/scoring.ts` — every game number (stars, bonuses, streak rules, goals)
- `src/config/badges.ts` — badge catalogue
- `src/domain/` — pure scoring / ranking logic (tested)
- `src/data/` — `Repo` interface, local demo backend, Supabase backend
- `src/screens/` — UI
- `src/native/health.ts` — Health Connect sync (Android app only)
- `supabase/migrations/` — schema + RLS, `supabase/functions/ingest-health/` — iPhone endpoint
- `docs/guides/` — iPhone Shortcut and Android APK guides (Italian)
- `docs/plan/` — roadmap and decisions
