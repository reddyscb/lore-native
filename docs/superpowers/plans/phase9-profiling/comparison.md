# Phase 9 profiling — before vs. after comparison

Same methodology, same 4 screens, same seed data (Ruskin & Rye for café
detail, the "sree" thread for messages) as the baseline in `before/`.
`xctrace` was dropped from the methodology entirely (see `before/README.md`)
— this comparison is FPS-only, read from RN's in-app Perf Monitor overlay
during a scripted 3-swipe scroll.

## Environment issue found during Task 12, and how it was handled

While running the full Maestro suite (Task 12), every one of the 12 flows
failed identically at the very first launch assertion with a `ConfigError`
screen. Root cause: a leftover `expo run:ios` process from an unrelated,
already-deleted git worktree (`.claude/worktrees/dm-feature`) had been
holding the installed dev client's bundler connection since before this
session started — the same "stale dev server silently hijacks the run"
gotcha CLAUDE.md already documents from Phase 7, just with a broken
worktree instead of a working-but-wrong one this time.

That process was running for the entire "before" capture (Task 1) and for
the first "after" capture (Task 11) — so both are of uncertain provenance
(see `before/README.md`). Once found, the stray process was killed, a
correct Metro server was started for this actual checkout, and it was
verified via a real bundle log (`Bundled 3178ms node_modules/expo-router/
entry.js (1505 modules)`) before doing anything else. The full Maestro
suite was then re-run against the correct server (see the plan's
execution log for the 9/12-pass result, all 3 non-passes matching
CLAUDE.md's already-documented pre-existing causes, none a regression from
this phase). **The "After (verified)" column below was captured a third
time, after that fix, and is the trustworthy one** — same 4 screens, same
scripted-scroll methodology, screenshots in `after/`.

| Screen | Before (unverified — see caveat) | After (verified, correct server) | Change |
|---|---|---|---|
| Home feed | UI 60 / JS 59 | UI 60 / JS 60 | No measurable change — already at ceiling. |
| Café detail (Ruskin & Rye) | UI 60/60 mid-scroll, dipped to 54/56 right at the page transition | UI 60 / JS 60, no dip observed | No regression; see caveat below on whether the dip's disappearance means anything. |
| Explore | UI 60 / JS 60 | UI 60 / JS 60 | No measurable change — still only 4 seed places, list barely scrolls. |
| Messages thread (sree) | UI 60/57 at rest, 60/60 scrolling | UI 60 / JS 60 (59/60 momentarily at rest before settling) | No measurable change — same single-message thread. |

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
number that moved at all between runs. Given the before-fix capture's
provenance is now in question (see above), this can't be attributed to the
code changes with any confidence — it's just as plausibly an artifact of
whatever the stale dev server was actually serving, or ordinary run-to-run
Simulator noise. Not treating it as evidence of anything either way.

**Bottom line:** the only profiling data this phase can actually stand
behind is the verified-correct "after" column — and it shows the app at a
clean 60/60fps ceiling on all 4 target screens with the Phase 9 fixes in
place. There's no trustworthy "before" to compare it against anymore, but
given the "after" numbers show no jank at all, the practical conclusion
from `before/README.md` still holds: the dev seed data is too small to
produce a measurable FPS problem regardless of these fixes, so this
phase's value is scalability headroom and image-caching behavior for
larger real-world datasets, not a proven today-vs-yesterday speedup.
