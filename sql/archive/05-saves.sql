-- Cadens v2 — Saves + Collections
-- Run after existing migrations. Requires authenticated role + RLS.

-- Enable pgvector if not already (for Phase 2 semantic search)
-- CREATE EXTENSION IF NOT EXISTS vector;

create table if not exists public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text,
  link_url text,
  link_title text,
  link_description text,
  image_path text,
  ai_summary text,
  -- embedding vector(1536), -- Phase 2
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saves_user_id_idx on public.saves (user_id);
create index if not exists saves_created_at_idx on public.saves (created_at desc);
-- Full-text search support
create index if not exists saves_body_fts on public.saves using gin (to_tsvector('english', coalesce(body, '') || ' ' || coalesce(link_title, '') || ' ' || coalesce(link_description, '')));

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_id_idx on public.collections (user_id);

create table if not exists public.save_collections (
  save_id uuid not null references public.saves(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (save_id, collection_id)
);

-- RLS
alter table public.saves enable row level security;
alter table public.collections enable row level security;
alter table public.save_collections enable row level security;

create policy "Users can manage own saves"
  on public.saves for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own collections"
  on public.collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own save_collections"
  on public.save_collections for all
  using (
    exists (select 1 from public.saves s where s.id = save_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.saves s where s.id = save_id and s.user_id = auth.uid())
  );

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists saves_updated_at on public.saves;
create trigger saves_updated_at
  before update on public.saves
  for each row execute function public.set_updated_at();
