---
name: feature-flags
description: Use when adding a new feature flag to public.feature_flags (kill switch / gradual rollout for a risky or new lore-native feature), or when checking whether any flags are stale and ready to remove. Covers the add/ramp/retire lifecycle and the useFeatureFlag hook contract.
---

# Feature flags workflow

Full design and rationale: `docs/superpowers/specs/2026-08-08-feature-flags-design.md`.
This skill is the operational how-to; that doc is the why.

`public.feature_flags` is one table serving three purposes at once for any
new/risky feature: an instant kill switch, a gradual percentage rollout,
and (once Phase 14 lands city data) city-based gating. There is
deliberately no in-app admin UI — every write goes through the Supabase
dashboard.

## Adding a new flag

1. Pick a `key` named after the feature (e.g. `owner_dashboard_v2`,
   `checkin_v2`) — this is also the string passed to `useFeatureFlag`.
2. Insert the row via the Supabase dashboard (or `execute_sql` through the
   Supabase MCP during initial setup):
   ```sql
   insert into public.feature_flags (key, description, enabled, rollout_percentage)
   values ('some_key', 'what this gates and why', true, 0);
   ```
   Start `rollout_percentage` at 0 — this table's default is 0
   deliberately, so a flag never launches at full rollout just because
   `enabled` got flipped to true.
3. Wrap the new code path:
   ```ts
   const isOn = useFeatureFlag('some_key');
   if (isOn) { /* new behavior */ } else { /* old behavior, or nothing */ }
   ```
4. Ramp it from the dashboard as confidence grows: `rollout_percentage`
   0 → 5 → 25 → 100, watching for problems between steps.

## Killing a flag that's misbehaving

Set `enabled = false` from the Supabase dashboard. This is instant and
total, independent of `rollout_percentage` — no code change, no deploy.
Already-open app sessions pick it up within 5 minutes (the client hook's
TanStack Query `staleTime`), not instantly; if a failure needs to stop
*right now* for users already in a session, that's what the feature's own
error boundary is for, not the flag.

## Checking for stale flags (do this periodically, e.g. monthly)

```sql
select key, description, enabled_at
from public.feature_flags
where enabled_at < now() - interval '30 days';
```

`enabled_at` is set automatically (by a trigger) the moment a flag reaches
`enabled = true` and `rollout_percentage = 100`, and cleared back to
`null` if it's ever dialed down again — so this query only ever surfaces
flags that have been fully, continuously live for 30+ days, not ones that
happened to touch 100% once and got rolled back.

For each row this query returns:
1. Find every `useFeatureFlag('that_key')` call in the codebase (`grep -rn
   "useFeatureFlag('that_key')" src app`).
2. Inline the "on" branch, delete the "off" branch and the conditional.
3. Delete the row: `delete from public.feature_flags where key = 'that_key';`

This is a manual step, not automated — no CI check, no scheduled job. Run
it when touching this table for something else, or when the design doc's
30-day threshold comes up in conversation.

## Things to not build here

- No admin UI — toggling happens in the Supabase dashboard, by design.
- No automatic retirement enforcement — the query above is the whole
  mechanism.
- `target_cities` gating is structural only until Phase 14 adds a real
  city source (`places.city`) — don't wire up city-based logic against
  `profiles` speculatively; the client hook already fails closed
  (excludes) when `target_cities` is set but no city signal exists.
