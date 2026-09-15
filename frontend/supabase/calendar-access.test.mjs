import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const fullBaseline = process.argv.includes('--full-baseline')
const db = new PGlite({extensions:{pgcrypto}})
const owner='11111111-1111-4111-8111-111111111111', member='22222222-2222-4222-8222-222222222222', pending='33333333-3333-4333-8333-333333333333', stranger='44444444-4444-4444-8444-444444444444'
const group='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
await db.exec(`
create role anon; create role authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
insert into auth.users values ('${owner}'),('${member}'),('${pending}'),('${stranger}');
`)
if (fullBaseline) {
  await db.exec(`create schema extensions; create extension pgcrypto with schema extensions;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;`)
  await db.exec(await readFile(new URL('../../../daybook-cadens/database/schema.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../../../daybook-cadens/database/fair-points-privacy.sql',import.meta.url),'utf8'))
  await db.exec(`insert into public.daybook_groups(id,owner_id,name,kind) values('${group}','${owner}','Family','family');`)
} else {
  await db.exec(`create schema cadens_private; grant usage on schema cadens_private to authenticated;
  create table public.daybook_groups(id uuid primary key,owner_id uuid);
  create table public.daybook_members(group_id uuid,user_id uuid,status text,primary key(group_id,user_id));
  insert into public.daybook_groups values('${group}','${owner}');
  grant select on public.daybook_groups to authenticated;
  create function cadens_private.member(g uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.daybook_members where group_id=g and user_id=auth.uid() and status='active') $$;`)
}
await db.exec(`insert into public.daybook_members(group_id,user_id,status) values('${group}','${owner}','active'),('${group}','${member}','active'),('${group}','${pending}','pending');`)
const fingerprintQuery = "select p.oid::regprocedure::text as name,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'daybook_%') or (n.nspname='cadens_private') order by name"
const before = (await db.query(fingerprintQuery)).rows
const calendarMigration=await readFile(new URL('./migrations/20260912023702_react_planning_compatibility.sql', import.meta.url),'utf8')
await db.exec(calendarMigration)
await db.exec(calendarMigration)
const after = (await db.query(fingerprintQuery)).rows
assert.deepEqual(after.filter(row=>before.some(old=>old.name===row.name)),before)
async function as(user){ await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); await db.exec('set role authenticated') }
async function rejected(sql){await assert.rejects(()=>db.exec(sql))}
await as(owner)
const {rows:[personal]}=await db.query('select * from public.ensure_default_calendar()')
assert.equal((await db.query('select * from public.ensure_default_calendar()')).rows[0].id,personal.id)
const {rows:[shared]}=await db.query(`insert into public.calendars(user_id,name,kind,group_id) values($1,'Family','group',$2) returning *`,[owner,group])
await db.query(`select public.create_calendar_event('Private',$1,null,false,null,null,$2)`,['2026-09-12T16:00:00Z',personal.id])
const {rows:[created]}=await db.query(`select * from public.create_calendar_event('Shared',$1,null,false,null,null,$2)`,['2026-09-12T17:00:00Z',shared.id])
await as(member)
await rejected('truncate public.calendar_events')
assert.equal((await db.query('select * from public.calendars')).rows.length,1)
assert.equal((await db.query('select * from public.calendar_events')).rows.length,1)
assert.equal((await db.query("update public.calendar_events set title='Edited by member' where id=$1 returning updated_by",[created.id])).rows[0].updated_by,member)
assert.equal((await db.query("update public.calendars set name='Hijack' where id=$1 returning id",[shared.id])).rows.length,0)
await rejected(`update public.calendar_events set user_id='${member}' where id='${created.id}'`)
await rejected(`insert into public.calendar_events(calendar_id,user_id,title,starts_at) values('${personal.id}','${member}','Leak',now())`)
await as(pending)
assert.equal((await db.query('select * from public.calendar_events')).rows.length,0)
await rejected(`insert into public.calendar_events(calendar_id,title,starts_at) values('${shared.id}','Pending',now())`)
await as(stranger)
assert.equal((await db.query('select * from public.calendars')).rows.length,0)
await rejected(`insert into public.calendars(user_id,name,kind,group_id) values('${stranger}','Hijack','group','${group}')`)
await db.exec(`reset role; update public.daybook_members set status='pending' where user_id='${member}'`)
await as(member)
assert.equal((await db.query('select * from public.calendar_events')).rows.length,0)
await db.exec('reset role; set role anon')
await rejected('select * from public.calendar_events')
await rejected('select public.ensure_default_calendar()')
console.log('PASS: private isolation, approved member editing, pending/stranger denial, creator protection, removal revocation, anonymous denial, idempotent default calendar')
if (fullBaseline) {
  await db.exec('reset role')
  await db.exec(await readFile(new URL('../../../daybook-cadens/database/verify-access.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../../../daybook-cadens/database/verify-points.sql',import.meta.url),'utf8'))
  console.log('PASS: full original schema + points migration, original access/points tests, RPC definitions unchanged')
}
await db.close()

