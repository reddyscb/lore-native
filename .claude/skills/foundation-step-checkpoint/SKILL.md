---
name: foundation-step-checkpoint
description: Use after completing one step of Phase 11's architecture foundation plan (docs/superpowers/specs/2026-08-07-architecture-foundation-design.md) — a lightweight per-step regression gate, lighter than phase-wrapup, so a bad step is caught immediately instead of at the end of a multi-day refactor.
---

# Foundation step checkpoint

Phase 11's design doc calls for this explicitly: "each step needs its own
regression gate, not just one checklist at the end... a multi-day refactor
touching every screen needs `tsc` + `eslint` + the relevant Maestro flows
re-verified after each step — otherwise a regression introduced in Step 5
might not surface until Step 10's final check, with no way to tell which
step caused it."

This skill is that per-step gate. It is deliberately smaller than
`phase-wrapup` — it does not update CLAUDE.md or hand back a manual test
checklist, because the *phase* (Phase 11) isn't done yet, just one step of
it. Run `phase-wrapup` once all 10 steps land.

## 1. Static checks

```
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

Zero tolerance here — a type or lint error introduced by this step should
never be left for a later step to find. Same exception as `phase-wrapup`:
the pre-existing `.expo/types/router.d.ts` warning isn't yours to fix.

## 2. Confirm the step's own success criteria

Each step in the design doc's revised sequencing has a stated success
criterion (e.g. "Home screen loads drops via TanStack Query, pull-to-
refresh works, creating a drop updates the feed automatically" for the
TanStack Query POC step). Verify that specific criterion manually before
moving on — don't just trust that the code compiles.

## 3. Run only the Maestro flows this step could plausibly affect

Not the full 12-flow suite — that's `phase-wrapup`'s job at the end of the
phase. Pick the flows that touch whatever this step changed:

```
export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"
maestro test maestro/<relevant-flow>.yaml
```

Before running, do the same dev-server freshness check `phase-wrapup` does
— this repo has twice had a stale `expo start`/`expo run:ios` process
silently serve old code to an entire Maestro run:

```
ps aux | grep -E "expo start|metro|expo run:ios" | grep -v grep
```

If more than one matches, kill the stale ones and confirm a fresh
`npx expo start` shows a real full bundle line before trusting results.

## 4. If a step touches every screen (e.g. the TanStack Query migration or
   the feature-folder restructure), don't wait for step-end to check

For steps that are themselves multi-day, checkpoint after each
feature/screen migrated within the step, not just once the whole step is
"done." A restructure step that silently breaks screen 3 of 8 should be
caught at screen 3, not after all 8 are moved.

## 5. Do not update CLAUDE.md yet

Only `phase-wrapup`, once the full phase is complete, updates CLAUDE.md's
Phase plan section. A single step landing cleanly is not phase completion.

## 6. Report status plainly

State which step just completed, what was verified, and what's next in
the sequencing — so the user (or the next session) can pick up exactly
where this left off without re-deriving it from the design doc.
