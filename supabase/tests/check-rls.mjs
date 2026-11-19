import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Applies every migration to an in-memory Postgres (PGlite) with Supabase stand-ins, then checks RLS.
const dir = fileURLToPath(new URL('../migrations/', import.meta.url))
const db = new PGlite()
const q = (sql, p) => db.query(sql, p)
let fails = 0
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++ }

// Minimal stand-ins for what Supabase provides.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`)
for (const f of readdirSync(dir).sort()) {
  await db.exec(readFileSync(join(dir, f), 'utf8'))
  console.log('applied', f)
}
await db.exec(`grant usage on schema public to authenticated, anon;
  grant select, insert, update, delete on all tables in schema public to authenticated;`)

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c'
await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1,'alice@x.io','{"timezone":"Europe/London"}'),($2,'bob@x.io','{}'),($3,'carol@x.io','{}')`, [A, B, C])
const p = await q(`select username, timezone from public.profiles where id=$1`, [A])
check('profile trigger', p.rows[0].username === 'alice' && p.rows[0].timezone === 'Europe/London')

const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try { return await fn() } finally { await db.exec(`reset role;`) }
}

const g = await as(A, () => q(`select * from public.create_group('Early Birds')`))
const code = g.rows[0].invite_code
check('create_group returns code', /^[A-Z0-9]{6}$/.test(code))
await as(B, () => q(`select * from public.join_group($1)`, [code.toLowerCase()]))
await as(B, () => q(`select * from public.join_group($1)`, [code])) // idempotent
let err = null
try { await as(C, () => q(`select * from public.join_group('ZZZZZZ')`)) } catch (e) { err = e.message }
check('join_group bad code errors', err?.includes('No group found'))

await as(A, () => q(`insert into public.daily_stats (date, steps, steps_source) values ('2026-11-14', 9000, 'manual')`))
await as(A, () => q(`insert into public.daily_stats (date, sleep_start, sleep_end, sleep_minutes, sleep_source) values ('2026-11-14', '2026-11-13T22:30Z', '2026-11-14T06:30Z', 480, 'manual')
  on conflict (user_id, date) do update set sleep_start = excluded.sleep_start, sleep_end = excluded.sleep_end, sleep_minutes = excluded.sleep_minutes, sleep_source = excluded.sleep_source`))
const merged = await as(A, () => q(`select steps, sleep_minutes from public.daily_stats where user_id=$1`, [A]))
check('partial upsert keeps steps', merged.rows[0].steps === 9000 && merged.rows[0].sleep_minutes === 480)

check('B sees A stats (same group)', (await as(B, () => q(`select * from public.daily_stats`))).rows.length === 1)
check('C sees no stats', (await as(C, () => q(`select * from public.daily_stats`))).rows.length === 0)
check('C sees only own profile', (await as(C, () => q(`select * from public.profiles`))).rows.length === 1)
check('B sees 2 profiles', (await as(B, () => q(`select * from public.profiles`))).rows.length === 2)
check('C sees no groups', (await as(C, () => q(`select * from public.groups`))).rows.length === 0)
check('B sees 2 members', (await as(B, () => q(`select * from public.group_members`))).rows.length === 2)

err = null
try { await as(B, () => q(`insert into public.daily_stats (user_id, date, steps) values ($1, '2026-11-15', 1)`, [A])) } catch (e) { err = e.message }
check('B cannot write A stats', !!err)
const upd = await as(B, () => q(`update public.daily_stats set steps = 1 where user_id=$1`, [A]))
check('B cannot update A stats', upd.affectedRows === 0)
err = null
try { await as(A, () => q(`insert into public.daily_stats (date, steps) values ('2026-11-16', 200000)`)) } catch (e) { err = e.message }
check('absurd steps rejected', !!err)
err = null
try { await as(A, () => q(`insert into public.groups (name, invite_code, created_by) values ('x','ABCDEF',$1)`, [A])) } catch (e) { err = e.message }
check('direct group insert blocked', !!err)

await as(A, () => q(`insert into public.workouts (date, type, duration_min) values ('2026-11-14','Gym',45)`))
check('B sees A workout', (await as(B, () => q(`select * from public.workouts`))).rows.length === 1)
check('C sees no workout', (await as(C, () => q(`select * from public.workouts`))).rows.length === 0)

await as(A, () => q(`insert into public.api_tokens (label, token_hash) values ('iPhone', repeat('a', 64))`))
check('B cannot read A tokens', (await as(B, () => q(`select * from public.api_tokens`))).rows.length === 0)
check('A reads own token', (await as(A, () => q(`select * from public.api_tokens`))).rows.length === 1)

await q(`insert into public.garmin_links (user_id, key_hint) values ($1, 'abcd')`, [A])
await q(`insert into public.garmin_secrets (user_id, key_ciphertext) values ($1, 'iv.ct')`, [A])
check('A reads own Garmin link', (await as(A, () => q(`select * from public.garmin_links`))).rows.length === 1)
check('B cannot read A Garmin link', (await as(B, () => q(`select * from public.garmin_links`))).rows.length === 0)
check('A cannot read own Garmin secret', (await as(A, () => q(`select * from public.garmin_secrets`))).rows.length === 0)
err = null
try { await as(A, () => q(`insert into public.garmin_links (user_id, key_hint) values ($1, 'x')`, [B])) } catch (e) { err = e.message }
check('clients cannot write Garmin links', !!err)
check('A cannot change own Garmin link', (await as(A, () => q(`update public.garmin_links set last_error = null`))).affectedRows === 0)
await as(A, () => q(`insert into public.workouts (date, type, duration_min, external_id) values ('2026-11-14','Run',30,'garmin:1')`))
err = null
try { await as(A, () => q(`insert into public.workouts (date, type, duration_min, external_id) values ('2026-11-14','Run',30,'garmin:1')`)) } catch (e) { err = e.message }
check('Garmin activity stored once', !!err)

// --- Chat ---------------------------------------------------------------------------------------
const chats = async (uid) => (await as(uid, () => q(`select public.chat_list() as l`))).rows[0].l
const uuids = (ids) => `{${ids.join(',')}}`
const send = async (uid, conv, body, mentions = [], reply = null) =>
  (await as(uid, () => q(`select public.chat_send($1, $2, $3::uuid[], $4) as id`, [conv, body, uuids(mentions), reply]))).rows[0].id
const fails_ = async (fn) => { try { await fn(); return null } catch (e) { return e.message } }
const msg = async (id) => (await q(`select * from public.chat_messages where id = $1`, [id])).rows[0]

check('chat: no group, no chats', (await chats(C)).length === 0)
const listA = await chats(A)
const groupChat = listA[0]?.id
check('chat: group chat created with both members', listA.length === 1 && listA[0].kind === 'group' && listA[0].members.length === 2)

const m1 = await send(A, groupChat, `Hi @[bob](u:${B})`, [B, C, A])
check('chat: mentions keep only other members', JSON.stringify((await msg(m1)).mentions) === JSON.stringify([B]))
const listB = await chats(B)
check('chat: B has 1 unread with 1 mention', listB[0].unread === 1 && listB[0].unread_mentions === 1)
check('chat: own message is not unread', (await chats(A))[0].unread === 0)
check('chat: C cannot read group messages', (await as(C, () => q(`select * from public.chat_messages`))).rows.length === 0)
check('chat: C cannot write into group chat', (await fails_(() => send(C, groupChat, 'hi')))?.includes('Chat not found'))
check('chat: empty message rejected', (await fails_(() => send(A, groupChat, '   ')))?.includes('empty'))

await as(C, () => q(`select * from public.create_group('Night Owls')`))
check('chat: another group chat stays hidden', (await chats(A)).length === 1 && (await chats(C)).length === 1)

const dm = (await as(A, () => q(`select public.chat_open_direct($1) as id`, [B]))).rows[0].id
const dm2 = (await as(B, () => q(`select public.chat_open_direct($1) as id`, [A]))).rows[0].id
check('chat: one direct chat per pair, either order', dm && dm === dm2)
check('chat: no direct with a non group mate', (await fails_(() => as(A, () => q(`select public.chat_open_direct($1)`, [C]))))?.includes('friends from your groups'))
const d1 = await send(A, dm, 'psst', [C])
check('chat: direct mention of non member dropped', (await msg(d1)).mentions.length === 0)
check('chat: C cannot read the direct', (await as(C, () => q(`select * from public.chat_messages where conversation_id = $1`, [dm]))).rows.length === 0)

check('chat: B cannot edit A message', (await fails_(() => as(B, () => q(`select public.chat_edit($1, 'x')`, [m1]))))?.includes('own messages'))
await as(A, () => q(`select public.chat_edit($1, 'Hi all')`, [m1]))
check('chat: A edits own message', (await msg(m1)).body === 'Hi all' && (await msg(m1)).edited_at !== null)
check('chat: B cannot delete A message', (await fails_(() => as(B, () => q(`select public.chat_delete($1)`, [m1]))))?.includes('own messages'))
check('chat: B cannot delete A direct message', (await fails_(() => as(B, () => q(`select public.chat_delete($1)`, [d1]))))?.includes('own messages'))
const mB = await send(B, groupChat, 'oops')
await as(A, () => q(`select public.chat_delete($1)`, [mB]))
check('chat: group owner deletes B message, emptied', (await msg(mB)).body === '' && (await msg(mB)).deleted_at !== null)

await as(B, () => q(`select public.chat_react($1, '👍')`, [m1]))
check('chat: reaction added', JSON.stringify((await msg(m1)).reactions) === JSON.stringify({ '👍': [B] }))
await as(B, () => q(`select public.chat_react($1, '👍')`, [m1]))
check('chat: second tap removes reaction', JSON.stringify((await msg(m1)).reactions) === '{}')

const r1 = await send(A, groupChat, 'reply', [], d1)
check('chat: reply to another chat dropped', (await msg(r1)).reply_to === null)

const readMark = async () => (await q(`select read_until from public.chat_members where conversation_id = $1 and user_id = $2`, [groupChat, B])).rows[0].read_until
await as(B, () => q(`select public.chat_mark_read($1, now())`, [groupChat]))
const mark = await readMark()
await as(B, () => q(`select public.chat_mark_read($1, '2000-01-01')`, [groupChat]))
check('chat: read mark never goes back', (await readMark()).getTime() === mark.getTime())
await as(B, () => q(`select public.chat_mark_read($1, '2999-01-01')`, [groupChat]))
check('chat: read mark never passes now', (await readMark()) <= new Date())

check('chat: direct insert blocked', !!(await fails_(() => as(A, () => q(`insert into public.chat_messages (conversation_id, body) values ($1, 'x')`, [groupChat])))))
check('chat: direct update blocked', (await as(A, () => q(`update public.chat_messages set body = 'x'`))).affectedRows === 0)
check('chat: realtime on messages and members',
  (await q(`select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('chat_messages', 'chat_members')`)).rows[0].n === 2)

await as(B, () => q(`delete from public.group_members where user_id = $1`, [B]))
check('after leaving, B no longer sees A stats', (await as(B, () => q(`select * from public.daily_stats`))).rows.length === 0)
const afterLeave = await chats(B)
check('chat: after leaving, B keeps only the direct', afterLeave.length === 1 && afterLeave[0].kind === 'direct')
check('chat: after leaving, B cannot read group messages', (await as(B, () => q(`select * from public.chat_messages where conversation_id = $1`, [groupChat]))).rows.length === 0)
await as(B, () => q(`select * from public.join_group($1)`, [code]))
check('chat: rejoining brings the group chat back', (await chats(B)).length === 2)
await as(B, () => q(`delete from public.group_members where user_id = $1`, [B]))

const before = (await q(`select updated_at from public.daily_stats where user_id=$1`, [A])).rows[0].updated_at
await new Promise(r => setTimeout(r, 20))
await as(A, () => q(`update public.daily_stats set steps = 9500 where user_id=$1`, [A]))
const after = (await q(`select updated_at from public.daily_stats where user_id=$1`, [A])).rows[0].updated_at
check('updated_at touched', after > before)

await as(A, () => q(`insert into storage.objects (bucket_id, name) values ('profile-images', $1)`, [`${A}/avatar.jpg`]))
err = null
try { await as(B, () => q(`insert into storage.objects (bucket_id, name) values ('profile-images', $1)`, [`${A}/cover.jpg`])) } catch (e) { err = e.message }
check('B cannot upload into A image folder', !!err)
check('B cannot delete A avatar', (await as(B, () => q(`delete from storage.objects where name like $1`, [`${A}/%`]))).affectedRows === 0)
err = null
try { await as(A, () => q(`update public.profiles set cover_color = 'red' where id=$1`, [A])) } catch (e) { err = e.message }
check('bad cover color rejected', !!err)

console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
process.exit(fails ? 1 : 0)
