# PostgREST JSON / JSONB operators (Cadens)

Supabase Data API (PostgREST) exposes Postgres **json** / **jsonb** filtering and projection. Prefer **jsonb** in the database.

Cadens uses JSON heavily on:

| Column | Role |
|--------|------|
| `daybook_records.payload` | Posts: `privacy`, `groupId`, text, mood, media paths |
| `daybook_accounts.settings` | User preferences |
| Sync `changes` / RPC args | `{ collection, id, payload }` batches |

Product reads should stay on **RPCs** (`daybook_feed`, `daybook_sync`, list helpers). Use the operators below for debugging, admin probes, and rare direct `.from()` queries.

---

## 1. Containment operators

| PostgREST | Postgres | Meaning |
|-----------|----------|---------|
| `cs` | `@>` | Column **contains** the given JSON |
| `cd` | `<@` | Column **is contained by** the given JSON |
| `ov` | `&&` | Arrays **overlap** |

```http
GET /rest/v1/daybook_records?payload=cs.{"privacy":"group"}
GET /rest/v1/items?tags=cs.{work}
```

```ts
supabase.from('daybook_records')
  .select('id, payload')
  .contains('payload', { privacy: 'group' })
// → payload=cs.{"privacy":"group"}
```

Containment is **partial**: `{"a":1,"b":2}` contains `{"a":1}`. Nested objects must match structure.

---

## 2. Arrow operators (path access)

| Op | Returns | Use |
|----|---------|-----|
| `->` | json/jsonb | Continue navigating |
| `->>` | **text** | Compare, display, order |
| `#>` / `#>>` | json / text at path | Deep paths as arrays |

### In `select`

```http
GET /rest/v1/daybook_records?select=id,payload->>privacy,payload->>groupId
GET /rest/v1/daybook_records?select=id,payload->media
```

```ts
supabase.from('daybook_records')
  .select('id, payload->>privacy, payload->>groupId')
```

### In filters

```http
GET /rest/v1/daybook_records?payload->>privacy=eq.group
GET /rest/v1/daybook_records?payload->>groupId=is.null
```

```ts
supabase.from('daybook_records')
  .select('id, payload')
  .eq('payload->>privacy', 'group')
  .is('payload->>groupId', null)
```

**Rule of thumb:** chain `->` to walk; end with `->>` when you need text for `eq` / `order` / the client.

---

## 3. `cs` vs field `eq` vs full document `eq`

| Approach | When |
|----------|------|
| `payload=cs.{"privacy":"group"}` | Partial document match (preferred for shape) |
| `payload->>privacy=eq.group` | Single text field |
| `payload=eq.{...}` | Entire document equality (rarely useful) |

Prefer **`cs`** or **`->>` + `eq`**.

---

## 4. Arrays

**jsonb array / object containment**

```http
payload=cs.{"photo_paths":["path/a.jpg"]}
```

**Postgres text[] / array columns**

```http
tags=cs.{work,home}
tags=ov.{work}
```

```ts
.contains('tags', ['work'])
.overlaps('tags', ['work', 'home'])
```

---

## 5. Key existence

Postgres `?`, `?|`, `?&` are not equally exposed in every client. Practical HTTP patterns:

```http
payload->>privacy=not.is.null
payload->>groupId=is.null
```

True “has key” checks belong in SQL/RPC:

```sql
where payload ? 'groupId'
where payload @> '{"privacy":"group"}'::jsonb
```

---

## 6. Ordering

```http
order=payload->>created_at.desc
```

Typed sort/filter on JSON (numbers, timestamps) is fragile in pure URLs. Prefer:

- generated columns, or  
- RPC with explicit `(payload->>'score')::numeric` casts.

---

## 7. Cadens examples

### Posts with group privacy (debug only; RLS still applies)

```http
GET /rest/v1/daybook_records?collection=eq.posts&payload=cs.{"privacy":"group"}&select=id,payload
Authorization: Bearer {USER_JWT}
```

### Private posts field extract

```http
GET /rest/v1/daybook_records?collection=eq.posts&payload->>privacy=eq.private&select=id,payload->>privacy
```

### supabase-js

```ts
// Containment
await supabase
  .from('daybook_records')
  .select('id, payload')
  .eq('collection', 'posts')
  .contains('payload', { privacy: 'circle' })

// Field equality
await supabase
  .from('daybook_records')
  .select('id, payload->>privacy')
  .eq('payload->>privacy', 'private')
```

### What RLS already does in SQL

Policies use Postgres arrows, not PostgREST:

```sql
payload->>'privacy' = 'group'
and cadens_private.member((payload->>'groupId')::uuid)
```

Client filters never bypass that.

---

## 8. Indexes

```sql
-- containment (@> / cs)
create index daybook_records_payload_gin
  on public.daybook_records using gin (payload jsonb_path_ops);

-- filter by privacy text
create index daybook_records_privacy
  on public.daybook_records ((payload->>'privacy'));
```

`jsonb_path_ops` is optimized for `@>`; use `jsonb_ops` if you need `?` / `?|` / `?&`.

---

## 9. Filters + RLS reminder

1. PostgREST applies JSON filters → candidate rows  
2. RLS restricts to rows the JWT may see  
3. Response returned (`[]` if nothing allowed)

`payload=cs.{"privacy":"private"}` for another user’s private post still returns empty under owner/membership policies.

---

## 10. Cheat sheet

```http
payload=cs.{"privacy":"group"}
payload->>privacy=eq.group
payload->>groupId=is.null
select=id,payload->>privacy,payload->photo_paths
collection=eq.posts&payload->>privacy=eq.group
```

```ts
.contains('payload', { privacy: 'group' })
.eq('payload->>privacy', 'group')
.is('payload->>groupId', null)
.select('id, payload->>privacy')
```

---

## See also

- Scalar filters: [`POSTGREST_FILTERS.md`](POSTGREST_FILTERS.md)  
- RLS model: [`RLS.md`](RLS.md)  
- HTTP RLS probes: [`../tests/RLS_PG_NET_RUNBOOK.md`](../tests/RLS_PG_NET_RUNBOOK.md)
