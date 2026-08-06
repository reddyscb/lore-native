---
name: phase-wrapup
description: Use when a lore-native development phase (per CLAUDE.md's Phase plan) is functionally complete and needs verification before being called done. Runs typecheck/lint/the full Maestro suite, updates CLAUDE.md, and hands back a manual test checklist.
---

# Phase wrap-up

The established rhythm for this project: build a phase, then verify it end-to-end
before declaring it done — never mark a phase complete on the strength of code
review alone. Follow these steps in order.

## 1. Static checks

```
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

Fix anything real. A pre-existing warning in `.expo/types/router.d.ts` (an
auto-generated file) is not yours to fix.

## 2. Native rebuild check

If this phase added or upgraded a native module (anything needing an `app.json`
plugin entry), confirm `npx expo run:ios` has actually been run since — a JS-only
reload will not pick up new native code. Note: a native rebuild wipes the
Simulator's signed-in session (SecureStore's Keychain item is tied to the
install), so the user needs to sign in again before Maestro can run.

## 3. Full regression suite

```
export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"
npm run test:e2e
```

This needs a booted Simulator with the app installed and a signed-in session
already present — ask the user to confirm both if unsure.

**If anything fails, do not assume it's a regression in the code you just
wrote.** Check the actual failure screenshot before forming a hypothesis:

```
find ~/.maestro/tests -maxdepth 2 -newer <some-recent-timestamp>
```

or just look at the most recent timestamped directories under
`~/.maestro/tests/`. Each failed step has a
`screenshots/step-NNN-....png` — read it before guessing.

Cross-check against CLAUDE.md's "Gotchas hit building this suite" list first.
Real prior causes of flow failures that were *not* code regressions:
- Accumulated test/seed data pushing a target element below a flow's fixed
  scroll amount (fix: `scrollUntilVisible` instead of a bare `tapOn`).
- A `console.warn` anywhere in mount-time code surfacing React Native's
  "Open debugger to view warnings" banner over the tab bar, swallowing the
  first tap on it for several seconds after every launch — not
  Maestro-specific, reproduces with real touches too.
- Seeding an app screenshot as test media — iOS Live Text exposes its
  on-screen text as accessibility text, which can falsely match a Maestro
  `.*wildcard.*` selector.

Only conclude a real regression once environmental/test-data causes are ruled
out. If you do find and fix a real regression, add it to this list as a new
gotcha once resolved.

## 4. Update CLAUDE.md

- Add a `- **Phase N — done, verified ...**` bullet to the "Phase plan" section,
  matching the existing style: what shipped, why, key implementation details
  (new tables/RLS, new files, notable gotchas), and exactly how it was
  verified (don't just say "tested" — say what was actually exercised, and
  call out anything that couldn't be, e.g. features that need a physical
  device).
- Remove the item from the "Later" list if it was on there.
- If step 3 surfaced a new, non-obvious gotcha, add it to "Regression
  testing" in the same style as existing entries (root cause, how it was
  diagnosed, the fix, what to watch for next time).

## 5. Do not commit automatically

Only commit when the user explicitly asks, per this project's standing
convention — verification and documentation are not, by themselves, a
request to commit.

## 6. Hand back a manual test checklist

Short, concrete, checkbox-style. Include anything Maestro structurally can't
cover (OAuth/OTP flows, native picker sheets, physical-device-only features
like real push notification delivery) so the user knows exactly what's left
for them to eyeball.
