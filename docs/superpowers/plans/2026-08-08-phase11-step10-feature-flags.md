# Phase 11 Step 10 — Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a general-purpose `feature_flags` table plus a `useFeatureFlag(key)` client hook, giving any future lore-native feature an instant kill switch, a gradual percentage rollout, and (once Phase 14 adds real city data) city gating — all through one mechanism, toggled only via the Supabase dashboard.

**Architecture:** One Postgres table (`public.feature_flags`) with public-read-only RLS, a trigger that stamps `enabled_at` the moment a flag reaches full stable rollout (for the 30-day retirement query), and a thin TanStack Query hook on the client that evaluates `enabled` → `target_roles` → `target_cities` → `rollout_percentage` in order, failing closed at every branch.

**Tech Stack:** Postgres/Supabase (via the Supabase MCP, no local migrations folder in this repo), TanStack Query, Zustand's `useAuthStore` (for `session.user.id` / `profile.role`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-08-feature-flags-design.md` — read it before starting; this plan implements it as written. Skill reference: `.claude/skills/feature-flags/SKILL.md` (already written, no plan action needed — just follow it for the add/retire workflow shape).

## Global Constraints

- No local migrations folder in this repo — schema changes go directly against the live shared Supabase project (`jgksopmbfttqqngrsama`) via the `supabase-migration` skill's Supabase MCP tools. Confirm the exact SQL with the user before calling `apply_migration`, even though the shape was already approved in the design spec — this project's convention is a final confirm at apply time on every migration, not just at design time.
- Any new Postgres function must pin `search_path = ''` (this project's standing SECURITY DEFINER/trigger hardening convention — see CLAUDE.md's "Security" notes and prior phases' migrations).
- RLS: `select` open to `anon` + `authenticated`; **no** `insert`/`update`/`delete` policies for either — all writes happen via the Supabase dashboard (service role bypasses RLS), per the confirmed "dashboard only" decision in the spec.
- `rollout_percentage` defaults to **0** (ships dark), not 100 — a deliberate reversal of the original v1.0 sketch's default.
- `target_cities` is **structural only** right now — no city data source exists yet (Phase 13/14 work). The hook must fail closed (return `false`) whenever `target_cities` is non-empty, regardless of role/rollout.
- The hook fails closed — returns `false` — on: query still loading, no matching row, `enabled = false`, role mismatch, non-empty `target_cities`, or no signed-in user id to bucket against.
- Percentage bucketing hashes `` `${key}:${userId}` ``, not just `userId` — two independent flags both at 50% must not select the same users.
- Follow the existing feature-folder convention: `src/features/flags/{api,lib,hooks}/...`, `@/` path alias, no inline hex/magic numbers (n/a here — no UI in this step).
- **One commit for this entire step**, made at the end of Task 4 — not one commit per task. Every prior Phase 11 step (1 through 9) landed as exactly one commit each (see `git log --oneline`); this step follows the same convention regardless of how many tasks the plan below is broken into.
- **This repo has no unit-test framework** (no Jest/Vitest — `package.json` only has `test:e2e` via Maestro, confirmed by inspection). Every other TanStack Query hook in this codebase (`src/features/*/hooks/*`) is verified by type-checking + manual Simulator/Maestro checks, not unit tests. This plan follows that same pattern rather than introducing a new test framework for one feature — verification below is SQL-based (for the trigger) and manual-Simulator-based (for the hook), both concrete and executable, not placeholders.

---

### Task 1: `feature_flags` table, trigger, and RLS

**Files:** none in-repo (applied via Supabase MCP) — `src/shared/supabase/database.types.ts` gets regenerated at the end of this task.

**Interfaces:**
- Produces: table `public.feature_flags` with columns `key text primary key`, `description text`, `enabled boolean not null default false`, `rollout_percentage int not null default 0`, `target_roles text[] not null default '{}'`, `target_cities text[] not null default '{}'`, `created_at timestamptz not null default now()`, `enabled_at timestamptz`. Consumed by Task 2's `fetchFeatureFlag`.

- [ ] **Step 1: Check current state**

Use the Supabase MCP `list_tables` tool to confirm `feature_flags` doesn't already exist in the `public` schema. (Established convention — see the `supabase-migration` skill's step 1: never write a migration from memory of what the schema "should" be.)

- [ ] **Step 2: Confirm the SQL with the user**

Present this exact SQL in plain language and get explicit confirmation before applying — schema changes to the shared live project are a stop-and-confirm action regardless of prior design approval:

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

alter table public.feature_flags enable row level security;

create policy "feature_flags_select_all"
on public.feature_flags
for select
to anon, authenticated
using (true);

create or replace function public.set_feature_flag_enabled_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.enabled = true and new.rollout_percentage = 100 then
    if tg_op = 'INSERT' then
      new.enabled_at := now();
    elsif old.enabled_at is null then
      new.enabled_at := now();
    end if;
  else
    new.enabled_at := null;
  end if;
  return new;
end;
$$;

create trigger feature_flags_set_enabled_at
before insert or update on public.feature_flags
for each row
execute function public.set_feature_flag_enabled_at();
```

Note on the trigger: it branches on `tg_op = 'INSERT'` before ever touching `old.enabled_at`, because referencing `OLD` inside a `BEFORE INSERT` firing (this trigger fires on both insert and update) raises `record "old" is not assigned yet` — this avoids that entirely rather than relying on boolean short-circuit evaluation order, which Postgres doesn't guarantee.

- [ ] **Step 3: Apply the migration**

Use the Supabase MCP `apply_migration` tool with `name: "phase11_step10_feature_flags"` and the SQL above.

- [ ] **Step 4: Check advisors**

Run the Supabase MCP `get_advisors` tool (type: `security`). Fix anything it flags before continuing — recurring findings in this project have been extensions installed in the wrong schema and SECURITY DEFINER functions left executable by `anon`/`authenticated` (n/a here, this function isn't SECURITY DEFINER, but check anyway).

- [ ] **Step 5: Regenerate TypeScript types**

```bash
npm run types:supabase
```

Confirm `src/shared/supabase/database.types.ts` now has a `feature_flags` entry under `public.Tables` with the columns from Step 2.

- [ ] **Step 6: Insert a temporary test row and verify the trigger**

Via the Supabase MCP `execute_sql` tool, run each of these in order, checking the stated result after each:

```sql
insert into public.feature_flags (key, description, enabled, rollout_percentage)
values ('_plan_verification_flag', 'temporary row for Phase 11 Step 10 verification — delete by end of Task 4', false, 0);
```
Expect: `enabled_at` is `null` (confirm with a `select`).

```sql
update public.feature_flags set enabled = true, rollout_percentage = 100 where key = '_plan_verification_flag';
```
Expect: `enabled_at` is now set to a real timestamp (`select key, enabled_at from public.feature_flags where key = '_plan_verification_flag';`).

```sql
update public.feature_flags set rollout_percentage = 50 where key = '_plan_verification_flag';
```
Expect: `enabled_at` is back to `null` — a rollback below 100% resets the stability clock.

```sql
update public.feature_flags set rollout_percentage = 100 where key = '_plan_verification_flag';
```
Expect: `enabled_at` is set again (a fresh timestamp, later than the first one).

Leave this row in place — Task 4 reuses it for the hook's integration check, and deletes it as its final cleanup step. Do not delete it now.

- [ ] **Step 7: Do NOT commit yet**

Per the Global Constraints above, this whole step lands as a single commit at the end of Task 4. Leave the regenerated `database.types.ts` as an uncommitted working-tree change for now.

---

### Task 2: Data-access layer — `fetchFeatureFlag`

**Files:**
- Create: `src/features/flags/api/feature-flags.ts`

**Interfaces:**
- Consumes: `supabase` client from `@/shared/supabase/supabase`; `Database['public']['Tables']['feature_flags']['Row']` type from `@/shared/supabase/database.types` (generated in Task 1).
- Produces: `export type FeatureFlag = { key: string; enabled: boolean; rollout_percentage: number; target_roles: string[]; target_cities: string[] }`; `export async function fetchFeatureFlag(key: string): Promise<FeatureFlag | null>`. Consumed by Task 3's `useFeatureFlag` hook.

- [ ] **Step 1: Write the file**

```ts
import { supabase } from '@/shared/supabase/supabase';

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  target_cities: string[];
};

export async function fetchFeatureFlag(key: string): Promise<FeatureFlag | null> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, rollout_percentage, target_roles, target_cities')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching feature flag "${key}":`, error);
    return null;
  }
  return data;
}
```

(`description`, `created_at`, `enabled_at` aren't selected — nothing on the client needs them; the retirement query in the `feature-flags` skill runs directly against Postgres, not through this function.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors. (`feature_flags` must already appear in `database.types.ts` from Task 1, Step 5 — if `.select(...)` on an unrecognized table/column errors, Task 1's type regeneration didn't take; re-run it before continuing.)

- [ ] **Step 3: Lint**

```bash
npx eslint src/features/flags/api/feature-flags.ts
```
Expected: clean.

---

### Task 3: Bucketing helper + `useFeatureFlag` hook

**Files:**
- Create: `src/features/flags/lib/hash-bucket.ts`
- Create: `src/features/flags/hooks/use-feature-flag.ts`

**Interfaces:**
- Consumes: `fetchFeatureFlag`, `FeatureFlag` from `@/features/flags/api/feature-flags` (Task 2); `useAuthStore` from `@/features/auth/stores/auth-store`.
- Produces: `export function hashToBucket(input: string): number` (0–99, deterministic); `export function useFeatureFlag(key: string): boolean`. This is the step's actual deliverable — every future feature wraps its risky code path in this hook.

- [ ] **Step 1: Write the bucketing helper**

```ts
// Hash key+userId, not just userId — keeps independent flags' rollout buckets from correlating.
export function hashToBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}
```

- [ ] **Step 2: Verify the helper's determinism and independence manually**

This repo has no unit-test runner, and this function is plain, dependency-free arithmetic — verify it directly with a throwaway `node -e` check (paste the same logic as inline JS):

```bash
node -e '
function hashToBucket(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}
console.log("same input twice:", hashToBucket("flag_a:user1"), hashToBucket("flag_a:user1"));
console.log("two flags, same user:", hashToBucket("flag_a:user1"), hashToBucket("flag_b:user1"));
console.log("range check (100 samples 0-99):", Array.from({length: 5}, (_, i) => hashToBucket("flag_a:user" + i)));
'
```

Expected: the first line prints the same number twice (determinism). The second line prints two *different* numbers in the general case (confirms `flag_a`/`flag_b` don't correlate for the same user — if they happen to collide by chance, rerun with a different pair of flag/user strings before concluding it's wrong). The third line prints 5 numbers all within 0–99.

- [ ] **Step 3: Write the hook**

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchFeatureFlag } from '@/features/flags/api/feature-flags';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { hashToBucket } from '@/features/flags/lib/hash-bucket';

export const featureFlagKey = (key: string) => ['feature-flags', key] as const;

export function useFeatureFlag(key: string): boolean {
  const userId = useAuthStore((state) => state.session?.user.id);
  const role = useAuthStore((state) => state.profile?.role ?? null);

  const { data: flag, isLoading } = useQuery({
    queryKey: featureFlagKey(key),
    queryFn: () => fetchFeatureFlag(key),
  });

  if (isLoading || !flag || !userId) return false;
  if (!flag.enabled) return false;
  if (flag.target_roles.length > 0 && (!role || !flag.target_roles.includes(role))) return false;
  // target_cities is structural only until Phase 14 adds a real city source
  // (see docs/superpowers/specs/2026-08-08-feature-flags-design.md) — fail
  // closed rather than guess who's in a targeted city.
  if (flag.target_cities.length > 0) return false;

  return hashToBucket(`${key}:${userId}`) < flag.rollout_percentage;
}
```

No `staleTime` override — this matches every other hook in `src/features/*/hooks/` (see `use-conversations.ts`), which rely on `QueryProvider`'s global 2-minute default (`src/shared/components/query-provider.tsx`) rather than setting one per hook.

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint src/features/flags/lib/hash-bucket.ts src/features/flags/hooks/use-feature-flag.ts
```
Expected: both clean.

---

### Task 4: Integration verification, checkpoint, cleanup, commit

**Files:**
- Modify (temporarily, reverted before commit): `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useFeatureFlag` from Task 3, the `_plan_verification_flag` row from Task 1.
- Produces: nothing new — this task only verifies Tasks 1–3 work together end-to-end, then commits the whole step.

- [ ] **Step 1: Temporarily wire the hook into a running screen**

Open `app/(tabs)/profile.tsx` (already the app's de facto smoke-test screen — see `maestro/phase1-profile-smoke.yaml`). Add, near the top of the component body:

```ts
import { useFeatureFlag } from '@/features/flags/hooks/use-feature-flag';
```

and inside the component function:

```ts
console.log('[flag debug]', useFeatureFlag('_plan_verification_flag'));
```

- [ ] **Step 2: Confirm the dev server is fresh**

```bash
ps aux | grep -E "expo start|metro|expo run:ios" | grep -v grep
```
If more than one process matches, kill the stale ones first — this repo has twice had a stale `expo start`/`expo run:ios` process silently serve old code to an entire manual/Maestro check (see CLAUDE.md's Phase 7 and Phase 9 entries). Start (or confirm) `npx expo start` shows a real full bundle line before trusting the next steps.

- [ ] **Step 3: Run the 5-case verification matrix**

For each case, update `_plan_verification_flag` via the Supabase MCP `execute_sql` tool, then reload the app in Simulator (shake → Reload, or `r` in the Expo CLI) and check the `[flag debug]` line in the Metro log:

| # | SQL | Expected log |
|---|-----|---------------|
| 1 | `update public.feature_flags set enabled = false, rollout_percentage = 100, target_roles = '{}', target_cities = '{}' where key = '_plan_verification_flag';` | `false` (kill switch wins even at 100%) |
| 2 | `update public.feature_flags set enabled = true, rollout_percentage = 100 where key = '_plan_verification_flag';` | `true` (fully on) |
| 3 | `update public.feature_flags set target_roles = '{owner}' where key = '_plan_verification_flag';` (assuming the signed-in test account's `profiles.role` is not `'owner'` — check with `select role from public.profiles where id = '<the signed-in user id>';` first) | `false` (role mismatch) |
| 4 | `update public.feature_flags set target_roles = '{}', target_cities = '{Hyderabad}' where key = '_plan_verification_flag';` | `false` (fail-closed on `target_cities`, even though `rollout_percentage` is still 100) |
| 5 | `update public.feature_flags set target_cities = '{}', rollout_percentage = 0 where key = '_plan_verification_flag';` | `false` (0% rollout) |

If any case doesn't match, the bug is in Task 3's branch order (Global Constraints lists the exact fail-closed order: `enabled` → `target_roles` → `target_cities` → `rollout_percentage`) — fix `use-feature-flag.ts` and re-run the failing case before continuing.

- [ ] **Step 4: Run the foundation-step-checkpoint static checks**

```bash
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```
Expected: both clean (same pre-existing `.expo/types/router.d.ts` warning exception as every prior step).

- [ ] **Step 5: Run the one plausibly-affected Maestro flow**

```bash
export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"
maestro test maestro/phase1-profile-smoke.yaml
```
This step has no UI of its own (it's infrastructure future features will consume), so the full 12-flow suite isn't warranted — but Step 1 above touched `profile.tsx`, so this flow is the relevant regression check. Expected: green.

- [ ] **Step 6: Revert the temporary debug wiring**

Remove the `console.log('[flag debug]', ...)` line and the `useFeatureFlag` import added in Step 1. Confirm `git diff app/\(tabs\)/profile.tsx` is empty.

- [ ] **Step 7: Delete the test flag row**

```sql
delete from public.feature_flags where key = '_plan_verification_flag';
```
Via the Supabase MCP `execute_sql` tool. Confirm with a `select * from public.feature_flags;` that the table is empty — it should be, since this step ships the mechanism, not any actual flag (the first real flag gets created by whichever future feature needs a kill switch, per the `feature-flags` skill).

- [ ] **Step 8: Commit**

```bash
git add src/features/flags src/shared/supabase/database.types.ts
git status
```
Confirm only the expected files are staged (the three new files under `src/features/flags/` plus the regenerated types file — `profile.tsx` should show no diff per Step 6).

```bash
git commit -m "$(cat <<'EOF'
Phase 11 Step 10: feature flags (kill switch, rollout %, lifecycle)

New public.feature_flags table (enabled kill switch, rollout_percentage
ramp, target_roles, target_cities structural-only-for-now) plus a
trigger that stamps enabled_at once a flag is fully live, backing the
30-day retirement query documented in the feature-flags skill.

useFeatureFlag(key) hook (src/features/flags) evaluates enabled ->
target_roles -> target_cities -> rollout_percentage, failing closed at
every branch, with per-flag-independent percentage bucketing (hashes
key+userId so two flags at the same rollout % don't select the same
users).

No flag exists yet — this ships the mechanism; the first real flag
comes from whichever future feature needs it.
EOF
)"
git log --oneline -1
```

---

## Self-Review

**Spec coverage:** Schema (Task 1) ✓, hook + fail-closed semantics + independent bucketing (Task 3) ✓, `target_cities` structural-only behavior (Task 3 Step 3, Global Constraints) ✓, lifecycle/`enabled_at` trigger (Task 1) ✓, dashboard-only writes / RLS (Task 1) ✓, `rollout_percentage` defaults to 0 (Task 1 Step 2 SQL) ✓, skill reference (spec front matter, no separate task needed since it's already written) ✓. Nothing in the spec's "Out of scope" section (admin UI, real city resolution, automated retirement enforcement) has a task here, correctly.

**Placeholder scan:** no TBD/TODO; every step has literal SQL/TS/bash, not descriptions of what to write.

**Type consistency:** `FeatureFlag` (Task 2) has the same 5 fields the hook (Task 3) destructures (`enabled`, `rollout_percentage`, `target_roles`, `target_cities`, `key`); `featureFlagKey`/`hashToBucket`/`useFeatureFlag`/`fetchFeatureFlag` names are used identically wherever referenced across tasks.
