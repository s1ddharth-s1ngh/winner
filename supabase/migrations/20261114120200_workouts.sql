-- Workouts and hobbies log (manual). +1 star on days with at least one session (computed in the app).

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  type text not null check (char_length(type) between 1 and 30),
  duration_min integer not null check (duration_min between 1 and 600),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);
create index workouts_user_id_date_idx on public.workouts (user_id, date);

alter table public.workouts enable row level security;

create policy "workouts: read group mates" on public.workouts
  for select to authenticated using (public.shares_group_with(user_id));
create policy "workouts: insert own" on public.workouts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workouts: update own" on public.workouts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workouts: delete own" on public.workouts
  for delete to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.workouts;
