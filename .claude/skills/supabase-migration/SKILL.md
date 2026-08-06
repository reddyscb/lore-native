---
name: supabase-migration
description: Use when a lore-native feature needs a schema, RLS policy, or Postgres function change on the shared live Supabase project (jgksopmbfttqqngrsama). Covers the safe apply-and-verify workflow, including SECURITY DEFINER hardening and advisor checks.
---

# Supabase migration workflow

This project has **no local migrations folder** — all schema/RLS changes go
directly against the live dev Supabase project via the Supabase MCP tools.
That project is **shared with the web app** (`github.com/reddyscb/lore-app`);
never duplicate schema/RLS work that belongs there — if a change is needed,
it happens once, here, via MCP, and both apps just consume it.

## 1. Check current state before writing SQL

Don't write a migration from memory of what the schema "should" be — it
drifts. Use `list_tables`, or query `information_schema.columns` /
`pg_policies` directly for the affected tables first. For RLS specifically,
note that `qual` alone doesn't show INSERT's `WITH CHECK` clause — query the
`with_check` column explicitly if that's what you're touching.

## 2. Confirm before applying

Schema/RLS changes on shared, live infrastructure are exactly the kind of
hard-to-reverse, shared-system action that needs a stop-and-confirm — not a
silent `apply_migration` call. Present the exact SQL in plain language and
get explicit confirmation first. (The auto-mode classifier sometimes blocks
these calls outright; if it does, that's the signal to explain the SQL and
ask directly rather than looking for a way around it.)

## 3. SECURITY DEFINER hardening

Any `SECURITY DEFINER` function must:
- Pin `search_path = ''`.
- Fully-qualify every object reference (e.g. `public.push_tokens`, not
  `push_tokens`) — built-ins in `pg_catalog` stay reachable even with an
  empty search_path, so this doesn't break anything, it just closes the
  search-path-hijacking hole.

## 4. Apply, then check advisors

After `apply_migration`, always run `get_advisors` (security and
performance) before considering the migration done. Recurring findings in
this project's history, both worth fixing immediately when seen again:
- An extension installed in `public` instead of `extensions` schema
  (`extension_in_public`) — fix by dropping and recreating with an explicit
  `schema extensions`.
- A `SECURITY DEFINER` function left executable by `anon`/`authenticated`
  (`*_security_definer_function_executable`) — SECURITY DEFINER functions
  are PostgREST-exposed by default; fix with an explicit
  `revoke execute on function ... from anon, authenticated`.

## 5. Verify functionally, not just structurally

A clean advisor report doesn't mean the logic is right. Re-verify with a
real (or transaction-wrapped-and-rolled-back, if it would mutate real data)
call. For trigger-based work involving `pg_net`, check `net._http_response`
for the actual HTTP call/response, since `pg_net` requests are queued and
fire only after the triggering transaction commits.
