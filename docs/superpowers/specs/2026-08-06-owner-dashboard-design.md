# Owner dashboard — design spec

Date: 2026-08-06
Status: approved, entering implementation (Phase 7)

## What this is

The native rewrite's Phase 7: lets a signed-in user claim an unclaimed café
and manage it (status, tagline, dishes) from their phone. Mirrors the web
app's `/owner/claim` + `/owner/dashboard` (see
`../../lore-app-reference/app/owner/`), extended with dish photos and
inline rating/tag editing since neither web nor native ever built those.

## Guiding principle

**Seamless and simple** — this is a secondary, occasional-use flow (most
users are seekers, not owners). It should never feel heavier than the
primary app. Concretely:
- Reuse existing components and patterns exactly (`ScreenContainer`,
  `Card`, `Chip`, `Button`, `StatusBadge`, `TextField`) — no new visual
  language for this phase.
- Every save action gives immediate inline feedback (a toast/confirmation
  card), same as `app/checkin/[placeId].tsx`'s "Stamp collected" pattern —
  never a silent save.
- Minimize steps: claiming is a single tap on a place card (no
  confirmation modal — it's additive, not destructive, and web's
  equivalent flow has no confirmation step either).
- Only the truly destructive action (delete dish) gets a confirm step
  (native `Alert.alert` with a cancel option, matching existing app
  conventions elsewhere for destructive actions).

## Navigation

Pushed stack screens off the Profile tab, not a new tab — matches how
Collections/Events/Diary already work, and avoids complicating the fixed
5-tab bar for a role most users won't have.

```
Profile tab
  └─ "Owner dashboard" (role=owner) / "Claim a place" (role=seeker) button
       ├─ app/owner/claim.tsx        (role=seeker path)
       │    └─ tap a place → claims it → router.replace to dashboard
       └─ app/owner/index.tsx        (role=owner path)
            └─ tap a place card → app/owner/place/[id].tsx
                 (status, tagline, dish list + add-dish form)
```

All three screens use `<ScreenContainer hasHeader>`, matching every other
pushed screen in the app.

## Screens

### `app/owner/claim.tsx`

- `fetchUnclaimedPlaces()` → list via the existing `PlaceListItem`
  component (same one Explore uses), no new list UI.
- Tap a place → `claimPlace(userId, placeId)`: updates
  `profiles.role = 'owner'` then `places.owner_id = userId` (two calls,
  matching the web server action's order — role must flip before the
  claim RLS policy's `EXISTS (... p.role = 'owner')` check passes).
- On success: `refreshProfile()` (role changed, per
  `providers/auth-provider.tsx`'s contract), then
  `router.replace('/owner')`.
- Empty state: "Nothing unclaimed right now" (mirrors web's copy).

### `app/owner/index.tsx`

- `fetchOwnedPlaces(ownerId)` → places where `owner_id = ownerId`, each
  with its `dishes(*)` (mirrors web's `select('*, dishes(*)')`).
- Each place renders as a `Card` with name/area, a `StatusBadge`, and a
  "Manage" affordance → `router.push('/owner/place/${id}')`.
- Empty state + link into `/owner/claim` ("+ claim another place"),
  matching web.

### `app/owner/place/[id].tsx`

Three sections, each an independent save (matches web's three separate
forms — no single giant "save everything" action, so a mistake in one
field doesn't block saving another):

1. **Status** — `Chip` row for open/temp-closed/perm-closed (reusing the
   `Chip` component already used for onboarding's role picker), reopen-date
   `TextField` shown only when temp-closed is selected. Saves via
   `updatePlaceStatus(placeId, status, reopenDate)`.
2. **Tagline** — multiline `TextField`, saves via
   `updatePlaceTagline(placeId, tagline)`.
3. **Dishes** — list of existing dishes, each row: photo thumbnail (tap to
   add/replace via `expo-image-picker`, same permission/flow as
   `onChangeAvatar` in `app/(tabs)/profile.tsx`), name (editable inline),
   tag (editable inline `TextField`), rating (tap-to-set 1–5 star row —
   new small component, `components/ui/StarRating.tsx`, used in both
   editable and read-only mode so café detail can adopt it later if
   wanted, though this phase doesn't require changing café detail's
   existing text-based `{rating}★` display), delete button (confirm via
   `Alert.alert`). Below the list, an add-dish form (name required, tag/
   rating/photo optional, photo upload happens after `addDish` returns an
   id — same "upload after insert" ordering Phase 5 used for drop media).

## Data layer (`lib/queries.ts`)

New functions, following existing file conventions (typed returns, safety
`.limit()`s, errors thrown not swallowed):

- `fetchUnclaimedPlaces(): Promise<PlaceSummary[]>`
- `claimPlace(userId: string, placeId: string): Promise<void>`
- `fetchOwnedPlaces(ownerId: string): Promise<(Place & { dishes: Dish[] })[]>`
- `updatePlaceStatus(placeId: string, status: string, reopenDate: string | null): Promise<void>`
- `updatePlaceTagline(placeId: string, tagline: string | null): Promise<void>`
- `addDish(placeId: string, fields: { name: string; tag?: string | null; rating?: number | null }): Promise<Dish>` (returns the row so its id can key the photo upload)
- `updateDish(dishId: string, fields: { name?: string; tag?: string | null; rating?: number | null }): Promise<void>`
- `deleteDish(dishId: string): Promise<void>`
- `uploadDishPhoto(dishId: string, placeId: string, asset: { uri: string; mimeType: string }): Promise<string>` (returns the cache-busted public URL, same shape as `updateAvatar`)

`Dish` type gains `photo_url: string | null`.

## Schema changes (will confirm exact SQL before applying, per the
`supabase-migration` project skill)

- `alter table public.dishes add column photo_url text;`
- New Storage bucket `dish-photos`: public-read, insert/update/delete RLS
  scoped to `exists (select 1 from places pl where pl.id::text =
  (storage.foldername(name))[1] and pl.owner_id = auth.uid())` — same
  owner-scoped-by-first-path-segment shape as `drop-media`/`avatars`, path
  format `{place_id}/{dish_id}.<ext>`.
- No changes needed to existing `places`/`dishes`/`profiles` RLS — claim,
  status/tagline update, and dish insert/update/delete policies already
  exist on the live project (verified this session).

## Error handling

Same pattern used everywhere else in the app (`onChangeAvatar`,
check-in, compose): wrap the mutation in try/catch, `Alert.alert` with
`error.message` on failure, no custom error UI. A claim race (someone else
claims the same place first) surfaces as a generic RLS-violation Supabase
error — acceptable, matches existing app-wide handling, and is rare enough
not to warrant special-casing for a first version.

## Testing

- New Maestro flow `maestro/phase7-owner-dashboard.yaml`: claim a seed
  unclaimed place → land on dashboard → update status → update tagline →
  add a dish → delete a dish. Needs a seed place with no owner reserved
  for this flow (checked before writing the flow — see implementation
  plan).
- Photo picker and star-rating tap interactions: smoke-tested only
  (button/row renders), same treatment Phase 5 gave the media picker —
  native picker sheets aren't Maestro-drivable. Manual verification during
  the phase wrap-up checklist.
- Full `phase-wrapup` project skill applies at the end: typecheck, lint,
  full suite, CLAUDE.md update, manual test checklist handback.
