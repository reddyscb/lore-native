# Phases 12–14 — Roadmap Revision (design)

**Status:** approved, ready for implementation planning (post-Phase-11).
**Motivation:** a v2.1 revision of the foundation/roadmap source document
(`docs/superpowers/specs/lore-native-foundation-roadmap-v2.1.md`) added a
product-vision/audience framing, a severity reprioritization, a new
cafe-content data strategy, and a long-term infrastructure part on top of
v1.0 (`lore-native-foundation-roadmap.md`, already tracked by Phase 11's
own design doc). This document reconciles what's new in v2.1 against the
plan CLAUDE.md actually tracks: most of it is additive, three points
conflicted with existing decisions or surfaced entirely new scope, and
one described feature (owner claim's document upload + admin approval)
doesn't match what Phase 7 actually shipped.

## What v2.1 changed, and how each was resolved

1. **FlashList severity flip** (Part 2.3 / Part 3.2 #8: Medium → Critical,
   audience-driven, no new profiling data). **Resolved:** reinstated into
   Phase 11's critical path as Step 8 — see
   `2026-08-07-architecture-foundation-design.md`'s "Revised sequencing"
   section for the reasoning and exact slot. Decided explicitly by the
   user rather than deferred to Phase 9's existing profiling data, which
   still shows no *current* jank.

2. **Apple Sign-In — a genuinely new gap** (v2.1 Part 7.4 flags it; not in
   v1.0 or Phase 11's design at all). App Store Guideline 4.8 requires
   offering Sign in with Apple whenever a third-party login (here, Google
   OAuth) is offered — this is a hard submission blocker, not a nice-to-have.
   **Resolved:** kept **out** of Phase 11 (architecture-only scope) and
   added to **Phase 12** (§ below) alongside the other store-submission
   prerequisites, since it's independent of the data-layer refactor and
   is closer in kind to Privacy Manifest / Sentry than to TanStack
   Query/Zustand work.

3. **Owner claim flow discrepancy.** v2.1's "What's Working Well" table
   (§1.2) and Part 6.2 describe self-service claiming as including
   business-registration/GST document upload and admin approval before
   `is_verified = true`. The actual Phase 7 build (CLAUDE.md) is a
   one-tap claim: no document upload, no approval step, `owner_id` set
   immediately. **Resolved:** confirmed as real, new scope (not an
   inaccuracy to silently correct) and added to **Phase 14** (§ below),
   since it's tightly coupled to the same `places` verification columns
   that phase already adds for the content-curation work.

4. **New content/data-strategy track** (v2.1 Part 6: manual curation of
   20–30 Hyderabad cafes, new `places` columns, OSM bulk-import path for
   future cities, content moderation policy) plus **legal/compliance
   prep** (v2.1 Part 7.5: ToS, Privacy Policy, DPDP awareness) had no home
   in the existing two-phase plan. **Resolved:** split into two new
   phases — **Phase 13** (engineering polish, audience-critical) and
   **Phase 14** (content, data, legal) — rather than one combined phase,
   since they're different kinds of work (code vs. content/ops) with
   different owners and no real sequencing dependency between them.

**Additive, folded in without further discussion:** Part 2 (product
vision/audience framing — context, not a plan change), the
`target_cities` column on `feature_flags` (Phase 11 Step 10), Part 7.1–7.3
(backend scaling checklist, multi-city expansion strategy — informational,
feeds Phase 14/Part 5.8 already-existing "Backend Scaling" section),
location-aware discovery and MMKV as new Post-Foundation items (Phase 13).

## Schema note: don't duplicate `owner_id`

v2.1's Part 6.3 proposes `claimed_by_user_id uuid references profiles(id)`
as a new `places` column. Phase 7 already added `owner_id` for exactly
this purpose (see CLAUDE.md's Phase 7 entry — the claim RLS policy keys
off it). **Phase 14 reuses `owner_id`**; it does not add
`claimed_by_user_id`. The genuinely new columns from v2.1's proposal are:
`source`, `is_verified`, `city`, `lat`, `lng`, `instagram_handle`,
`claimed_at`, `verified_at`, `verification_documents`.

---

## Phase 12 — Store Submission Prep (revised scope)

**Depends on:** Phase 11 (architecture/store-readiness foundation),
Phase 13 (audience-critical polish — App Store review guidelines expect a
polished, non-janky app), Phase 14 (content — an empty cafe list and no
Privacy Policy URL both block submission).

**What's unchanged from the original Phase 12 scope:** production build
(`eas build --platform ios --profile production`), TestFlight internal →
external beta, App Store Review submission, phased release.

**What's new (from v2.1's App Store submission path, Part 8, and the
Apple Sign-In gap in Part 7.4):**

- **Sign in with Apple** — new Supabase Auth provider config (native
  Apple provider, already supported by Supabase — no new Apple Developer
  entitlement work beyond what `expo-apple-authentication` needs), a
  third auth button on the welcome screen next to Google/Phone, and the
  associated `app.json` plugin entry + native rebuild (same category of
  change as `expo-image-picker`/`expo-notifications` in Phases 5/6).
  Required because Google OAuth is already offered — Guideline 4.8 is not
  optional once that's true.
- **Legal URLs**: Privacy Policy and Terms of Service (drafted in
  Phase 14) need public URLs before App Store Connect submission will
  accept them.
- **App Store screenshots + description** (5.5" + 6.5") — submission
  material; the underlying cafe content and app polish it showcases come
  from Phases 13/14, but producing the actual screenshots/copy is
  Phase 12 execution work.
- **Pre-submission checklist** (v2.1 §8.1) — bundle size < 50MB, 60fps on
  Home/Explore/Messages with 100+ items (validates Phase 13's FlashList
  and image-compression work), Supabase Pro tier or PgBouncer, Sentry/
  PostHog receiving real events, ATT prompt implemented, `PrivacyInfo.
  xcprivacy` included, 20–30 curated cafes with accurate data.

**Success criteria:** unchanged from the original — `eas build ...
production` succeeds, Maestro E2E passes on a release build, TestFlight
internal testing with 5+ real users for 1 week, then external beta →
App Store Review.

---

## Phase 13 — Audience-Critical Polish

**Depends on:** Phase 11 (needs TanStack Query/Zustand in place — offline
support and location-aware discovery both build on the query layer).
**Does not depend on Phase 14** — pure engineering work, can run in
parallel with Phase 14's content/legal track.

Everything from v2.1's Part 5 Post-Foundation Enhancements **except**
FlashList, which moved into Phase 11 (see above):

1. **Image compression pipeline** (P0) — `expo-image-manipulator`,
   resize to 1080px width + 0.8 JPEG compression before every upload
   (`useCreateDrop`, avatar change, dish photo, message media); Supabase
   Storage image transformations for thumbnails.
2. **Haptics + skeleton screens** (P1) — `expo-haptics` helper wired into
   all primary actions (drop, send, check-in, claim, reserve); skeleton
   components mirroring `DropCard`/`PlaceCard` replacing `ActivityIndicator`
   spinners on first load.
3. **Offline support** (P1) — TanStack Query persistence
   (`@tanstack/react-query-persist-client` + async-storage persister), a
   Zustand-backed mutation queue processed on reconnect via `NetInfo`.
4. **Location-aware discovery** (P1) — `expo-location` +
   `useNearbyPlaces` hook + a new `nearby_places` PostGIS RPC (schema
   change — apply via the `supabase-migration` skill, same as any other
   phase's schema work).
5. **MMKV for fast local storage** (P2) — non-session data only (search
   history, feature-flag cache, onboarding state); session storage stays
   on the existing `expo-secure-store` + AES pattern.
6. **Biometric auth for sensitive actions** (P2) — `expo-local-authentication`,
   gates owner-dashboard destructive actions (delete dish, change status).
7. **Shared element transitions** (P2) — Reanimated 3 (already installed),
   café card → detail screen image/title animation.

**Success criteria:** same per-item success criteria as v2.1's Part 5
sections. No new Maestro flows required for P2 items (biometric prompts
and OS-level transitions aren't Maestro-drivable, same limitation as
Google OAuth and native pickers elsewhere in this repo); image
compression and offline queueing should get manual verification steps
similar to Phase 5/6's media-upload checks.

---

## Phase 14 — Content & Launch Prep

**Depends on:** Phase 7 (owner claim flow, `owner_id` column) for the
claim-flow enhancement below. **Does not depend on Phase 11 or 13** —
content curation and legal drafting are independent of the architecture
refactor and polish pass; can start any time.

1. **`places` schema additions** (schema change — apply via the
   `supabase-migration` skill): `source text default 'manual' check
   (source in ('manual', 'owner_claimed', 'osm_import'))`, `is_verified
   boolean default false`, `city text default 'hyderabad'`, `lat double
   precision`, `lng double precision`, `instagram_handle text`,
   `claimed_at timestamptz`, `verified_at timestamptz`,
   `verification_documents text[] default '{}'`. Reuses the existing
   `owner_id` column rather than adding `claimed_by_user_id` (see schema
   note above). Indexes on `city`, `source`, and a GiST index on
   `(lng, lat)` for Phase 13's location-aware discovery.
2. **Manual curation of 20–30 Hyderabad cafes** — name, area, address,
   cuisine, price range, hours, 3–5 photos, Instagram handle, `source =
   'manual'`, `is_verified = true`. One day of content work, done right
   before TestFlight, not blocked on any engineering phase.
3. **Owner claim-flow enhancement** (confirmed new scope, not in Phase 7):
   document upload (business registration/GST/menu photos) added to the
   existing `app/owner/claim.tsx` flow, stored in a new Storage bucket
   (owner-scoped write RLS, same pattern as `dish-photos`/`drop-media`
   from Phases 5/7) as `verification_documents` URLs; admin approval step
   before `is_verified` flips to `true` (reviewed manually via Supabase
   dashboard at current scale — no admin UI needed yet, same "no AI
   moderation needed at <1K users" call v2.1 itself makes).
4. **OSM bulk-import path** — deferred until actual multi-city expansion
   (Bangalore/Mumbai/Pune), not built speculatively now; documented here
   so the Overpass-API query + `source = 'osm_import'` insert pattern
   from v2.1 §6.2 Phase C is easy to pick up later.
5. **Content moderation policy** — decide and document the approach per
   content type (v2.1 §6.4): pre-approval for manual/owner-claimed
   listings, post-moderation + community reporting for drops/dish
   photos/reviews, admin approval for events. No new engineering at
   current scale beyond what's already in Phase 7/8's report affordances
   (or their absence — reporting UI, if it doesn't exist yet, is a real
   gap to confirm during this phase, not assumed).
6. **Terms of Service + Privacy Policy** — drafted and published to
   public URLs Phase 12 can link from App Store Connect.

**Success criteria:** 20–30 real, accurate cafe listings live with
`is_verified = true`; claim flow requires and stores a document before
flipping `is_verified`; ToS/Privacy Policy URLs live and linkable.

---

## Revised phase dependency graph

```
Phase 11 (architecture foundation, FlashList included)
    │
    ├──> Phase 13 (audience-critical polish)
    │
    └──> Phase 12 (store submission) <── Phase 14 (content & launch prep)
                                              ↑
                                    (Phase 7 owner claim flow)
```

Phase 13 and Phase 14 have no dependency on each other and can be worked
in either order, or concurrently, once their own prerequisites
(Phase 11 for 13; Phase 7 for 14) are met. Phase 12 is the only phase
that waits on both.
