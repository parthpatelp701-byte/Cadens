# Cadens v2 — RLS test plan

Use two real test accounts (A and B) in a non-production Supabase project.

1. A creates private journal/save/post.
2. B attempts direct table reads and RPC access.
3. B attempts to modify A's records.
4. A creates a group and B requests membership.
5. B remains pending until A approves.
6. B can read group content only after approval.
7. A creates a group post; B cannot see it before approval and can see it after approval.
8. B attempts owner-only approve/delete actions; each must fail.
9. A and B exchange messages; a third account C must not read either conversation.
10. B invokes send-push with A's user_id; must receive 403.

Capture SQL/API response, timestamp and account used for every case. A PASS requires observed behavior, not merely an RLS policy definition.
