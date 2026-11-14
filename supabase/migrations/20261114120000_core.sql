-- Core schema: profiles, groups, membership and daily stats.
-- Every table has RLS enabled. Users see data of people they share a group with, and write only their own.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(btrim(username)) between 1 and 20),
  avatar_color text not null default '#4f46e5' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  avatar_url text,
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

create type public.data_source as enum ('health_connect', 'ios_shortcut', 'manual');

-- One row per user per day. The sleep night belongs to the wake-up date (user's timezone).
create table public.daily_stats (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  steps integer check (steps between 0 and 100000),
  steps_source public.data_source,
  sleep_start timestamptz,
  sleep_end timestamptz,
  sleep_minutes integer check (sleep_minutes between 0 and 960),
  sleep_source public.data_source,
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint daily_stats_sleep_order check (sleep_start is null or sleep_end is null or sleep_end > sleep_start)
);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can read membership without recursion)
-- ---------------------------------------------------------------------------

create function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = (select auth.uid())
  );
$$;

create function public.shares_group_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user = (select auth.uid()) or exists (
    select 1
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.daily_stats enable row level security;

create policy "profiles: read group mates" on public.profiles
  for select to authenticated using (public.shares_group_with(id));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Groups are created and joined only through the RPCs below.
create policy "groups: read own groups" on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy "members: read own groups" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "members: leave" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "stats: read group mates" on public.daily_stats
  for select to authenticated using (public.shares_group_with(user_id));
create policy "stats: insert own" on public.daily_stats
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "stats: update own" on public.daily_stats
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "stats: delete own" on public.daily_stats
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Every new auth user gets a profile. Username defaults to the email's local part.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, timezone)
  values (
    new.id,
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'friend'), 20),
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'Europe/Rome')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_stats_touch_updated_at
  before update on public.daily_stats
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create function public.create_group(p_name text)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
  g public.groups;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  loop
    -- gen_random_uuid() is backed by a strong random source.
    select string_agg(substr(alphabet, 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 32, 1), '')
      into code from generate_series(1, 6);
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups (name, invite_code, created_by)
    values (btrim(p_name), code, (select auth.uid()))
    returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, (select auth.uid()), 'owner');
  return g;
end;
$$;

create function public.join_group(p_code text)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  select * into g from public.groups where invite_code = upper(btrim(p_code));
  if g.id is null then
    raise exception 'No group found with this invite code.';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, (select auth.uid()))
    on conflict do nothing;
  return g;
end;
$$;

revoke execute on function public.create_group(text), public.join_group(text) from public, anon;
grant execute on function public.create_group(text), public.join_group(text) to authenticated;
revoke execute on function public.is_group_member(uuid), public.shares_group_with(uuid) from public, anon;
grant execute on function public.is_group_member(uuid), public.shares_group_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (live leaderboard). Realtime respects RLS.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.daily_stats, public.group_members, public.profiles;
