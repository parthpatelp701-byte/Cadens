-- Cadens v2 — Phase 5: extend notifications for Idea Boards + Progress
-- Safe to re-run.

-- Widen type + target_type checks
alter table public.daybook_notifications
  drop constraint if exists daybook_notifications_type_check;

alter table public.daybook_notifications
  add constraint daybook_notifications_type_check
  check (type in (
    'like', 'comment', 'mention', 'group_invite', 'group_approved', 'message', 'system',
    'idea_added', 'board_decided', 'progress'
  ));

alter table public.daybook_notifications
  drop constraint if exists daybook_notifications_target_type_check;

alter table public.daybook_notifications
  add constraint daybook_notifications_target_type_check
  check (target_type is null or target_type in (
    'post', 'group', 'conversation', 'story', 'idea_board', 'idea', 'progress'
  ));

-- Notify group members when a new idea is added (best-effort via daybook_groups)
create or replace function public.notify_idea_added(
  p_board_id uuid,
  p_idea_id uuid,
  p_idea_preview text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_group_id uuid;
  v_board_title text;
  v_member record;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then return; end if;

  select group_id, title into v_group_id, v_board_title
  from public.idea_boards where id = p_board_id;
  if v_group_id is null then return; end if;

  -- Notify other active members of the group (via daybook_groups JSON if available)
  begin
    for v_member in
      select (m->>'id')::uuid as member_id
      from jsonb_array_elements(
        coalesce((select to_jsonb(daybook_groups())), '[]'::jsonb)
      ) g,
      lateral jsonb_array_elements(coalesce(g->'members', '[]'::jsonb)) m
      where (g->>'id')::uuid = v_group_id
        and (g->>'status') = 'active'
        and (m->>'status') = 'active'
        and (m->>'id')::uuid is distinct from v_actor
    loop
      perform public.daybook_notifications_create(
        v_member.member_id,
        v_actor,
        'idea_added',
        'New idea on ' || left(coalesce(v_board_title, 'a board'), 80),
        left(p_idea_preview, 200),
        p_board_id::text,
        'idea_board'
      );
    end loop;
  exception when others then
    -- Fallback: no fan-out if groups RPC shape differs
    null;
  end;
end;
$$;

-- Notify group members when board is decided
create or replace function public.notify_board_decided(
  p_board_id uuid,
  p_idea_preview text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_group_id uuid;
  v_board_title text;
  v_member record;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then return; end if;

  select group_id, title into v_group_id, v_board_title
  from public.idea_boards where id = p_board_id;
  if v_group_id is null then return; end if;

  begin
    for v_member in
      select (m->>'id')::uuid as member_id
      from jsonb_array_elements(
        coalesce((select to_jsonb(daybook_groups())), '[]'::jsonb)
      ) g,
      lateral jsonb_array_elements(coalesce(g->'members', '[]'::jsonb)) m
      where (g->>'id')::uuid = v_group_id
        and (g->>'status') = 'active'
        and (m->>'status') = 'active'
        and (m->>'id')::uuid is distinct from v_actor
    loop
      perform public.daybook_notifications_create(
        v_member.member_id,
        v_actor,
        'board_decided',
        'Decision made: ' || left(coalesce(v_board_title, 'board'), 80),
        left(p_idea_preview, 200),
        p_board_id::text,
        'idea_board'
      );
    end loop;
  exception when others then
    null;
  end;
end;
$$;

grant execute on function public.notify_idea_added(uuid, uuid, text) to authenticated;
grant execute on function public.notify_board_decided(uuid, text) to authenticated;
