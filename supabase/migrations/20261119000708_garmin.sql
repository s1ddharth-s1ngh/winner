-- Garmin Connect Personal API link. The API key is encrypted by the `garmin` edge function (AES-GCM,
-- server-side secret) and lives in garmin_secrets, which no client role can read or write.

alter type public.data_source add value if not exists 'garmin';

create table public.garmin_links (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  key_hint text not null check (char_length(key_hint) <= 8),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text check (char_length(last_error) <= 200)
);

create table public.garmin_secrets (
  user_id uuid primary key references public.garmin_links (user_id) on delete cascade,
  key_ciphertext text not null
);

alter table public.garmin_links enable row level security;
alter table public.garmin_secrets enable row level security;

create policy "garmin: read own link" on public.garmin_links
  for select to authenticated using (user_id = (select auth.uid()));
-- No other policies: links and secrets are written only by the edge function (service role).
-- garmin_secrets has no policy at all, so clients never see even the ciphertext.

-- Shared secret that pg_cron sends to the garmin function (x-cron-secret). It is generated inside Vault
-- (see docs/guides/garmin.md) and read here by the function with the service role only.
create function public.garmin_cron_secret()
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  return (select decrypted_secret from vault.decrypted_secrets where name = 'garmin_cron_secret');
end;
$$;
revoke execute on function public.garmin_cron_secret() from public, anon, authenticated;
grant execute on function public.garmin_cron_secret() to service_role;

-- Garmin activities become workouts. external_id ("garmin:<activityId>") makes re-syncs idempotent.
alter table public.workouts add column external_id text check (char_length(external_id) <= 60);
alter table public.workouts add constraint workouts_user_external_key unique (user_id, external_id);
