# Phase 9 profiling — before vs. after comparison

Same methodology, same 4 screens, same seed data (Ruskin & Rye for café
detail, the "sree" thread for messages) as the baseline in `before/`.
`xctrace` was dropped from the methodology entirely (see `before/README.md`)
— this comparison is FPS-only, read from RN's in-app Perf Monitor overlay
during a scripted 3-swipe scroll.

| Screen | Before (mid-scroll) | After (mid-scroll) | Change |
|---|---|---|---|
| Home feed | UI 60 / JS 59 | UI 60 / JS 60 | No measurable change — already at ceiling. |
| Café detail (Ruskin & Rye) | UI 60 / JS 60 (dipped to 54/56 right at the page transition, before settling) | UI 60 / JS 60 (no dip observed this run) | No regression; the transition-time dip seen in the baseline wasn't reproduced after the fixes, but one run each isn't enough to call that a confirmed improvement — see caveat below. |
| Explore | UI 60 / JS 60 | UI 60 / JS 60 | No measurable change — already at ceiling, and still only 4 seed places (list doesn't scroll far enough to stress anything). |
| Messages thread (sree) | UI 60 / JS 57 (at rest) / 60/60 (scroll) | UI 60 / JS 60 | No measurable change — same single-message thread. |

## Honest read

Every screen was already at or effectively at 60fps on both the JS and UI
threads *before* this phase's fixes, and stays there *after*. This is not
a "we found jank and fixed it" story — the dev seed data (a handful of
drops, 4 places, 1-2 messages per thread) is far too small to produce a
dropped frame on modern Simulator hardware regardless of whether
`FlatList` rows are memoized or not. Read that as: **this pass could not
prove a performance win from FPS numbers alone**, because there was no
measurable performance problem at this data volume to begin with.

That doesn't make the code changes pointless. What they actually buy:

- **Scalability headroom.** `React.memo` on every row component +
  `useCallback`-stabilized `renderItem`/`keyExtractor` means a re-render
  of a parent screen (e.g. a state update from a reply composer, a banner,
  a toast) no longer forces every currently-rendered row to re-render too.
  That only shows up as a real frame-rate difference once the dataset is
  large enough that "every visible row" is an expensive re-render — which
  the current seed data isn't, but real production usage over time will
  be.
- **`removeClippedSubviews`/`windowSize`/`initialNumToRender` tuning**
  bounds memory growth as a list grows past what fits on screen — again,
  invisible at 4-20 items, real at hundreds.
- **`cachePolicy="memory-disk"` on every image** avoids redundant network
  refetches on re-scroll/re-visit regardless of list size — this one *is*
  a real behavioral difference today, just not one FPS captures (it shows
  up as network requests saved, not frames).
- **`freezeOnBlur`** stops a pushed screen's background work (the
  household example: café detail's drop-reply state machinery) while it's
  covered by another screen — verified manually (Task 10) to not lose
  state across a two-level push/pop, but again not something a flat-list
  scroll FPS number would surface either way.

**Caveat on the one observed difference:** café detail's baseline rest
reading (54/56) vs. the after-fix rest reading (60/60, no dip) is the only
number that moved at all between runs. It's plausibly explained by the
memoization/cache changes reducing work right after the page transition,
but it's also plausibly just run-to-run Simulator noise — the transition
timing window is short and only one baseline and one after sample were
taken per screen, not enough runs to separate signal from noise. Reporting
it, not overclaiming it.
