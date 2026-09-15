# generate-embedding

Generates a vector embedding (and optional short AI summary) for a Cadens Save.

## Prerequisites

1. Run `sql/08-semantic-search.sql` (enables pgvector, adds `embedding` column, HNSW index, hybrid RPC).
2. Supabase secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   ```
   (`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are usually injected automatically.)

## Deploy

```bash
# From project root or edge-function folder
supabase functions deploy generate-embedding
```

Or copy into `frontend/supabase/functions/generate-embedding/` and deploy from there.

## Call

```ts
// After creating a save:
await supabase.functions.invoke('generate-embedding', {
  body: { save_id: newSave.id, generate_summary: true },
})
```

## Models

- Embeddings: `text-embedding-3-small` (1536 dimensions)
- Summary: `gpt-4o-mini`

Change models in `index.ts` if you prefer different cost/quality tradeoffs. If you change embedding dimension you must also alter the column and re-embed all rows.
