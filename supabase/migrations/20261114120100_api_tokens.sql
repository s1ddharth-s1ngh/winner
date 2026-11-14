-- Personal API tokens for the iOS Shortcut. Only the SHA-256 hash is stored; the plain token is shown once.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text not null default 'Token' check (char_length(label) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index api_tokens_user_id_idx on public.api_tokens (user_id);

alter table public.api_tokens enable row level security;

create policy "tokens: read own" on public.api_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tokens: create own" on public.api_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tokens: revoke own" on public.api_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
-- No update policy: last_used_at is written by the ingest-health edge function (service role).
