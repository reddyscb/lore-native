# Phase 9 — Performance Polish Pass (design)

**Status:** approved, ready for implementation planning.
**Motivation:** proactive. No specific screen has a known lag complaint —
this is the "dedicated polish pass (list virtualization, image caching,
transition tuning)" item CLAUDE.md's phase plan already calls out as the
step before store submission prep.

## Current state (read from the codebase, not assumed)

Before drafting fixes, the actual gaps were confirmed by reading every
list/image/navigation site in the app, not guessed from the phase-plan
wording:

- **Lists:** every list screen already uses `FlatList` except
  `app/events.tsx`, which renders its events via `ScrollView` + `.map()` —
  fully unvirtualized. Every existing `FlatList` (Home, Explore, Passport,
  Diary, Collections, Owner dashboard, Messages inbox/thread) defines
  `renderItem`/`keyExtractor` as an inline closure (recreated every render)
  and sets no tuning props (`initialNumToRender`, `windowSize`,
  `removeClippedSubviews`, `maxToRenderPerBatch`). Row components
  (`DropCard`, `PlaceListItem`, `ReplyRow`) are not `React.memo`-wrapped, so
  any parent re-render re-renders every currently-rendered row regardless
  of whether that row's own data changed.
- **Images:** every image already renders through `expo-image` (not RN's
  `Image`) — `Avatar`, `MediaStrip`, café-detail/dish photos. None of them
  set an explicit `cachePolicy`, relying on the library default. List-
  recycled images (feed thumbnails, avatars in a scrolling list) have no
  `recyclingKey`, which can let a recycled row briefly show the previous
  row's image before the new source loads.
- **Navigation:** Expo Router's native Stack (`react-native-screens`) is
  already in use everywhere, so push/pop transitions are native by default.
  `pushedScreenOptions` in `app/_layout.tsx` sets header styling but no
  explicit `animation` or gesture config — worth a review pass, not a
  rewrite, since there's no evidence anything is actually broken here.

## Scope

**In scope:**
1. Convert `app/events.tsx`'s list rendering from `ScrollView`+`.map()` to
   `FlatList`.
2. Add virtualization tuning props to every existing `FlatList` (Home,
   Explore, Passport, Diary, Collections, Owner dashboard, Messages
   inbox/thread, and the newly-converted Events).
3. `React.memo` the row components: `DropCard`, `PlaceListItem`,
   `ReplyRow`, and any other component rendered as a `FlatList` row.
   `useCallback` the `renderItem`/`keyExtractor` functions that render them.
4. Set an explicit `cachePolicy="memory-disk"` on every `expo-image` usage
   (`Avatar`, `MediaStrip`, café-detail/dish images). Add `recyclingKey`
   where an image renders inside a `FlatList` row.
5. Review `pushedScreenOptions` and per-screen `Stack.Screen` options in
   `app/_layout.tsx` for gesture/animation consistency; evaluate whether
   any push-based flow (compose, check-in) reads better as a modal
   presentation. Change only where there's a clear improvement — this is a
   review, not a mandate to change every screen's presentation style.
6. **Profiling loop** (see below) on the 4 media-heavy screens — Home feed,
   café detail, Messages thread, Explore search results — to measure
   whether 1–5 actually move the needle, not just assume they do.
7. Rewrite `README.md`'s "What's real in this build" section (and retire
   the stale Phase 1-only "What to check before moving to Phase 2"
   checklist) to reflect actual current state through Phase 9. This
   happens **last**, after the polish pass is verified, since it should
   describe the finished state of the app, not a snapshot mid-change.

**Out of scope (explicitly deferred, not forgotten):**
- Passport/Diary/Collections/Owner dashboard lists get the same tuning
  props (item 2) but are not part of the profiling loop — they're short,
  text-and-thumbnail lists with little room for real jank, and profiling
  every screen was explicitly ruled out in favor of the 4 media-heavy ones.
- Live Xcode Instruments GUI sessions — not drivable from this
  environment. Profiling uses `xcrun xctrace record`/`export` (CLI-only,
  no GUI) plus React Native's in-app Perf Monitor overlay instead. This is
  a real constraint, not a shortcut: it means some categories of insight
  (e.g. interactive flame-graph exploration) aren't available here, only
  aggregate/exported data.
- Image preloading/prefetching, skeleton loaders, new animation libraries,
  Android-specific tuning — none requested, none needed to close the gaps
  found above.

## Profiling methodology

For each of the 4 media-heavy screens (Home feed, café detail, Messages
thread, Explore results):

1. **Baseline (before any fix lands):**
   - Boot the Simulator, sign in, enable RN's in-app Perf Monitor (dev
     menu → Show Perf Monitor — shows JS and UI thread FPS).
   - Drive a scripted scroll through the screen's list (`idb ui swipe` or
     Maestro `swipe` — whichever proves more reliable once tried) with
     enough seed data present to require real scrolling (existing dev data
     plus any additional seed rows needed to get a meaningfully long list).
   - Screenshot the Perf Monitor readout at rest and mid-scroll; note the
     FPS numbers.
   - Capture one `xcrun xctrace record --template "Time Profiler"` trace
     during the same scripted scroll, then `xcrun xctrace export` it to
     inspect for obvious hot symbols (e.g. image decode work, JS thread
     stalls, excessive re-render).
2. **Apply the in-scope fixes** (items 1–5 above).
3. **Re-measure** with the identical scripted scroll and capture method on
   the same 4 screens.
4. **Compare before/after** — report the FPS numbers and any hot-symbol
   changes. If a screen shows no measurable difference, say so plainly
   rather than claiming an improvement that isn't there.

This is a real measurement loop against a known set of already-identified
gaps, not open-ended bottleneck hunting — the gaps in the "Current state"
section above were found by reading the code, and profiling exists here to
verify the fixes actually help (and catch anything the code-reading pass
missed), not to discover what to fix from scratch.

## Testing

- `npx tsc --noEmit` and `npx eslint . --ext .ts,.tsx` clean.
- `npm run test:e2e` — full Maestro suite must stay green. This pass
  changes performance characteristics, not user-facing behavior, so no new
  Maestro flow is needed and none of the existing ones should change
  behavior.
- Manual: the profiling loop above serves as this phase's manual
  verification (in place of a fresh device walkthrough), since the whole
  point is a measured before/after rather than a pass/fail checklist.

## Documentation

- Update CLAUDE.md's phase plan with a Phase 9 entry once implementation
  and verification are done (per established project convention —
  phase-wrapup skill / CLAUDE.md-over-summary preference).
- Rewrite `README.md` per item 7 above, last, after everything else is
  verified.
