-- Cadens v2 — Daybook compatibility baseline
-- This migration supplies the legacy Daybook objects required by the current v2 frontend.
-- Run BEFORE 01-notifications.sql and the remaining v2 migrations.

begin;

create extension if not exists pgcrypto;

create schema if not exists cadens_private;

create table if not exists public.daybook_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.daybook_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null default 'group' check (kind in ('group','family')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique check (char_length(invite_code) between 4 and 32),
  created_at timestamptz not null default now()
);

create table if not exists public.daybook_members (
  group_id uuid not null references public.daybook_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('pending','active')),
  role text not null default 'Member' check (role in ('Owner','Member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists daybook_members_user_idx on public.daybook_members(user_id, status);
create index if not exists daybook_members_group_idx on public.daybook_members(group_id, status);

create table if not exists public.daybook_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.daybook_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  collection text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists daybook_records_collection_created_idx
  on public.daybook_records(collection, created_at desc);
create index if not exists daybook_records_owner_collection_idx
  on public.daybook_records(owner_id, collection, created_at desc);

create table if not exists public.daybook_reactions (
  post_owner uuid not null references auth.users(id) on delete cascade,
  post_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_owner, post_id, user_id)
);
create index if not exists daybook_reactions_post_idx
  on public.daybook_reactions(post_owner, post_id);

create table if not exists public.daybook_comments (
  id uuid primary key default gen_random_uuid(),
  post_owner uuid not null references auth.users(id) on delete cascade,
  post_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists daybook_comments_post_idx
  on public.daybook_comments(post_owner, post_id, created_at desc);

alter table public.daybook_accounts enable row level security;
alter table public.daybook_groups enable row level security;
alter table public.daybook_members enable row level security;
alter table public.daybook_revisions enable row level security;
alter table public.daybook_records enable row level security;
alter table public.daybook_reactions enable row level security;
alter table public.daybook_comments enable row level security;

revoke all on public.daybook_accounts, public.daybook_groups, public.daybook_members,
  public.daybook_revisions, public.daybook_records, public.daybook_reactions,
  public.daybook_comments from anon, authenticated;

grant select on public.daybook_accounts to authenticated;
grant select on public.daybook_groups, public.daybook_members to authenticated;
grant select on public.daybook_records, public.daybook_reactions, public.daybook_comments to authenticated;

drop policy if exists daybook_accounts_select on public.daybook_accounts;
create policy daybook_accounts_select on public.daybook_accounts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists daybook_groups_select on public.daybook_groups;
create policy daybook_groups_select on public.daybook_groups
  for select to authenticated using (
    owner_id = auth.uid() or exists (
      select 1 from public.daybook_members m
      where m.group_id = daybook_groups.id and m.user_id = auth.uid()
    )
  );

drop policy if exists daybook_members_select on public.daybook_members;
create policy daybook_members_select on public.daybook_members
  for select to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.daybook_members mine
      where mine.group_id = daybook_members.group_id
        and mine.user_id = auth.uid() and mine.status = 'active'
    )
  );

drop policy if exists daybook_records_select on public.daybook_records;
create policy daybook_records_select on public.daybook_records
  for select to authenticated using (
    owner_id = auth.uid()
    or (
      collection = 'posts'
      and (
        payload->>'privacy' = 'group'
        and payload->>'groupId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and exists (
          select 1 from public.daybook_members m
          where m.group_id = (payload->>'groupId')::uuid
            and m.user_id = auth.uid() and m.status = 'active'
        )
        or payload->>'privacy' = 'circle'
        and exists (
          select 1 from public.daybook_groups g
          join public.daybook_members om on om.group_id = g.id and om.user_id = owner_id and om.status = 'active'
          join public.daybook_members me on me.group_id = g.id and me.user_id = auth.uid() and me.status = 'active'
          where g.kind = 'family'
        )
      )
    )
  );

drop policy if exists daybook_reactions_select on public.daybook_reactions;
create policy daybook_reactions_select on public.daybook_reactions
  for select to authenticated using (true);

drop policy if exists daybook_comments_select on public.daybook_comments;
create policy daybook_comments_select on public.daybook_comments
  for select to authenticated using (
    user_id = auth.uid() or post_owner = auth.uid() or exists (
      select 1 from public.daybook_records r
      where r.owner_id = post_owner and r.id = post_id and r.collection = 'posts'
        and (
          r.payload->>'privacy' = 'group' and r.payload->>'groupId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (
            select 1 from public.daybook_members m
            where m.group_id = (r.payload->>'groupId')::uuid
              and m.user_id = auth.uid() and m.status = 'active'
          )
          or r.payload->>'privacy' = 'circle' and exists (
            select 1 from public.daybook_groups g
            join public.daybook_members om on om.group_id = g.id and om.user_id = post_owner and om.status = 'active'
            join public.daybook_members me on me.group_id = g.id and me.user_id = auth.uid() and me.status = 'active'
            where g.kind = 'family'
          )
        )
    )
  );

create or replace function cadens_private.member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.daybook_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function cadens_private.post_access(p_owner uuid, p_post_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.daybook_records r
    where r.owner_id = p_owner and r.id = p_post_id and r.collection = 'posts'
      and (
        r.owner_id = auth.uid()
        or r.payload->>'privacy' = 'private'
          and r.owner_id = auth.uid()
        or r.payload->>'privacy' = 'group'
          and r.payload->>'groupId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and exists (
            select 1 from public.daybook_members m
            where m.group_id = (r.payload->>'groupId')::uuid
              and m.user_id = auth.uid() and m.status = 'active'
          )
        or r.payload->>'privacy' = 'circle'
          and exists (
            select 1 from public.daybook_groups g
            join public.daybook_members om on om.group_id = g.id and om.user_id = p_owner and om.status = 'active'
            join public.daybook_members me on me.group_id = g.id and me.user_id = auth.uid() and me.status = 'active'
            where g.kind = 'family'
          )
      )
  );
$$;

grant execute on function cadens_private.member(uuid) to authenticated;
grant execute on function cadens_private.post_access(uuid,text) to authenticated;

create or replace function public.daybook_load()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare u uuid := auth.uid(); r bigint;
begin
  if u is null then raise exception 'Login required' using errcode='42501'; end if;
  insert into public.daybook_accounts(user_id) values(u) on conflict do nothing;
  insert into public.daybook_revisions(user_id) values(u) on conflict do nothing;
  select revision into r from public.daybook_revisions where user_id=u;
  return jsonb_build_object('revision', r, 'settings', coalesce((select settings from public.daybook_accounts where user_id=u),'{}'::jsonb));
end;
$$;

grant execute on function public.daybook_load() to authenticated;

create or replace function public.daybook_sync(
  expected bigint,
  changes jsonb,
  preferences jsonb default '{}'::jsonb
)
returns bigint language plpgsql security invoker set search_path = public as $$
declare u uuid := auth.uid(); current_rev bigint; c jsonb; p jsonb;
begin
  if u is null then raise exception 'Login required' using errcode='42501'; end if;
  if jsonb_typeof(changes) <> 'array' then raise exception 'changes must be an array'; end if;
  insert into public.daybook_accounts(user_id, settings) values(u, coalesce(preferences,'{}'::jsonb))
    on conflict (user_id) do update set settings=coalesce(preferences,'{}'::jsonb), updated_at=now();
  insert into public.daybook_revisions(user_id) values(u) on conflict do nothing;
  select revision into current_rev from public.daybook_revisions where user_id=u for update;
  if current_rev <> expected then raise exception 'Revision conflict: expected %, current %', expected, current_rev using errcode='40001'; end if;

  for c in select value from jsonb_array_elements(changes) loop
    if coalesce(c->>'collection','') <> 'posts' then raise exception 'Unsupported collection'; end if;
    p := coalesce(c->'payload','{}'::jsonb);
    if char_length(coalesce(p->>'text','')) > 10000 then raise exception 'Post text too long'; end if;
    if p->>'privacy' not in ('private','group','circle') then raise exception 'Invalid post privacy'; end if;
    if p->>'privacy' = 'group' then
      if nullif(p->>'groupId','') is null or not exists (
        select 1 from public.daybook_members m where m.group_id=(p->>'groupId')::uuid and m.user_id=u and m.status='active'
      ) then raise exception 'You must be an active group member'; end if;
    end if;
    insert into public.daybook_records(owner_id,id,collection,payload,created_at,updated_at)
      values(u,c->>'id','posts',p,coalesce((p->>'created_at')::timestamptz,now()),now())
      on conflict (owner_id,id) do update set payload=excluded.payload, updated_at=now();
  end loop;
  update public.daybook_revisions set revision=revision+1, updated_at=now() where user_id=u returning revision into current_rev;
  return current_rev;
end;
$$;

grant execute on function public.daybook_sync(bigint,jsonb,jsonb) to authenticated;

create or replace function public.daybook_feed()
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb)
  from (
    select r.id, r.owner_id as "_ownerId", r.id as "_recordId",
      coalesce(a.settings#>>'{profile,displayName}','Member') as author,
      null::text as avatar, r.payload->>'text' as text,
      coalesce(r.payload->>'mood','😊') as mood,
      coalesce(r.payload->>'privacy','private') as privacy,
      (select count(*)::int from public.daybook_reactions l where l.post_owner=r.owner_id and l.post_id=r.id) as likes,
      exists(select 1 from public.daybook_reactions l where l.post_owner=r.owner_id and l.post_id=r.id and l.user_id=auth.uid()) as liked,
      coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'by',coalesce(ca.settings#>>'{profile,displayName}','Member'),'text',c.body,'created_at',c.created_at) order by c.created_at asc) from public.daybook_comments c left join public.daybook_accounts ca on ca.user_id=c.user_id where c.post_owner=r.owner_id and c.post_id=r.id),'[]'::jsonb) as comments,
      r.created_at, case when r.payload->>'photo_path' is not null then jsonb_build_array(r.payload->>'photo_path') else '[]'::jsonb end as media
    from public.daybook_records r left join public.daybook_accounts a on a.user_id=r.owner_id
    where r.collection='posts' and cadens_private.post_access(r.owner_id,r.id)
    limit 100
  ) x;
$$;

grant execute on function public.daybook_feed() to authenticated;

create or replace function public.daybook_groups()
returns jsonb language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(grow order by name),'[]'::jsonb) from (
    select jsonb_build_object(
      'id',g.id,'name',g.name,'kind',g.kind,'code',g.invite_code,'ownerId',g.owner_id,
      'status',case when gm.status='pending' then 'pending' else 'active' end,
      'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(a.settings#>>'{profile,displayName}','Member'),'status',m.status,'role',m.role) order by m.joined_at) from public.daybook_members m left join public.daybook_accounts a on a.user_id=m.user_id where m.group_id=g.id),'[]'::jsonb)
    ) as grow, g.name
    from public.daybook_groups g join public.daybook_members gm on gm.group_id=g.id and gm.user_id=auth.uid()
  ) q;
$$;

grant execute on function public.daybook_groups() to authenticated;

create or replace function public.daybook_group_action(
  action text, target uuid default null, member_id uuid default null, label text default '', invite_code text default '', group_kind text default 'group'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); gid uuid; code text; k text;
begin
  if u is null then raise exception 'Login required' using errcode='42501'; end if;
  if action='create' then
    if char_length(btrim(label)) not between 1 and 80 then raise exception 'Group name is required'; end if;
    k := case when group_kind='family' then 'family' else 'group' end;
    loop code := 'C-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,8)); exit when not exists(select 1 from public.daybook_groups where invite_code=code); end loop;
    insert into public.daybook_groups(name,kind,owner_id,invite_code) values(btrim(label),k,u,code) returning id into gid;
    insert into public.daybook_members(group_id,user_id,status,role) values(gid,u,'active','Owner');
  elsif action='join' then
    select id into gid from public.daybook_groups where upper(invite_code)=upper(btrim(daybook_group_action.invite_code));
    if gid is null then raise exception 'Invite code not found'; end if;
    insert into public.daybook_members(group_id,user_id,status,role) values(gid,u,'pending','Member')
      on conflict (group_id,user_id) do update set status='pending';
  elsif action='approve' then
    if not exists(select 1 from public.daybook_groups where id=target and owner_id=u) then raise exception 'Only the group owner can approve members' using errcode='42501'; end if;
    update public.daybook_members set status='active' where group_id=target and user_id=member_id;
  elsif action='reject' then
    if not exists(select 1 from public.daybook_groups where id=target and owner_id=u) then raise exception 'Only the group owner can reject members' using errcode='42501'; end if;
    delete from public.daybook_members where group_id=target and user_id=member_id and status='pending';
  elsif action='leave' then
    delete from public.daybook_members where group_id=target and user_id=u and role <> 'Owner';
  elsif action='delete' then
    if not exists(select 1 from public.daybook_groups where id=target and owner_id=u) then raise exception 'Only the owner can delete the group' using errcode='42501'; end if;
    delete from public.daybook_groups where id=target;
  else raise exception 'Unknown group action'; end if;
  return public.daybook_groups();
end;
$$;

grant execute on function public.daybook_group_action(text,uuid,uuid,text,text,text) to authenticated;

commit;
