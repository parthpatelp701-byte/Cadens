# PostgREST filters (Cadens / Supabase)

Supabase Data API = **PostgREST**. Filters are query params:

```http
GET /rest/v1/{table}?{column}={operator}.{value}
```

Multiple params are **AND**. Use `or=(...)` for OR.

---

## Operators

| Op | Meaning | Example |
|----|---------|---------|
| `eq` | equals | `status=eq.open` |
| `neq` | not equal | `status=neq.done` |
| `gt` / `gte` | > / ≥ | `due_at=gte.2026-09-10T00:00:00Z` |
| `lt` / `lte` | < / ≤ | `due_at=lt.2026-09-11T00:00:00Z` |
| `like` / `ilike` | LIKE / ILIKE (`*` = `%`) | `title=ilike.*plan*` |
| `match` / `imatch` | regex `~` / `~*` | `title=match.^RLS` |
| `in` | IN list | `id=in.(uuid1,uuid2)` |
| `is` | IS null/true/false | `due_at=is.null` |
| `fts` / `plfts` / `phfts` / `wfts` | full-text | `body=wfts.hello` |
| `cs` / `cd` / `ov` | contains / contained / overlaps | `tags=cs.{work}` |

**NULL:** use `is.null`, never `eq.null`.

---

## supabase-js equivalents

```ts
supabase.from('tasks').select('id,title').eq('status', 'open')
// → /rest/v1/tasks?select=id,title&status=eq.open

supabase.from('tasks').is('due_at', null)
// → due_at=is.null

supabase.from('cadens_saves').ilike('title', '%meeting%')
// → title=ilike.*meeting*  (* often used in docs; JS sends % encoded)

supabase.from('tasks').or('status.eq.open,status.eq.done')
// → or=(status.eq.open,status.eq.done)

supabase.from('calendar_events')
  .gte('starts_at', fromIso)
  .lt('starts_at', toIso)
  .order('starts_at', { ascending: true })
```

---

## Cadens tables (direct filter probes)

Prefer **RPCs** for app logic. Direct filters are fine for admin checks and RLS tests.

### tasks
```http
GET /rest/v1/tasks?select=id,title,user_id,status,due_at&status=eq.open&order=due_at.asc
GET /rest/v1/tasks?select=id,title&due_at=is.null&status=eq.open
GET /rest/v1/tasks?select=id,title&due_at=gte.2026-09-10T00:00:00Z&due_at=lt.2026-09-11T00:00:00Z
```

### cadens_saves
```http
GET /rest/v1/cadens_saves?select=id,title,user_id,kind&order=created_at.desc&limit=20
GET /rest/v1/cadens_saves?select=id,title&title=ilike.*meeting*
GET /rest/v1/cadens_saves?select=id,title&kind=eq.note
```

### calendar_events
```http
GET /rest/v1/calendar_events?select=id,title,user_id,starts_at&starts_at=gte.2026-09-01T00:00:00Z&order=starts_at.asc
GET /rest/v1/calendar_events?select=id,title&task_id=not.is.null
```

### journal_entries
```http
GET /rest/v1/journal_entries?select=id,title,entry_date&order=entry_date.desc&limit=10
GET /rest/v1/journal_entries?select=id&entry_date=eq.2026-09-10
```

---

## Headers (always)

```http
apikey: {ANON_KEY}
Authorization: Bearer {USER_JWT_or_ANON_KEY}
Accept: application/json
```

Optional: `Prefer: count=exact` (range response headers for total count).

---

## Filters + RLS

1. PostgREST applies filters → candidate rows  
2. RLS policies restrict to what the JWT may see  
3. Result returned  

`user_id=eq.{other_user}` does **not** leak rows under owner-only RLS; body is `[]`.

---

## Logical OR / NOT

```http
# open OR done
/rest/v1/tasks?or=(status.eq.open,status.eq.done)

# not done
/rest/v1/tasks?status=neq.done
# or
/rest/v1/tasks?not=(status.eq.done)
```

---

## Cadens app pattern

| Path | How filtering happens |
|------|------------------------|
| Tasks list | RPC `list_tasks` (status in SQL) |
| Plan range | RPC `list_calendar_events` |
| Saves list/search | RPC `cadens_saves_list` / search |
| Deletes by id | `.eq('id', id)` on table |

Use this guide when writing **pg_net** probes, debugging Network tab URLs, or adding new `.from().select()` calls.

See also: `tests/RLS_PG_NET_RUNBOOK.md`, `guides/RLS.md`.

JSON/JSONB operators: [`POSTGREST_JSON.md`](POSTGREST_JSON.md).
