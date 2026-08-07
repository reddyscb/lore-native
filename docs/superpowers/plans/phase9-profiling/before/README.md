# Phase 9 baseline profiling — before fixes

Captured via RN's in-app Perf Monitor overlay (Simulator → Device menu →
Shake → "Show Perf Monitor"), reading live JS/UI FPS while driving a
scripted 3-swipe scroll on each screen via `idb ui swipe`.

`xcrun xctrace record` (Time Profiler) was attempted but dropped: it hung
indefinitely (12+ minutes on a 3-second recording request) with no error
output, almost certainly waiting on a one-time developer-tools
authorization dialog that can't be answered in this non-interactive
environment. Killed and not used for either the before or after capture —
per the plan's methodology section, this is a real environment constraint,
not a shortcut. FPS is the actual signal being tracked in this phase's
comparison.

| Screen | At rest | Mid-scroll (saved screenshot) | Notes |
|---|---|---|---|
| Home feed | — | UI 60 / JS 59 | Real seed data (~7 drops across a few places), scrolled cleanly. |
| Café detail (Ruskin & Rye) | UI 54 / JS 56 | UI 60 / JS 60 | Rest reading dipped slightly right after the page transition (images/data still settling in); steadied to 60/60 during the actual scroll. |
| Explore | UI 60 / JS 60 | UI 60 / JS 60 | Only 4 seed places exist — the full result set fits on one screen, so the "scroll" barely moved content. Virtualization has essentially nothing to prove here either way. |
| Messages thread (sree) | UI 60 / JS 57 | UI 60 / JS 60 | Thread has a single message — same small-dataset caveat as Explore. |

All 4 screens are already at or effectively at 60fps on both threads
before any changes in this phase — expected, given the dev seed data is
small (a handful of drops/places/messages, not the hundreds needed to
actually stress FlatList virtualization). The fixes in this phase
(memoization, stable callbacks, tuning props, image cache policy) are
still worth doing as correctness/scalability improvements for when real
usage grows the dataset, but this baseline should not be read as "the app
was janky before" — it wasn't, at this data volume. The after-fix
comparison (Task 11) will speak to whether these numbers hold, not to a
before/after jank fix, since there's no jank at this scale to fix.
