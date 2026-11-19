-- Chat: one conversation per group (everyone in the group) and direct messages between two friends.
-- Ported from Telebi's chat module, cut down for a small group of friends: no named or private
-- channels, no document chats, no urgent flag.
--
-- Rules:
--   - Tables are readable through RLS and written ONLY by the chat_* RPCs below (security definer).
--   - One visibility rule, `chat_can_see`: you see a conversation if you are an active member.
--     Group chat members mirror `group_members` through triggers; leaving the group hides the chat.
--   - Soft delete: leaving = `chat_members.deleted_at`; rejoining brings the row back. A deleted
--     message stays, emptied, so replies keep their thread.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('group', 'direct')),
  group_id uuid unique references public.groups (id) on delete cascade,
  -- Both user ids, sorted and joined by ','. One direct chat per pair.
  direct_key text unique,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_group_has_group check ((kind = 'group') = (group_id is not null)),
  constraint chat_direct_has_key check ((kind = 'direct') = (direct_key is not null))
);

create table public.chat_members (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Read mark: messages from others after this are unread. Only moves forward.
  read_until timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Left the group. Rejoining brings the row back.
  deleted_at timestamptz,
  primary key (conversation_id, user_id)
);
create index chat_members_user_id_idx on public.chat_members (user_id) where deleted_at is null;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  -- Null once the author's account is deleted.
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Mentions are written in the text as @[name](u:<uuid>); `mentions` holds the checked ids.
  body text not null default '',
  mentions uuid[] not null default '{}',
  reply_to uuid references public.chat_messages (id) on delete set null,
  -- {"👍": ["<uuid>", ...]}
  reactions jsonb not null default '{}',
  -- Set when the text is corrected (updated_at also moves for reactions).
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at desc);

create trigger chat_members_touch_updated_at
  before update on public.chat_members
  for each row execute function public.touch_updated_at();
create trigger chat_messages_touch_updated_at
  before update on public.chat_messages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Group chats follow the groups
-- ---------------------------------------------------------------------------

create function public._chat_on_group()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.chat_conversations (kind, group_id) values ('group', new.id);
  return new;
end;
$$;

create trigger groups_chat
  after insert on public.groups
  for each row execute function public._chat_on_group();

create function public._chat_on_group_member()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.chat_members as m (conversation_id, user_id)
    select c.id, new.user_id from public.chat_conversations c where c.group_id = new.group_id
    on conflict (conversation_id, user_id) do update
      set deleted_at = null, read_until = now()
      where m.deleted_at is not null;
    return new;
  end if;
  update public.chat_members m
     set deleted_at = now()
    from public.chat_conversations c
   where c.group_id = old.group_id
     and m.conversation_id = c.id
     and m.user_id = old.user_id
     and m.deleted_at is null;
  return old;
end;
$$;

create trigger group_members_chat
  after insert or delete on public.group_members
  for each row execute function public._chat_on_group_member();

-- Groups that existed before the chat.
insert into public.chat_conversations (kind, group_id)
select 'group', g.id from public.groups g
on conflict (group_id) do nothing;
insert into public.chat_members (conversation_id, user_id)
select c.id, gm.user_id
  from public.group_members gm
  join public.chat_conversations c on c.group_id = gm.group_id
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Visibility and read policies
-- ---------------------------------------------------------------------------

-- Security definer: the members policy reads members again and would recurse otherwise.
create function public.chat_can_see(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.chat_members m
     where m.conversation_id = p_conversation
       and m.user_id = (select auth.uid())
       and m.deleted_at is null
  );
$$;

alter table public.chat_conversations enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

create policy "chat conversations: read own" on public.chat_conversations
  for select to authenticated using (public.chat_can_see(id));
-- People who left do not show up as members.
create policy "chat members: read own chats" on public.chat_members
  for select to authenticated using (deleted_at is null and public.chat_can_see(conversation_id));
-- Deleted messages stay readable (empty): "Message deleted".
create policy "chat messages: read own chats" on public.chat_messages
  for select to authenticated using (public.chat_can_see(conversation_id));

revoke insert, update, delete on public.chat_conversations, public.chat_members, public.chat_messages from anon, authenticated;

alter publication supabase_realtime add table public.chat_messages, public.chat_members;

-- ---------------------------------------------------------------------------
-- Internal helpers (only callable from the functions below)
-- ---------------------------------------------------------------------------

create function public._chat_me()
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;
  return v_me;
end;
$$;

-- Mentions kept: distinct active members of the conversation, never the author.
create function public._chat_clean_mentions(p_conversation uuid, p_ids uuid[], p_me uuid)
returns uuid[]
language sql stable set search_path = ''
as $$
  select coalesce(array_agg(distinct p), '{}'::uuid[])
    from unnest(coalesce(p_ids, '{}'::uuid[])) as p
   where p <> p_me
     and exists (
       select 1 from public.chat_members m
        where m.conversation_id = p_conversation and m.user_id = p and m.deleted_at is null
     );
$$;

revoke all on function public._chat_me(), public._chat_clean_mentions(uuid, uuid[], uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- The chat list: my conversations, newest first, with members, last message and unread counts.
create function public.chat_list()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select c.id, c.kind, c.group_id, coalesce(c.last_message_at, c.created_at) as last_at, m.read_until
      from public.chat_members m
      join public.chat_conversations c on c.id = m.conversation_id
     where m.user_id = (select auth.uid()) and m.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id,
           'kind', v.kind,
           'group_id', v.group_id,
           'read_until', v.read_until,
           'last_message_at', v.last_at,
           'members', mb.members,
           'last', l.last,
           'unread', u.unread,
           'unread_mentions', u.mentions
         ) order by v.last_at desc), '[]'::jsonb)
    from mine v
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'read_until', x.read_until) order by x.created_at), '[]'::jsonb) as members
        from public.chat_members x
       where x.conversation_id = v.id and x.deleted_at is null
    ) mb
    -- Last message: one step down the (conversation_id, created_at desc) index.
    left join lateral (
      select jsonb_build_object(
               'id', x.id,
               'author_id', x.author_id,
               'body', left(x.body, 240),
               'deleted', x.deleted_at is not null,
               'created_at', x.created_at
             ) as last
        from public.chat_messages x
       where x.conversation_id = v.id
       order by x.created_at desc
       limit 1
    ) l on true
    cross join lateral (
      select count(*) as unread,
             count(*) filter (where x.mentions @> array[(select auth.uid())]) as mentions
        from public.chat_messages x
       where x.conversation_id = v.id
         and x.created_at > v.read_until
         and x.author_id is distinct from (select auth.uid())
         and x.deleted_at is null
    ) u;
$$;

-- Opens (or finds) the direct chat with a friend from one of my groups. Returns its id.
create function public.chat_open_direct(p_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public._chat_me();
  v_key text;
  v_id uuid;
begin
  if p_user is null or p_user = v_me or not public.shares_group_with(p_user) then
    raise exception 'You can only message friends from your groups.';
  end if;
  v_key := least(v_me, p_user)::text || ',' || greatest(v_me, p_user)::text;

  insert into public.chat_conversations (kind, direct_key) values ('direct', v_key)
  on conflict (direct_key) do nothing
  returning id into v_id;
  -- Created in parallel (other tab, or the friend at the same moment): take that one.
  if v_id is null then
    select id into v_id from public.chat_conversations where direct_key = v_key;
  end if;

  insert into public.chat_members (conversation_id, user_id)
  values (v_id, v_me), (v_id, p_user)
  on conflict do nothing;
  return v_id;
end;
$$;

create function public.chat_send(
  p_conversation uuid,
  p_body text,
  p_mentions uuid[] default '{}',
  p_reply_to uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public._chat_me();
  v_body text := btrim(coalesce(p_body, ''));
  v_reply uuid := p_reply_to;
  v_now timestamptz := clock_timestamp();
  v_id uuid;
begin
  if not public.chat_can_see(p_conversation) then
    raise exception 'Chat not found.';
  end if;
  if v_body = '' then
    raise exception 'The message is empty.';
  end if;
  if length(v_body) > 4000 then
    raise exception 'The message is too long (4000 characters max).';
  end if;
  -- A reply only points inside the same conversation.
  if v_reply is not null and not exists (
    select 1 from public.chat_messages where id = v_reply and conversation_id = p_conversation
  ) then
    v_reply := null;
  end if;

  insert into public.chat_messages (conversation_id, author_id, body, mentions, reply_to, created_at, updated_at)
  values (p_conversation, v_me, v_body, public._chat_clean_mentions(p_conversation, p_mentions, v_me), v_reply, v_now, v_now)
  returning id into v_id;

  update public.chat_conversations set last_message_at = v_now where id = p_conversation;
  update public.chat_members
     set read_until = greatest(read_until, v_now)
   where conversation_id = p_conversation and user_id = v_me;
  return v_id;
end;
$$;

create function public.chat_edit(p_message uuid, p_body text, p_mentions uuid[] default '{}')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public._chat_me();
  v_msg public.chat_messages%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into v_msg from public.chat_messages where id = p_message for update;
  if not found or v_msg.deleted_at is not null or not public.chat_can_see(v_msg.conversation_id) then
    raise exception 'Message not found.';
  end if;
  if v_msg.author_id is distinct from v_me then
    raise exception 'You can only edit your own messages.';
  end if;
  if v_body = '' then
    raise exception 'The message is empty. To remove it, use Delete.';
  end if;
  if length(v_body) > 4000 then
    raise exception 'The message is too long (4000 characters max).';
  end if;

  update public.chat_messages
     set body = v_body,
         mentions = public._chat_clean_mentions(v_msg.conversation_id, p_mentions, v_me),
         edited_at = clock_timestamp()
   where id = v_msg.id;
end;
$$;

-- Toggle: first tap adds the reaction, second tap removes it. At most 12 different emoji per message.
create function public.chat_react(p_message uuid, p_emoji text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public._chat_me();
  v_msg public.chat_messages%rowtype;
  v_emoji text := left(btrim(coalesce(p_emoji, '')), 16);
  v_list jsonb;
begin
  if v_emoji = '' then
    raise exception 'Empty reaction.';
  end if;
  select * into v_msg from public.chat_messages where id = p_message for update;
  if not found or v_msg.deleted_at is not null or not public.chat_can_see(v_msg.conversation_id) then
    raise exception 'Message not found.';
  end if;

  v_list := coalesce(v_msg.reactions -> v_emoji, '[]'::jsonb);
  if v_list ? v_me::text then
    v_list := v_list - v_me::text;
  else
    if not (v_msg.reactions ? v_emoji) and (select count(*) from jsonb_object_keys(v_msg.reactions)) >= 12 then
      raise exception 'Too many different reactions on this message.';
    end if;
    v_list := v_list || to_jsonb(v_me::text);
  end if;

  update public.chat_messages
     set reactions = case
           when jsonb_array_length(v_list) = 0 then reactions - v_emoji
           else jsonb_set(reactions, array[v_emoji], v_list, true)
         end
   where id = v_msg.id;
end;
$$;

-- Own messages only; the group owner can also remove others' messages in the group chat.
create function public.chat_delete(p_message uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public._chat_me();
  v_author uuid;
  v_conv uuid;
begin
  select author_id, conversation_id into v_author, v_conv
    from public.chat_messages
   where id = p_message and deleted_at is null;
  if not found or not public.chat_can_see(v_conv) then
    raise exception 'Message not found.';
  end if;
  if v_author is distinct from v_me and not exists (
    select 1
      from public.chat_conversations c
      join public.group_members gm on gm.group_id = c.group_id
     where c.id = v_conv and gm.user_id = v_me and gm.role = 'owner'
  ) then
    raise exception 'You can only delete your own messages.';
  end if;

  update public.chat_messages
     set body = '', mentions = '{}', reactions = '{}'::jsonb, deleted_at = clock_timestamp()
   where id = p_message;
end;
$$;

-- The app sends the time of the last message it showed, not now(): a message that arrives a moment
-- later must stay unread. The mark only moves forward and never past the current time.
create function public.chat_mark_read(p_conversation uuid, p_until timestamptz default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := public._chat_me();
  v_until timestamptz := least(coalesce(p_until, clock_timestamp()), clock_timestamp());
begin
  update public.chat_members
     set read_until = v_until
   where conversation_id = p_conversation
     and user_id = v_me
     and deleted_at is null
     and read_until < v_until;
end;
$$;

revoke all on function
  public.chat_can_see(uuid),
  public.chat_list(),
  public.chat_open_direct(uuid),
  public.chat_send(uuid, text, uuid[], uuid),
  public.chat_edit(uuid, text, uuid[]),
  public.chat_react(uuid, text),
  public.chat_delete(uuid),
  public.chat_mark_read(uuid, timestamptz)
from public, anon;
grant execute on function
  public.chat_can_see(uuid),
  public.chat_list(),
  public.chat_open_direct(uuid),
  public.chat_send(uuid, text, uuid[], uuid),
  public.chat_edit(uuid, text, uuid[]),
  public.chat_react(uuid, text),
  public.chat_delete(uuid),
  public.chat_mark_read(uuid, timestamptz)
to authenticated, service_role;
