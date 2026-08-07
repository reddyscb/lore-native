# Phase 11 — Architecture Foundation (design)

**Status:** approved, ready for implementation planning.
**Motivation:** proactive, not reactive. The app is feature-complete
through Phase 9 but was built linearly by one person with no server-state
caching layer, a single god-file data layer (`lib/queries.ts`), no
generated Supabase types, no error boundaries, no crash/analytics
visibility, and no CI/CD. None of that is blocking any shipped feature
today, but all of it will compound as the app grows toward App Store
submission and real users. This phase closes that gap before it gets more
expensive to close.

**Source document:** the full original analysis (gap assessment, all 10
foundation steps with code samples, post-foundation enhancements, App
Store submission path, decision log) is preserved verbatim as
`docs/superpowers/specs/lore-native-foundation-roadmap.md` (v1.0) in this
same directory. This file captures the plan CLAUDE.md actually tracks —
the sequencing below supersedes that source document's Part 3/Part 6
ordering per the review that follows.

**Revision (2026-08-07, same day):** a v2.1 revision of the source
document (`docs/superpowers/specs/lore-native-foundation-roadmap-v2.1.md`)
added a product-vision/audience framing that reprioritizes FlashList to
critical-path severity, plus a new content-strategy and long-term
infrastructure track that don't belong in this phase. See
`docs/superpowers/specs/2026-08-07-phase12-14-roadmap-revision-design.md`
for the full diff and how it was reconciled — the only change it made to
*this* phase was reinstating FlashList (§ below); Apple Sign-In and the
content/data-strategy work it also surfaced were deliberately kept out of
Phase 11's scope and pushed to Phases 12 and 14 respectively.

## The final goal

Two goals bundled together, not one:

1. **Architectural scalability.** Move from "works for one developer
   building linearly" to a structure that supports more features and more
   engineers without the god-file/no-caching/no-type-safety problems
   compounding: generated Supabase types, feature-based folders, TanStack
   Query for server state, Zustand for client state, error boundaries.
2. **Store-readiness.** This app has never been submitted. Some of Part 2's
   gaps are not just "nice to have for scale" — they're things Apple
   requires or that you'd be flying blind without: a missing
   `PrivacyInfo.xcprivacy` is an automatic rejection; zero crash reporting
   means the first sign of a production bug is a 1-star review.

## Review findings: the source plan's sequencing doesn't match its own severity ratings

The original roadmap's Part 2 gap table rates gaps by severity
(🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low), but Part 3's 10-step execution
order doesn't follow that rating — it's ordered by architectural layering
instead (types → folders → query → state → errors → observability → flags
→ CI/CD → FlashList). That creates three concrete problems:

1. **Store-blocking items sit too late.** `PrivacyInfo.xcprivacy` and
   Sentry are rated 🔴 Critical-for-store and 🟠 High respectively, but
   don't land until Step 7 — after a multi-day data-layer rewrite that has
   nothing to do with store readiness.
2. **Zero-risk, high-leverage work sits too late.** CI/CD (`tsc` + `eslint`
   on every PR) requires no app-code changes at all, yet is Step 9. Running
   it *before* the big refactor (Steps 2–5) means every risky step gets an
   automated regression check for free, instead of the refactor happening
   unguarded.
3. **Severity and order disagree outright.** Zustand is rated 🟢 Low
   severity in Part 2 but is Step 5 of 10 — ahead of error boundaries
   (🟠 High) and crash reporting (🟠 High).
4. **Step 2 (folder restructure) and Step 3 (TanStack Query) are
   combined-risk.** Moving every file *and* rewriting its data-fetching in
   the same stretch means a regression can't be attributed to "the move"
   vs. "the rewrite." They should be sequential, not interleaved — convert
   one screen to TanStack Query in place first to prove the pattern, then
   do the folder move as a separate, purely mechanical pass.

## Revised sequencing

Same 10 steps and content as the source document, reordered, **plus
FlashList reinstated as an 11th step** (see below):

1. **Generate Supabase types** (source Step 1 — unchanged, cheap and
   high-value first move)
2. **CI/CD** (source Step 9, moved up) — `eas.json` + a GitHub Action
   running `tsc --noEmit` + `eslint` on every PR. No app-code changes
   required; this becomes the regression net for every step after it.
3. **Sentry + Privacy Manifest** (source Step 7, split — PostHog/ATT can
   wait, but crash reporting and `PrivacyInfo.xcprivacy` are store-blocking
   and independent of the data layer)
4. **Error boundaries** (source Step 6, moved up — pairs naturally with
   Sentry, both are about visibility/resilience, and neither depends on
   the query-layer rewrite)
5. **Add TanStack Query + proof of concept on one screen** (source Step 3,
   done *in place*, no folder move yet)
6. **Feature-based folder restructure** (source Step 2, moved after the
   query POC — now a mechanical move of an already-proven pattern)
7. **Migrate remaining features to TanStack Query** (source Step 4)
8. **FlashList migration** (source Step 10, reinstated — see below) —
   slotted immediately after Step 7 because that's the step that already
   touches every list screen's data-fetching; converting
   `FlatList`→`FlashList` in the same pass avoids touching each list
   screen a second time later, and each screen's `estimatedItemSize` is
   easiest to get right right after its query shape has settled.
9. **Zustand for auth state** (source Step 5 — moved to match its actual
   Low severity rating, after the higher-value work)
10. **Feature flags** (source Step 8 — unchanged position, genuinely
    depends on having Zustand's `useAuthStore` for role targeting; gains
    a `target_cities text[]` column per the v2.1 revision, for the
    city-by-city rollout geo-gating described in Phase 14)
11. **PostHog + ATT** (remainder of source Step 7)

**FlashList is back in the critical path (Step 8 above), reversing this
doc's original decision to demote it.** The original rationale still
holds on its own terms — Phase 9's profiling
(`docs/superpowers/plans/phase9-profiling/`) found no jank to fix at
current (tiny) dev-data volume, so there's no *measured* urgency. But the
v2.1 revision's audience framing (college students scrolling infinitely,
TikTok/Instagram-trained expectations) makes an explicit product-priority
argument for treating it as non-negotiable ahead of launch rather than
opportunistic scale headroom, and that call was made deliberately by the
user rather than deferred to profiling data — see
`2026-08-07-phase12-14-roadmap-revision-design.md` for the full
reasoning.

## Execution notes

- **Sequential, not subagent-driven.** Per established preference in this
  project (Phase 8's mid-session switch away from
  `superpowers:subagent-driven-development` to reduce session cost), this
  phase should be worked step-by-step in the main session, not dispatched
  to fresh implementer/reviewer subagents per step.
- **Each step needs its own regression gate**, not just one checklist at
  the end. Given this repo's documented history of stale-dev-server and
  Maestro-flakiness incidents (Phases 7 and 9), a multi-day refactor
  touching every screen needs `tsc` + `eslint` + the relevant Maestro
  flows re-verified after each step — otherwise a regression introduced in
  Step 5 might not surface until Step 10's final check, with no way to
  tell which step caused it.
- **Success criteria** are the same as the source document's Section 3.3
  checklist, reordered to match the sequencing above.
