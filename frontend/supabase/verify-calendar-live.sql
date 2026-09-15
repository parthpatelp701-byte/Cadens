begin;
insert into auth.users(id) values
 ('d1111111-1111-4111-8111-111111111111'),
 ('d2222222-2222-4222-8222-222222222222');
set local role authenticated;
do $$
declare
 a uuid:='d1111111-1111-4111-8111-111111111111';
 b uuid:='d2222222-2222-4222-8222-222222222222';
 g uuid; shared uuid; private_cal uuid; shared_event uuid; affected integer; result jsonb;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 result:=public.daybook_group_action('create',label=>'Calendar access fixture',group_kind=>'family');
 g:=(result->0->>'id')::uuid;
 private_cal:=(public.ensure_default_calendar()).id;
 insert into public.calendars(user_id,name,kind,group_id) values(a,'Family calendar','group',g) returning id into shared;
 select id into shared_event from public.create_calendar_event('Shared event','2026-09-13 09:00 America/Vancouver',null,false,null,null,shared);
 perform public.create_calendar_event('Private event','2026-09-13 10:00 America/Vancouver',null,false,null,null,private_cal);

 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.daybook_group_action('join',invite_code=>result->0->>'code');
 if exists(select 1 from public.calendars where id=shared) then raise exception 'Pending member read shared calendar'; end if;
 if exists(select 1 from public.calendar_events where id=shared_event) then raise exception 'Pending member read shared event'; end if;

 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.daybook_group_action('approve',target=>g,member_id=>b);
 perform set_config('request.jwt.claim.sub',b::text,true);
 if (select count(*) from public.calendars)<>1 then raise exception 'Approved member calendar visibility failed'; end if;
 if (select count(*) from public.calendar_events)<>1 then raise exception 'Private event leaked or shared event missing'; end if;
 update public.calendar_events set title='Member edit' where id=shared_event;
 get diagnostics affected=row_count;
 if affected<>1 or (select updated_by from public.calendar_events where id=shared_event)<>b then raise exception 'Approved member edit failed'; end if;
 update public.calendars set name='Member takeover' where id=shared;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Member changed owner-managed calendar'; end if;
 begin
  update public.calendar_events set user_id=b where id=shared_event;
  raise exception 'Event creator was mutable';
 exception when insufficient_privilege then null;
 end;

 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.daybook_group_action('remove',target=>g,member_id=>b);
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.calendar_events where id=shared_event) then raise exception 'Removed member retained read access'; end if;
 update public.calendar_events set title='Removed edit' where id=shared_event;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Removed member retained write access'; end if;
end $$;
rollback;
