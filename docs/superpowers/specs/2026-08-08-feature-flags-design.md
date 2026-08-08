# Feature flags (Phase 11 Step 10) — design

**Status:** approved, ready for implementation planning.

## Motivation

Phase 11's original Step 10 scope (see
`docs/superpowers/specs/2026-08-07-architecture-foundation-design.md` and
the v1.0 source doc) was narrow: a `feature_flags` table with
`enabled`/`rollout_percentage`/`target_roles`, used mainly for the
city-by-city rollout gating described in Phase 14.

This expands that scope on request to cover three things at once, with one
mechanism:

1. **Kill switch** — turn off a feature immediately if it fails in
   production, without a redeploy.
2. **Lifecycle** — a flag that's been fully rolled out and stable for
   ~30 days is a cleanup candidate; the flag (and the branch in code) gets
   removed rather than living forever.
3. **Scaling** — ramp a new feature out gradually (5% → 25% → 100% of
   users) instead of an all-or-nothing launch, using the same flag that
   also serves as the kill switch and the eventual city gate.

## Schema

```sql
create table public.feature_flags (
  key                text primary key,
  description        text,
  enabled            boolean not null default false,
  rollout_percentage int not null default 0
                       check (rollout_percentage between 0 and 100),
  target_roles       text[] not null default '{}',
  target_cities      text[] not null default '{}',
  created_at         timestamptz not null default now(),
  enabled_at         timestamptz
);
```

- `enabled` is the master kill switch. `false` always means off, regardless
  of `rollout_percentage`.
- `rollout_percentage` defaults to **0**, not 100 — a deliberate change
  from the original v1.0 sketch. A new flag ships dark; someone ramps it up
  on purpose via the Supabase dashboard, it never launches at 100% just
  because `enabled` got flipped.
- `target_roles` — empty array means no role restriction (matches the
  original design; e.g. `{owner}` to test an owner-dashboard feature on
  owner accounts first).
- `target_cities` — empty array means no city restriction. **Correction
  made during implementation:** this was originally written assuming
  neither `profiles` nor `places` had a city value to check against, with
  `places.city` believed to be new schema arriving in Phase 14. That
  assumption was wrong — `generate_typescript_types`, run while
  implementing this step, showed `profiles.city text` already exists on
  the live project (populated, currently `'Hyderabad'` on every row; no
  app code in this repo selects or writes it, confirmed via a full-repo
  grep before relying on it). Since real data is already there, gating is
  wired up for real in this step rather than staying a no-op: the hook
  reads `profile.city` (added to `useAuthStore`'s `Profile` type and
  select clause) and checks it against `target_cities` the same way it
  checks `target_roles`. CLAUDE.md's Phase 14 section still lists `city`
  under "new `places` schema additions" — that line is stale and should be
  corrected when Phase 14 starts or at this phase's wrap-up, not fixed
  here (this step doesn't own Phase 14's planning text). With only one
  city in the data today, a non-empty `target_cities` still can't be
  exercised with real variation — that's a data-volume limitation, not a
  code gap.
- `enabled_at` — set by a trigger the moment a flag reaches
  `enabled = true` and `rollout_percentage = 100`; cleared back to `null`
  if the flag is ever dialed down below 100 again (a rollback resets the
  "how long has this been fully stable" clock, which is the correct
  behavior — a flag that had to be rolled back and re-ramped hasn't
  actually been stable for 30 days).
- `description` — free text, purely for the human doing a cleanup pass
  later to remember what a flag was for.

RLS: `select` open to `anon` and `authenticated` (the app needs to read
flags before/without a profile in some cases). No `insert`/`update`/`delete`
policies for either role — all writes happen via the Supabase dashboard
using the project's own elevated access, matching the confirmed decision
that there's no in-app admin UI for this.

## Client: `useFeatureFlag(key)`

```ts
function useFeatureFlag(key: string): boolean {
  // 1. fetch the row (TanStack Query, no per-hook staleTime override —
  //    inherits the app's global 2-minute default)
  // 2. if no row, or enabled === false → false
  // 3. if target_roles is non-empty and profile.role isn't in it → false
  // 4. if target_cities is non-empty and profile.city isn't in it → false
  // 5. otherwise: hash(`${key}:${userId}`) % 100 < rollout_percentage
}
```

Two deliberate departures from the v1.0 sketch:

- **Per-flag-independent bucketing.** The hash input is `key:userId`, not
  just `userId`. Hashing only the user id would put the same users in the
  "on" bucket for every 50%-rollout flag at once — independent flags should
  bucket independently.
- **Fails closed.** While the query is loading, or on any missing data (no
  row, no profile, no `profile.city`), the hook returns `false`. A gated
  feature stays hidden rather than flashing on and then off.

No per-hook `staleTime` override — same as every other hook in this
codebase, it inherits `QueryProvider`'s global 2-minute default. That means
a kill switch takes effect for an already-open session within 2 minutes,
not instantly — an accepted trade-off, not a gap; a hard crash-level
failure is handled by the feature's own error boundary regardless of the
flag.

## Lifecycle: adding and retiring a flag

**Adding one:**
1. Insert a row: `key`, a `description`, `rollout_percentage: 0`,
   `enabled: true` (or `false` if you want it fully dark until ready).
2. Wrap the new/risky code path in `useFeatureFlag('some_key')`.
3. Ramp via the Supabase dashboard: 0 → 5 → 25 → 100, watching for
   problems between steps. `enabled: false` is the immediate kill switch
   at any point in this process.

**Retiring one:** once a flag has been at 100% and stable, it's a cleanup
candidate. Query:

```sql
select key, description, enabled_at
from public.feature_flags
where enabled_at < now() - interval '30 days';
```

For each match: remove the `useFeatureFlag(key)` conditional from the code
(inline the "on" branch, delete the "off" branch), then delete the row.
This is a manual step run periodically — no scheduler, no forced
enforcement. A single-developer app doesn't need automation to remind
itself; it needs the workflow written down so it doesn't get skipped. That
workflow is captured as a project skill (`.claude/skills/feature-flags/`)
rather than left as CLAUDE.md prose, matching how `supabase-migration` and
`foundation-step-checkpoint` already document their own recurring
processes in this repo.

## What this replaces vs. the original Step 10 scope

Same step, same position in the Phase 11 sequencing (source Step 8,
depends on Zustand's `useAuthStore` for role targeting, per the
architecture-foundation design doc). The schema gains `enabled_at` (new)
and formalizes `target_cities` as structural-only-for-now (per the v2.1
roadmap revision, already anticipated in the architecture design doc's
Step 10 line). The client hook's bucketing algorithm is corrected to be
per-flag-independent. None of this changes the step's position in the
sequencing or its estimated cost meaningfully — it's the same table, one
more column and a trigger, and a more careful hash.

## Out of scope

- Any in-app admin UI for toggling flags — dashboard only, per confirmed
  decision.
- `expo-location` / device-detected city (Phase 13 scope) — city gating
  here uses `profiles.city`, the value already on the account, not the
  user's live location.
- Automated flag-retirement enforcement (CI failing on a stale flag,
  Slack reminders, etc.) — the documented query + skill is enough for this
  team's size.
- Correcting CLAUDE.md's Phase 14 section, which still describes
  `places.city` as new schema to be added — it already exists (see the
  `target_cities` note above). Out of scope for this step; worth fixing at
  Phase 14 kickoff or this phase's wrap-up.
