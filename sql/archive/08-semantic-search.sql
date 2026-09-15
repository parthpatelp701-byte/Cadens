-- Cadens v2 — Phase 2: Semantic Search (pgvector)
-- Run AFTER 05-saves.sql
-- Requires: CREATE EXTENSION vector; (Supabase Dashboard → Database → Extensions, or run below)

CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (OpenAI text-embedding-3-small = 1536 dims)
-- If you prefer a smaller/cheaper model later, adjust dimension + re-embed.
ALTER TABLE public.saves
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast approximate nearest-neighbor search (personal library sizes)
-- m=16, ef_construction=64 is a good balance for quality vs build time
CREATE INDEX IF NOT EXISTS saves_embedding_hnsw_idx
  ON public.saves
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Optional: partial index only on rows that have embeddings
-- (HNSW already skips nulls in practice for queries that filter)

COMMENT ON COLUMN public.saves.embedding IS 'OpenAI text-embedding-3-small (1536-d) or compatible';

-- ---------------------------------------------------------------------------
-- Hybrid search RPC: keyword (FTS / ilike) + vector similarity
-- Returns saves ranked by a blend of semantic score and recency.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_saves_hybrid(
  query_text text,
  query_embedding vector(1536) DEFAULT NULL,
  match_count int DEFAULT 30,
  semantic_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  body text,
  link_url text,
  link_title text,
  link_description text,
  image_path text,
  ai_summary text,
  created_at timestamptz,
  updated_at timestamptz,
  score float
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  q text := trim(query_text);
BEGIN
  -- Only return the caller's own saves (RLS also applies)
  RETURN QUERY
  WITH semantic AS (
    SELECT
      s.id,
      CASE
        WHEN query_embedding IS NOT NULL AND s.embedding IS NOT NULL
        THEN 1 - (s.embedding <=> query_embedding)  -- cosine similarity
        ELSE 0
      END AS sem_score
    FROM public.saves s
    WHERE s.user_id = auth.uid()
  ),
  keyword AS (
    SELECT
      s.id,
      CASE
        WHEN q = '' THEN 0
        WHEN to_tsvector('english',
               coalesce(s.body, '') || ' ' ||
               coalesce(s.link_title, '') || ' ' ||
               coalesce(s.link_description, '') || ' ' ||
               coalesce(s.ai_summary, '')
             ) @@ plainto_tsquery('english', q)
        THEN 1.0
        WHEN s.body ILIKE '%' || q || '%'
          OR s.link_title ILIKE '%' || q || '%'
          OR s.link_description ILIKE '%' || q || '%'
          OR s.ai_summary ILIKE '%' || q || '%'
          OR s.link_url ILIKE '%' || q || '%'
        THEN 0.6
        ELSE 0
      END AS kw_score
    FROM public.saves s
    WHERE s.user_id = auth.uid()
  )
  SELECT
    s.id,
    s.user_id,
    s.body,
    s.link_url,
    s.link_title,
    s.link_description,
    s.image_path,
    s.ai_summary,
    s.created_at,
    s.updated_at,
    (
      (COALESCE(sem.sem_score, 0) * semantic_weight) +
      (COALESCE(kw.kw_score, 0) * (1 - semantic_weight))
    )::float AS score
  FROM public.saves s
  LEFT JOIN semantic sem ON sem.id = s.id
  LEFT JOIN keyword kw ON kw.id = s.id
  WHERE s.user_id = auth.uid()
    AND (
      q = ''
      OR COALESCE(sem.sem_score, 0) > 0.25
      OR COALESCE(kw.kw_score, 0) > 0
    )
  ORDER BY score DESC, s.created_at DESC
  LIMIT match_count;
END;
$$;

-- Pure vector search (when you only have an embedding)
CREATE OR REPLACE FUNCTION public.search_saves_semantic(
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  body text,
  link_url text,
  link_title text,
  link_description text,
  image_path text,
  ai_summary text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    s.id,
    s.user_id,
    s.body,
    s.link_url,
    s.link_title,
    s.link_description,
    s.image_path,
    s.ai_summary,
    s.created_at,
    s.updated_at,
    (1 - (s.embedding <=> query_embedding))::float AS similarity
  FROM public.saves s
  WHERE s.user_id = auth.uid()
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_saves_hybrid TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_saves_semantic TO authenticated;
