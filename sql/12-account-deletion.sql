-- Phase 6 — Account data wipe (client-callable). Auth user removal needs service role / Edge.

create or replace function public.wipe_my_cadens_data()
returns void
language plpgsql
security invoker
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- Order: dependents first where FKs exist
  delete from public.tasks where user_id = auth.uid();
  delete from public.calendar_events where user_id = auth.uid();
  delete from public.calendars where user_id = auth.uid();

  delete from public.journal_entries where user_id = auth.uid();
  delete from public.journals where user_id = auth.uid();

  delete from public.saves where user_id = auth.uid();

  -- Idea boards / reactions if present
  begin
    delete from public.idea_reactions where user_id = auth.uid();
  exception when undefined_table then null;
  end;
  begin
    delete from public.idea_items where created_by = auth.uid();
  exception when undefined_table then null;
  end;

  delete from public.daybook_notifications where user_id = auth.uid();
  delete from public.daybook_push_subscriptions where user_id = auth.uid();

  -- Messages: remove membership + own messages where schema allows
  begin
    delete from public.daybook_messages where sender_id = auth.uid();
  exception when undefined_table then null;
  end;
  begin
    delete from public.daybook_conversation_members where user_id = auth.uid();
  exception when undefined_table then null;
  end;

  -- Posts owned by user
  begin
    delete from public.daybook_posts where author_id = auth.uid();
  exception when undefined_table then null;
  end;
  begin
    delete from public.daybook_posts where user_id = auth.uid();
  exception when undefined_table then null;
  end;
end;
$$;

grant execute on function public.wipe_my_cadens_data() to authenticated;
