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

await as(B, () => q(`delete from public.group_members where user_id = $1`, [B]))
check('after leaving, B no longer sees A stats', (await as(B, () => q(`select * from public.daily_stats`))).rows.length === 0)

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
