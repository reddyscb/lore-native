---
name: maestro-flow-writer
description: Use when writing a new Maestro E2E flow (maestro/*.yaml) or debugging why an existing one fails in this repo. Packages the non-obvious gotchas CLAUDE.md's "Regression testing" section has accumulated across Phases 1-9 so they get applied automatically instead of re-discovered per flow.
---

# Maestro flow writer

This repo's Maestro suite (`maestro/*.yaml`, run via `npm run test:e2e`) has
hit the same handful of non-obvious failure modes repeatedly across phases.
Apply this checklist *before* writing a new flow or diagnosing a failing
one — most "regressions" that show up while writing a flow turn out to be
one of these, not a real app bug.

## Before writing a new flow

- **Text selectors are anchored, not substring.** This app's accessibility
  labels are often composite (`"Profile, tab, 5 of 5"`,
  `"The Copper Pot, Gachibowli, Open"`). Wrap selectors in
  `.*wildcards.*` unless you're matching a short, exact label.
- **`launchApp` alone doesn't reliably cold-restart JS state.** Add
  `stopApp` before it, or a screen can retain stale state from an earlier
  flow (e.g. Post tab still showing a previously-selected place).
- **Wrap the first interaction after `launchApp` in `extendedWaitUntil`**
  (15s timeout), not a bare `assertVisible`/`tapOn` — the accessibility
  snapshot can race the dev client's Metro reconnect right after launch.
- **Use `tapOn: "Back"` for the custom Stack header**, not the generic
  `back` command — it doesn't reliably trigger navigation here.
- **Add `keyboardShouldPersistTaps="handled"`** to any new scrollable
  container with an interactive element below a text input — its absence
  has been a real, fixed bug three times (Explore, Post's place picker,
  café detail's reply box), not just a test issue: a real user tapping a
  result right after typing needs to tap twice without it.

## Keyboard-dismiss gotchas (found the hard way — don't relearn these)

- **A tap on a distant element while the keyboard is still open can
  silently miscompute the hit point** — no error, just lands on the wrong
  thing (the still-focused field, or even a keyboard key). Always dismiss
  first:
  - Single-line field → `pressKey: Enter` (default `blurOnSubmit`).
  - Multiline field (Enter inserts a newline) → tap a plain, non-
    interactive `Text` on screen instead. `keyboardShouldPersistTaps:
    "handled"` only protects *interactive* elements from dismissing the
    keyboard, so inert text still blurs normally.
  - `hideKeyboard` is unreliable on this iOS Simulator/XCTest combo —
    don't rely on it as the fix.
- **A persistent iOS QuickType predictive-suggestion bar can intercept a
  tap on a button beneath it, and neither of the two fixes above clear
  it.** If a composer's Send button sits close to where a predictive
  suggestion pill renders, `tapOn` can register a stray keypress instead.
  No confirmed fix yet (five approaches tried and failed, see
  `phase8-messages.yaml`'s header comment) — the next untried idea is
  disabling `autoCorrect` on the field. Don't burn time re-trying the
  already-failed fixes (Enter blur, inert-Text blur, `index` selector,
  point-based tap, `pasteText`).

## Native UI Maestro can't drive at all

- **`Alert.alert` buttons**: `tapOn` by text reports `COMPLETED` but can
  silently fail to dismiss the dialog. Use a point tap instead:
  `idb ui describe-all` for the button's real frame, converted to a
  percentage of `idb describe`'s `screen_dimensions`
  (`width_points`/`height_points`) — don't eyeball from a screenshot.
- **Native photo/video picker sheets** (`expo-image-picker`) and **OAuth
  browser sheets** (Google sign-in) are OS UI, not app UI — only assert
  the trigger button renders; the picker/sheet interaction itself stays a
  manual Simulator check. Seed test media via
  `xcrun simctl addmedia <udid> <path>` — but never seed a screenshot of
  this app's own UI, since iOS Live Text will OCR its on-screen text into
  the media's accessibility label and can falsely match a
  `.*wildcard.*` tab-bar selector.

## Disambiguating identical-text elements

- **Composite-label cards** (place cards, tab bar items): the whole card
  is one `Pressable` with a combined accessibility label — a wildcard
  `tapOn` on distinguishing text usually works.
- **Plain `View` + separate button per row** (e.g. one "Manage" button per
  owned place, no combined label): a bare `tapOn: "Manage"` hits whichever
  matches first, not necessarily the right row. Use Maestro's relative
  selector: `tapOn: { text: "Manage", below: ".*<row identifier>.*" }`.
- **Duplicate seed data** (e.g. two profiles both named "sree"): use
  Maestro's `index` selector to pick a specific match.

## Environment preflight (do this before trusting any run, new flow or not)

- Confirm which dev server is actually serving the app — a stale
  `expo start`/`expo run:ios` process from an unrelated checkout has
  twice caused an entire run's results to be meaningless (see
  `phase-wrapup`'s preflight step for the exact check).
- Confirm no uncaught `console.warn` fires at mount time anywhere in the
  app — it surfaces React Native's "Open debugger to view warnings"
  banner directly over the tab bar, swallowing the first tap on it for
  several seconds after every launch, indistinguishable at first from a
  real navigation failure.

## When a flow fails

Don't assume it's a regression in whatever you just built. Check the
actual failure screenshot (`~/.maestro/tests/<timestamp>/screenshots/
step-NNN-*.png`) before forming a hypothesis, and cross-check against this
list and CLAUDE.md's "Real bugs this suite caught" note first. Only
conclude a real regression once every environmental/test-tooling cause
above is ruled out — then add the new gotcha to CLAUDE.md and, if it's a
pattern likely to recur, back to this skill.
