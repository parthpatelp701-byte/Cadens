begin;
create schema if not exists cadens_private;
revoke all on schema cadens_private from public, anon;
grant usage on schema cadens_private to authenticated;
create table public.daybook_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 settings jsonb not null default '{}' check (octet_length(settings::text) < 262144),
 updated_at timestamptz not null default now()
);
create table public.daybook_groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(char_length(name) between 1 and 80),
 kind text not null check(kind in ('group','family')),
 code text not null unique default upper('C-'||encode(extensions.gen_random_bytes(12),'hex')),
 created_at timestamptz not null default now()
);
create table public.daybook_members (
 group_id uuid not null references public.daybook_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','active')),
 joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create index daybook_members_user on public.daybook_members(user_id,status,group_id);
create table public.daybook_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 collection text not null check(collection in ('tasks','events','posts','notes','places','lists','links','habits','reviews','log')),
 id text not null check(char_length(id) between 1 and 200),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<131072),
 audience text not null default 'private' check(audience in ('private','group','family')),
 group_id uuid references public.daybook_groups(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(owner_id,collection,id), check(collection='posts' or audience='private')
);
create index daybook_records_feed on public.daybook_records(collection,audience,group_id,created_at desc);
create table public.daybook_comments (
 id uuid primary key default gen_random_uuid(), post_owner uuid not null, post_collection text not null default 'posts' check(post_collection='posts'), post_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000), created_at timestamptz not null default now(),
 foreign key(post_owner,post_collection,post_id) references public.daybook_records(owner_id,collection,id) on delete cascade
);
create index daybook_comments_post on public.daybook_comments(post_owner,post_id,created_at);
create index daybook_comments_user on public.daybook_comments(user_id);
create table public.daybook_reactions (
 post_owner uuid not null, post_collection text not null default 'posts' check(post_collection='posts'), post_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade, primary key(post_owner,post_id,user_id),
 foreign key(post_owner,post_collection,post_id) references public.daybook_records(owner_id,collection,id) on delete cascade
);
create index daybook_reactions_user on public.daybook_reactions(user_id);

create function cadens_private.member(g uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.daybook_members where group_id=g and user_id=auth.uid() and status='active'); $$;
create function cadens_private.can_read(o uuid,a text,g uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (o=auth.uid() or (a='group' and cadens_private.member(g)) or (a='family' and exists(
 select 1 from public.daybook_groups f join public.daybook_members x on x.group_id=f.id and x.user_id=o and x.status='active'
 join public.daybook_members y on y.group_id=f.id and y.user_id=auth.uid() and y.status='active' where f.kind='family'))); $$;
create function cadens_private.post_access(o uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.daybook_records r where r.owner_id=o and r.collection='posts' and r.id=p and cadens_private.can_read(r.owner_id,r.audience,r.group_id)); $$;

alter table public.daybook_accounts enable row level security;
alter table public.daybook_groups enable row level security;
alter table public.daybook_members enable row level security;
alter table public.daybook_records enable row level security;
alter table public.daybook_comments enable row level security;
alter table public.daybook_reactions enable row level security;
revoke all on public.daybook_accounts,public.daybook_groups,public.daybook_members,public.daybook_records,public.daybook_comments,public.daybook_reactions from anon,authenticated;
grant select on public.daybook_accounts,public.daybook_groups,public.daybook_members,public.daybook_records,public.daybook_comments,public.daybook_reactions to authenticated;
create policy accounts_read on public.daybook_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy groups_read on public.daybook_groups for select to authenticated using(owner_id=(select auth.uid()) or cadens_private.member(id));
create policy members_read on public.daybook_members for select to authenticated using(user_id=(select auth.uid()) or cadens_private.member(group_id));
create policy records_read on public.daybook_records for select to authenticated using(cadens_private.can_read(owner_id,audience,group_id));
create policy comments_read on public.daybook_comments for select to authenticated using(cadens_private.post_access(post_owner,post_id));
create policy reactions_read on public.daybook_reactions for select to authenticated using(cadens_private.post_access(post_owner,post_id));

create function cadens_private.load_book() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'Login required' using errcode='42501'; end if;
 insert into public.daybook_accounts(user_id) values(u) on conflict do nothing;
 select jsonb_build_object('revision',a.revision,'settings',a.settings,'records',coalesce((select jsonb_agg(jsonb_build_object('collection',r.collection,'id',r.id,'payload',r.payload)) from public.daybook_records r where r.owner_id=u),'[]'::jsonb)) into result from public.daybook_accounts a where a.user_id=u;
 return result;
end $$;
create function cadens_private.sync_book(expected bigint, changes jsonb, preferences jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); rev bigint; r jsonb; c text; k text; d jsonb; a text; g uuid;
begin
 if u is null then raise exception 'Login required' using errcode='42501'; end if;
 if expected is null or changes is null or preferences is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>10000 or jsonb_typeof(preferences)<>'object' then raise exception 'Invalid sync payload'; end if;
 insert into public.daybook_accounts(user_id) values(u) on conflict do nothing;
 select revision into rev from public.daybook_accounts where user_id=u for update;
 if rev<>expected then raise exception 'Your data changed on another device. Export your unsaved draft, then reload.' using errcode='40001'; end if;
 for r in select value from jsonb_array_elements(changes) loop
  c:=r->>'collection'; k:=r->>'id';
  if c not in ('tasks','events','posts','notes','places','lists','links','habits','reviews','log') or k is null then raise exception 'Invalid record'; end if;
  if r->>'deleted'='true' then delete from public.daybook_records where owner_id=u and collection=c and id=k;
  else
   d:=r->'payload'; a:='private'; g:=null;
   if c='posts' then
    if d->>'privacy'='group' then a:='group'; g:=(d->>'groupId')::uuid; if not cadens_private.member(g) then raise exception 'You must be an approved group member' using errcode='42501'; end if;
    elsif d->>'privacy' in ('circle','public') then a:='family'; end if;
   end if;
   insert into public.daybook_records(owner_id,collection,id,payload,audience,group_id) values(u,c,k,d,a,g)
   on conflict(owner_id,collection,id) do update set payload=excluded.payload,audience=excluded.audience,group_id=excluded.group_id,updated_at=clock_timestamp();
  end if;
 end loop;
 if (select count(*) from public.daybook_records where owner_id=u)>10000 then raise exception 'Beta limit is 10000 records per account'; end if;
 update public.daybook_accounts set revision=revision+1,settings=preferences,updated_at=clock_timestamp() where user_id=u returning revision into rev;
 return rev;
end $$;

create function cadens_private.groups_for_me() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null then raise exception 'Login required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'kind',g.kind,'code',case when m.status='active' then g.code else null end,'ownerId',g.owner_id,'status',m.status,'members',case when m.status='active' then coalesce((select jsonb_agg(jsonb_build_object('id',x.user_id,'name',coalesce(a.settings#>>'{profile,displayName}','Member'),'status',x.status,'role',case when x.user_id=g.owner_id then 'Owner' else 'Member' end)) from public.daybook_members x left join public.daybook_accounts a on a.user_id=x.user_id where x.group_id=g.id and (x.status='active' or g.owner_id=u)),'[]'::jsonb) else '[]'::jsonb end)) from public.daybook_groups g join public.daybook_members m on m.group_id=g.id and m.user_id=u),'[]'::jsonb);
end $$;
create function cadens_private.group_action(action text, target uuid, member_id uuid, label text, invite_code text, group_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); g public.daybook_groups; begin
 if u is null then raise exception 'Login required' using errcode='42501'; end if;
 if action='create' then
  if (select count(*) from public.daybook_groups where owner_id=u)>=20 then raise exception 'Group limit reached'; end if;
  insert into public.daybook_groups(owner_id,name,kind) values(u,left(btrim(label),80),group_kind) returning * into g;
  insert into public.daybook_members(group_id,user_id,status) values(g.id,u,'active');
 elsif action='join' then
  select * into g from public.daybook_groups where code=upper(btrim(invite_code));
  if g.id is null then raise exception 'Invite code is invalid'; end if;
  if (select count(*) from public.daybook_members where user_id=u and status='pending')>=20 then raise exception 'Too many pending requests'; end if;
  insert into public.daybook_members(group_id,user_id) values(g.id,u) on conflict do nothing;
 else
  select * into g from public.daybook_groups where id=target for update;
  if g.id is null then raise exception 'Group unavailable'; end if;
  if action='leave' then
   if g.owner_id=u then raise exception 'An owner must remove the group instead of leaving it'; end if;
   delete from public.daybook_members where group_id=g.id and user_id=u;
  else
   if g.owner_id<>u then raise exception 'Only the group owner can do this' using errcode='42501'; end if;
   if action='approve' then update public.daybook_members set status='active' where group_id=g.id and user_id=member_id;
   elsif action='remove' then
    if member_id=u then raise exception 'Cannot remove the owner'; end if;
    delete from public.daybook_members where group_id=g.id and user_id=member_id;
   elsif action='rotate' then update public.daybook_groups set code=upper('C-'||encode(extensions.gen_random_bytes(12),'hex')) where id=g.id;
   elsif action='delete' then delete from public.daybook_groups where id=g.id;
   else raise exception 'Unknown action'; end if;
  end if;
 end if;
 return cadens_private.groups_for_me();
end $$;

create function cadens_private.social_feed() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null then raise exception 'Login required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(p.data order by p.created_at desc) from (select r.created_at,r.payload || jsonb_build_object('id',r.id,'_ownerId',r.owner_id,'author',coalesce(a.settings#>>'{profile,displayName}','Member'),'privacy',case when r.audience='private' then 'me' when r.audience='family' then 'circle' else 'group' end,'likes',(select count(*) from public.daybook_reactions x where x.post_owner=r.owner_id and x.post_id=r.id),'liked',exists(select 1 from public.daybook_reactions x where x.post_owner=r.owner_id and x.post_id=r.id and x.user_id=u),'comments',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'userId',x.user_id,'by',coalesce(b.settings#>>'{profile,displayName}','Member'),'text',x.body,'created_at',x.created_at) order by x.created_at) from public.daybook_comments x left join public.daybook_accounts b on b.user_id=x.user_id where x.post_owner=r.owner_id and x.post_id=r.id),'[]'::jsonb)) as data from public.daybook_records r left join public.daybook_accounts a on a.user_id=r.owner_id where r.collection='posts' and cadens_private.can_read(r.owner_id,r.audience,r.group_id) order by r.created_at desc limit 500) p),'[]'::jsonb);
end $$;
create function cadens_private.social_action(action text, post_owner uuid, post_id text, body text, comment_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null or not cadens_private.post_access(post_owner,post_id) then raise exception 'Post unavailable' using errcode='42501'; end if;
 if action='like' then insert into public.daybook_reactions(post_owner,post_id,user_id) values(post_owner,post_id,u) on conflict do nothing;
 elsif action='unlike' then delete from public.daybook_reactions r where r.post_owner=social_action.post_owner and r.post_id=social_action.post_id and r.user_id=u;
 elsif action='comment' then insert into public.daybook_comments(post_owner,post_id,user_id,body) values(post_owner,post_id,u,btrim(body));
 elsif action='delete-comment' then delete from public.daybook_comments c where c.id=comment_id and c.post_owner=social_action.post_owner and c.post_id=social_action.post_id and c.user_id=u;
 else raise exception 'Unknown action'; end if;
end $$;

create function public.daybook_load() returns jsonb language sql security invoker set search_path='' as $$ select cadens_private.load_book(); $$;
create function public.daybook_sync(expected bigint,changes jsonb,preferences jsonb) returns bigint language sql security invoker set search_path='' as $$ select cadens_private.sync_book(expected,changes,preferences); $$;
create function public.daybook_groups() returns jsonb language sql security invoker set search_path='' as $$ select cadens_private.groups_for_me(); $$;
create function public.daybook_group_action(action text,target uuid default null,member_id uuid default null,label text default '',invite_code text default '',group_kind text default 'group') returns jsonb language sql security invoker set search_path='' as $$ select cadens_private.group_action(action,target,member_id,label,invite_code,group_kind); $$;
create function public.daybook_feed() returns jsonb language sql security invoker set search_path='' as $$ select cadens_private.social_feed(); $$;
create function public.daybook_social_action(action text,post_owner uuid,post_id text,body text default '',comment_id uuid default null) returns void language sql security invoker set search_path='' as $$ select cadens_private.social_action(action,post_owner,post_id,body,comment_id); $$;
revoke all on all functions in schema cadens_private from public,anon;
grant execute on all functions in schema cadens_private to authenticated;
revoke all on function public.daybook_load(),public.daybook_sync(bigint,jsonb,jsonb),public.daybook_groups(),public.daybook_group_action(text,uuid,uuid,text,text,text),public.daybook_feed(),public.daybook_social_action(text,uuid,text,text,uuid) from public,anon;
grant execute on function public.daybook_load(),public.daybook_sync(bigint,jsonb,jsonb),public.daybook_groups(),public.daybook_group_action(text,uuid,uuid,text,text,text),public.daybook_feed(),public.daybook_social_action(text,uuid,text,text,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cadens-photos','cadens-photos',false,1258291,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy cadens_photo_read on storage.objects for select to authenticated using(bucket_id='cadens-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy cadens_photo_insert on storage.objects for insert to authenticated with check(bucket_id='cadens-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy cadens_photo_delete on storage.objects for delete to authenticated using(bucket_id='cadens-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
