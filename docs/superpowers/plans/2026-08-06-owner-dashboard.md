# Owner Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user claim an unclaimed café and manage it (open/closed status, tagline, and a dish menu with photo/rating/tag) from the native app.

**Architecture:** Three new pushed-stack screens under `app/owner/` (claim → dashboard → per-place manage), new data-layer functions in `lib/queries.ts`, one new reusable component (`StarRating`), a one-column schema addition (`dishes.photo_url`), and a new `dish-photos` Storage bucket reusing Phase 5's owner-scoped-by-path-segment RLS pattern. Full design rationale: `docs/superpowers/specs/2026-08-06-owner-dashboard-design.md`.

**Tech Stack:** Expo Router (file-based stack navigation), Supabase (`@supabase/supabase-js`), `expo-image-picker` + `expo-image` (already dependencies, used by Phase 5), no new packages.

## Global Constraints

(Copied from the design spec — every task's work implicitly includes these.)

- No inline hex values or magic numbers — every color/font/spacing comes from `constants/theme.ts`.
- Reuse existing components exactly (`ScreenContainer`, `Card`, `Chip`, `Button`, `StatusBadge`, `TextField`, `PageHeader`) — no new visual language for this phase.
- Every save action gives immediate inline feedback (button label changes to a checkmark state, or a toast) — never a silent save.
- Minimize steps: claiming a place is a single tap on its card, no confirmation modal.
- Only the delete-dish action is destructive and gets a confirm step (`Alert.alert` with Cancel).
- Every screen pushed under a nav header (i.e. everything in `app/owner/`) uses `<ScreenContainer hasHeader>`.
- **This repo has no unit test framework** (`package.json` has no jest/vitest — confirmed). Verification is `npx tsc --noEmit` + `npx eslint . --ext .ts,.tsx` after each task, a concrete manual Simulator check per task, one consolidated Maestro E2E flow near the end, and the `phase-wrapup` project skill at completion. This plan's "test" steps are adapted to that established convention rather than a red/green unit-test cycle.
- Schema/RLS changes go directly against the live shared Supabase project (`jgksopmbfttqqngrsama`) via MCP, per the `supabase-migration` project skill: present exact SQL and get explicit confirmation before `apply_migration`, then run `get_advisors` afterward.
- No `Co-Authored-By` trailer on any commit (standing repo convention).
- Only commit when explicitly instructed within a step — every task ends with an explicit commit step, matching this repo's per-change commit granularity.
- **Expo Router typed routes gotcha:** `app.json` has `experiments.typedRoutes: true`, so `router.push(...)` calls are type-checked against a `Href` union in `.expo/types/router.d.ts`. That file only regenerates while `expo start`'s Metro dev server is running and watching `app/` — not on every `tsc` run. If `npx tsc --noEmit` reports a brand-new route string (e.g. `'/owner/claim'` right after creating that file) as not assignable to `Href`, that's this staleness, not a real bug: run `npx expo start` in the background, wait for it to finish starting (it prints the QR/dev-menu banner once ready), then stop it and re-run `tsc --noEmit` — or just leave a dev server running for the whole plan. Don't "fix" this by loosening a type or casting `as any`.

---

### Task 1: Schema — `dishes.photo_url` column + `dish-photos` Storage bucket

**Files:** none (live Supabase project only, no local migrations folder in this repo)

**Interfaces:**
- Produces: `public.dishes.photo_url` (`text`, nullable) column; a public-read `dish-photos` Storage bucket with owner-scoped write RLS keyed off `{place_id}/...` path segments, mirroring the existing `avatars`/`drop-media` buckets (verified their exact policy shapes via `pg_policies` this session).

- [ ] **Step 1: Present the exact SQL and get explicit confirmation**

This is a schema/RLS change on the shared live project — stop and confirm before applying, per the `supabase-migration` skill. Show the user this SQL:

```sql
alter table public.dishes add column photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', true, 10485760,
  array['image/jpeg','image/png','image/heic','image/webp']);

create policy "dish photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'dish-photos');

create policy "a place owner can upload dish photos"
  on storage.objects for insert
  with check (
    bucket_id = 'dish-photos'
    and exists (
      select 1 from public.places pl
      where pl.id::text = (storage.foldername(objects.name))[1]
        and pl.owner_id = auth.uid()
    )
  );

create policy "a place owner can replace dish photos"
  on storage.objects for update
  using (
    bucket_id = 'dish-photos'
    and exists (
      select 1 from public.places pl
      where pl.id::text = (storage.foldername(objects.name))[1]
        and pl.owner_id = auth.uid()
    )
  );

create policy "a place owner can delete dish photos"
  on storage.objects for delete
  using (
    bucket_id = 'dish-photos'
    and exists (
      select 1 from public.places pl
      where pl.id::text = (storage.foldername(objects.name))[1]
        and pl.owner_id = auth.uid()
    )
  );
```

Note the UPDATE policy: dish photos upload to a fixed `{place_id}/{dish_id}.<ext>` path with `upsert: true` (so re-uploading a photo replaces it, same as avatars), which needs both INSERT (first upload) and UPDATE (re-upload) policies — unlike `drop-media`, whose paths are never reused so it only has INSERT.

- [ ] **Step 2: Apply via the Supabase MCP `apply_migration` tool**

Use project id `jgksopmbfttqqngrsama`. Split into two migrations for a clean rollback boundary: one named `phase7_dishes_photo_url` for the `alter table`, one named `phase7_dish_photos_bucket` for the bucket + policies.

- [ ] **Step 3: Verify**

Run `get_advisors` (both `security` and `performance` types) on project `jgksopmbfttqqngrsama`. Fix immediately if either of this project's two recurring findings reappear (see the `supabase-migration` skill): an extension landing in `public` instead of `extensions`, or a `SECURITY DEFINER` function left executable by `anon`/`authenticated`. Neither is expected from this migration (no new extensions or functions), so a clean report is expected — treat any other new finding as worth investigating before moving on.

Then confirm structurally:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'dishes' and column_name = 'photo_url';

select id, public, file_size_limit from storage.buckets where id = 'dish-photos';
```

Expect one row from each query.

---

### Task 2: Data layer — `lib/queries.ts`

**Files:**
- Modify: `lib/queries.ts:22-27` (the `Dish` type)
- Modify: `lib/queries.ts` (append a new section at the end, after the `Push notifications` section which currently ends at line 546)

**Interfaces:**
- Consumes: existing `supabase` client (`lib/queries.ts:1`), existing `PlaceSummary`/`Place` types, existing `uploadFile` helper and `EXTENSION_BY_MIME_TYPE` map (`lib/queries.ts:206-228`), existing `PickedMedia` type (`lib/queries.ts:200-204`).
- Produces (all exported from `lib/queries.ts`):
  - `Dish` type, now including `photo_url: string | null`
  - `NewDishInput = { name: string; tag?: string | null; rating?: number | null }`
  - `DishUpdateInput = { name?: string; tag?: string | null; rating?: number | null }`
  - `fetchUnclaimedPlaces(): Promise<PlaceSummary[]>`
  - `claimPlace(userId: string, placeId: string): Promise<void>`
  - `fetchOwnedPlaces(ownerId: string): Promise<(Place & { dishes: Dish[] })[]>`
  - `updatePlaceStatus(placeId: string, status: string, reopenDate: string | null): Promise<void>`
  - `updatePlaceTagline(placeId: string, tagline: string | null): Promise<void>`
  - `addDish(placeId: string, fields: NewDishInput): Promise<Dish>`
  - `updateDish(dishId: string, fields: DishUpdateInput): Promise<void>`
  - `deleteDish(dishId: string): Promise<void>`
  - `uploadDishPhoto(dishId: string, placeId: string, media: PickedMedia): Promise<string>`

- [ ] **Step 1: Add `photo_url` to the `Dish` type**

Find this at `lib/queries.ts:22-27`:

```ts
export type Dish = {
  id: string;
  name: string;
  tag: string | null;
  rating: number | null;
};
```

Replace with:

```ts
export type Dish = {
  id: string;
  name: string;
  tag: string | null;
  rating: number | null;
  photo_url: string | null;
};
```

- [ ] **Step 2: Append the new "Owner dashboard" section**

Add at the end of `lib/queries.ts` (after `registerPushToken`, currently the last function in the file):

```ts
/* ------------------------------------------------------------------ *
 * Owner dashboard (claim + manage a place)
 * ------------------------------------------------------------------ */

export async function fetchUnclaimedPlaces(): Promise<PlaceSummary[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, area, price_range, tagline, status, cover_color')
    .is('owner_id', null)
    .order('name')
    .limit(200);

  if (error) throw error;
  return (data ?? []) as PlaceSummary[];
}

/**
 * Becoming an owner (flipping `profiles.role`) must happen before the claim
 * update, since the "an owner can claim an unclaimed place" RLS policy's
 * `WITH CHECK` requires `profiles.role = 'owner'` to already be true — same
 * two-step order the web app's `claimPlace` server action uses.
 */
export async function claimPlace(userId: string, placeId: string): Promise<void> {
  const { error: roleError } = await supabase
    .from('profiles')
    .update({ role: 'owner' })
    .eq('id', userId);
  if (roleError) throw roleError;

  const { error: claimError } = await supabase
    .from('places')
    .update({ owner_id: userId })
    .eq('id', placeId)
    .is('owner_id', null);
  if (claimError) throw claimError;
}

export async function fetchOwnedPlaces(
  ownerId: string
): Promise<(Place & { dishes: Dish[] })[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*, dishes(*)')
    .eq('owner_id', ownerId)
    .order('created_at')
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as (Place & { dishes: Dish[] })[];
}

export async function updatePlaceStatus(
  placeId: string,
  status: string,
  reopenDate: string | null
): Promise<void> {
  const { error } = await supabase
    .from('places')
    .update({ status, reopen_date: status === 'temp-closed' ? reopenDate : null })
    .eq('id', placeId);

  if (error) throw error;
}

export async function updatePlaceTagline(placeId: string, tagline: string | null): Promise<void> {
  const { error } = await supabase.from('places').update({ tagline }).eq('id', placeId);
  if (error) throw error;
}

export type NewDishInput = {
  name: string;
  tag?: string | null;
  rating?: number | null;
};

export type DishUpdateInput = {
  name?: string;
  tag?: string | null;
  rating?: number | null;
};

export async function addDish(placeId: string, fields: NewDishInput): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      place_id: placeId,
      name: fields.name,
      tag: fields.tag ?? null,
      rating: fields.rating ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Dish;
}

export async function updateDish(dishId: string, fields: DishUpdateInput): Promise<void> {
  const { error } = await supabase.from('dishes').update(fields).eq('id', dishId);
  if (error) throw error;
}

export async function deleteDish(dishId: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', dishId);
  if (error) throw error;
}

/**
 * Uploads to a fixed `{place_id}/{dish_id}.<ext>` path (so re-uploading
 * replaces the old file via `upsert`, same as `updateAvatar`) and writes the
 * cache-busted public URL onto the dish.
 */
export async function uploadDishPhoto(
  dishId: string,
  placeId: string,
  media: PickedMedia
): Promise<string> {
  const ext = EXTENSION_BY_MIME_TYPE[media.mimeType] ?? 'jpg';
  const path = `${placeId}/${dishId}.${ext}`;
  const url = await uploadFile('dish-photos', path, media.uri, media.mimeType);
  const bustedUrl = `${url}?updated=${Date.now()}`;

  const { error } = await supabase.from('dishes').update({ photo_url: bustedUrl }).eq('id', dishId);
  if (error) throw error;

  return bustedUrl;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Nothing in the app calls these new functions yet, so there's nothing to manually exercise — this task is verified by typecheck alone.)

- [ ] **Step 4: Commit**

```bash
git add lib/queries.ts
git commit -m "$(cat <<'EOF'
Add owner-dashboard data layer functions

Claim, status/tagline updates, and dish CRUD + photo upload, all
against RLS policies already live on the shared Supabase project.
EOF
)"
```

---

### Task 3: `StarRating` component

**Files:**
- Create: `components/ui/StarRating.tsx`

**Interfaces:**
- Consumes: `colors`, `fontFamily` from `@/constants/theme`.
- Produces: `StarRating({ rating, onChange, size }: { rating: number | null; onChange?: (rating: number) => void; size?: number })` — a 5-star row. Read-only (no `Pressable`) when `onChange` is omitted; tapping star N calls `onChange(N)` when provided.

- [ ] **Step 1: Write the component**

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '@/constants/theme';

type Props = {
  rating: number | null;
  /** Omit for a read-only display; provide to make stars tappable. */
  onChange?: (rating: number) => void;
  size?: number;
};

const STAR_COUNT = 5;

/** Tap-to-set 1–5 star row, reused for both editing (owner dashboard) and
 * potential read-only display. */
export function StarRating({ rating, onChange, size = 20 }: Props) {
  const filled = rating ?? 0;

  return (
    <View style={styles.row}>
      {Array.from({ length: STAR_COUNT }, (_, index) => {
        const starNumber = index + 1;
        const star = (
          <Text
            style={[
              styles.star,
              { fontSize: size },
              starNumber <= filled ? styles.starFilled : styles.starEmpty,
            ]}
          >
            ★
          </Text>
        );

        return onChange ? (
          <Pressable key={starNumber} onPress={() => onChange(starNumber)} hitSlop={6}>
            {star}
          </Pressable>
        ) : (
          <View key={starNumber}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontFamily: fontFamily.mono,
  },
  starFilled: {
    color: colors.mustard,
  },
  starEmpty: {
    color: colors.creamDeep,
  },
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint components/ui/StarRating.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/StarRating.tsx
git commit -m "Add StarRating component for dish rating editing"
```

---

### Task 4: Claim screen + Profile tab entry point

**Files:**
- Create: `app/owner/claim.tsx`
- Modify: `app/_layout.tsx:34-38` (register the route)
- Modify: `app/(tabs)/profile.tsx:85-93` (entry-point button)

**Interfaces:**
- Consumes: `fetchUnclaimedPlaces`, `claimPlace`, `PlaceSummary` (Task 2); `PlaceListItem`, `PageHeader`, `ScreenContainer` (existing); `useAuthContext` (existing, `profile`/`session`/`refreshProfile`).
- Produces: route `/owner/claim`.

- [ ] **Step 1: Write the claim screen**

Create `app/owner/claim.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlaceListItem } from '@/components/ui/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchUnclaimedPlaces, claimPlace, type PlaceSummary } from '@/lib/queries';

export default function ClaimPlaceScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuthContext();
  const userId = profile?.id ?? session?.user?.id ?? '';

  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUnclaimedPlaces()
      .then(setPlaces)
      .finally(() => setLoading(false));
  }, []);

  async function onClaim(placeId: string) {
    if (!userId || claimingId) return;
    setClaimingId(placeId);
    try {
      await claimPlace(userId, placeId);
      await refreshProfile();
      router.replace('/owner');
    } catch (error) {
      Alert.alert(
        'Could not claim this place',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
      setClaimingId(null);
    }
  }

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={places}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <PageHeader
            eyebrow="Claim your place"
            title="Find your café"
            subtitle="Pick your café below. Claiming it makes you its owner."
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing unclaimed right now — every seeded place already has an owner.
          </Text>
        }
        renderItem={({ item }) => <PlaceListItem place={item} onPress={() => onClaim(item.id)} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Register the route**

In `app/_layout.tsx`, find:

```tsx
        <Stack.Screen name="diary" options={pushedScreenOptions} />
        <Stack.Screen name="events" options={pushedScreenOptions} />
```

Replace with:

```tsx
        <Stack.Screen name="diary" options={pushedScreenOptions} />
        <Stack.Screen name="events" options={pushedScreenOptions} />
        <Stack.Screen name="owner/claim" options={pushedScreenOptions} />
```

(Only `owner/claim` is registered here — its file exists as of this task. `owner/index` and `owner/place/[id]` get their own `Stack.Screen` line added in Tasks 5 and 6 respectively, alongside the file that makes each one real, rather than forward-declaring a route to a file that doesn't exist yet.)

- [ ] **Step 3: Add the Profile tab entry point**

In `app/(tabs)/profile.tsx`, find:

```tsx
      <View style={styles.links}>
        <Button
          label="Collections"
          variant="secondary"
          inline
          onPress={() => router.push('/collections')}
        />
        <Button label="Events" variant="secondary" inline onPress={() => router.push('/events')} />
      </View>
```

Replace with:

```tsx
      <View style={styles.links}>
        <Button
          label="Collections"
          variant="secondary"
          inline
          onPress={() => router.push('/collections')}
        />
        <Button label="Events" variant="secondary" inline onPress={() => router.push('/events')} />
        <Button
          label={profile?.role === 'owner' ? 'Owner dashboard' : 'Claim a place'}
          variant="secondary"
          inline
          onPress={() => router.push(profile?.role === 'owner' ? '/owner' : '/owner/claim')}
        />
      </View>
```

(The owner branch routes to `/owner`, which doesn't exist until Task 5 — harmless for now since every real test account at this point still has `role: 'seeker'`, so only the `/owner/claim` branch is reachable until a claim actually happens.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification in Simulator**

With the app running and signed in as a `role: 'seeker'` account: Profile tab → tap "Claim a place" → confirm the unclaimed-places list renders (using the existing `PlaceListItem` look) → tap any place → confirm it navigates (it will land on a blank/error screen since `/owner` doesn't exist yet — expected at this point, Task 5 fixes that) but does NOT throw a red-screen error before that navigation. Separately, confirm in the Supabase dashboard (or via `execute_sql`) that the tapped place's `owner_id` is now set and the profile's `role` flipped to `'owner'`.

- [ ] **Step 6: Commit**

```bash
git add app/owner/claim.tsx app/_layout.tsx "app/(tabs)/profile.tsx"
git commit -m "$(cat <<'EOF'
Add claim-a-place screen and Profile entry point

First screen of the owner dashboard flow: lists unclaimed places,
tap to claim (flips role to owner, sets places.owner_id).
EOF
)"
```

---

### Task 5: Owner dashboard screen

**Files:**
- Create: `app/owner/index.tsx`
- Modify: `app/_layout.tsx` (register the route)

**Interfaces:**
- Consumes: `fetchOwnedPlaces` (Task 2); `Place`, `Dish` types (Task 2); `Card`, `Button`, `StatusBadge`, `PageHeader`, `ScreenContainer` (existing); `useAuthContext`.
- Produces: route `/owner`.

- [ ] **Step 1: Write the dashboard screen**

Create `app/owner/index.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchOwnedPlaces, type Place, type Dish } from '@/lib/queries';

type OwnedPlace = Place & { dishes: Dish[] };

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const [places, setPlaces] = useState<OwnedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      fetchOwnedPlaces(ownerId)
        .then(setPlaces)
        .finally(() => setLoading(false));
    }, [ownerId])
  );

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={places}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<PageHeader eyebrow="Owner's Lore" title="Managing your places" />}
        ListEmptyComponent={<Text style={styles.empty}>You don&apos;t own any places yet.</Text>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{[item.area, item.city].filter(Boolean).join(' · ')}</Text>
            <StatusBadge status={item.status} reopenDate={item.reopen_date} />
            <Button
              label="Manage"
              variant="secondary"
              inline
              onPress={() => router.push(`/owner/place/${item.id}`)}
            />
          </Card>
        )}
        ListFooterComponent={
          <Button label="+ claim another place" variant="ghost" onPress={() => router.push('/owner/claim')} />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  meta: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Register the route**

In `app/_layout.tsx`, find:

```tsx
        <Stack.Screen name="owner/claim" options={pushedScreenOptions} />
```

Replace with:

```tsx
        <Stack.Screen name="owner/claim" options={pushedScreenOptions} />
        <Stack.Screen name="owner/index" options={pushedScreenOptions} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
Expected: no errors.

- [ ] **Step 4: Manual verification in Simulator**

Continuing from the account that claimed a place in Task 4: Profile tab → the button now reads "Owner dashboard" → tap it → confirm the claimed place renders as a card with its status badge and a "Manage" button → tap "Manage" (will still error, since `app/owner/place/[id].tsx` doesn't exist until Task 6 — expected at this point) → tap "+ claim another place" → confirm it returns to the claim screen.

- [ ] **Step 5: Commit**

```bash
git add app/owner/index.tsx app/_layout.tsx
git commit -m "Add owner dashboard screen listing claimed places"
```

---

### Task 6: Per-place manage screen — status + tagline

**Files:**
- Create: `app/owner/place/[id].tsx`
- Modify: `app/_layout.tsx` (register the route)

**Interfaces:**
- Consumes: `fetchPlace` (existing, `lib/queries.ts:95-100`), `updatePlaceStatus`, `updatePlaceTagline`, `Place` type (Task 2); `Chip`, `TextField`, `Button`, `PageHeader`, `ScreenContainer` (existing).
- Produces: route `/owner/place/[id]`.

- [ ] **Step 1: Write the screen shell with status and tagline sections**

Create `app/owner/place/[id].tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchPlace, updatePlaceStatus, updatePlaceTagline, type Place } from '@/lib/queries';

const STATUSES: { id: string; label: string }[] = [
  { id: 'open', label: 'Open as usual' },
  { id: 'temp-closed', label: 'Temporarily closed' },
  { id: 'perm-closed', label: 'Permanently closed' },
];

export default function ManagePlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('open');
  const [reopenDate, setReopenDate] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const [tagline, setTagline] = useState('');
  const [savingTagline, setSavingTagline] = useState(false);
  const [taglineSaved, setTaglineSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchPlace(id)
        .then((data) => {
          setPlace(data);
          setStatus(data.status);
          setReopenDate(data.reopen_date ?? '');
          setTagline(data.tagline ?? '');
        })
        .finally(() => setLoading(false));
    }, [id])
  );

  async function onSaveStatus() {
    if (!id) return;
    setSavingStatus(true);
    try {
      await updatePlaceStatus(id, status, status === 'temp-closed' ? reopenDate.trim() || null : null);
      setStatusSaved(true);
    } catch (error) {
      Alert.alert('Could not update status', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSavingStatus(false);
    }
  }

  async function onSaveTagline() {
    if (!id) return;
    setSavingTagline(true);
    try {
      await updatePlaceTagline(id, tagline.trim() || null);
      setTaglineSaved(true);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setSavingTagline(false);
    }
  }

  if (loading || !place) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PageHeader
            eyebrow="Owner's Lore"
            title={place.name}
            subtitle={[place.area, place.city].filter(Boolean).join(' · ')}
          />

          <Text style={styles.sectionLabel}>Café status</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                selected={status === s.id}
                onPress={() => {
                  setStatus(s.id);
                  setStatusSaved(false);
                }}
              />
            ))}
          </View>
          {status === 'temp-closed' && (
            <TextField
              placeholder="Expected back (e.g. 25 Jul)"
              value={reopenDate}
              onChangeText={(value) => {
                setReopenDate(value);
                setStatusSaved(false);
              }}
              style={styles.field}
            />
          )}
          <Button
            label={savingStatus ? 'Saving…' : statusSaved ? 'Status updated ✓' : 'Update status'}
            variant="dark"
            inline
            loading={savingStatus}
            onPress={onSaveStatus}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Straight from the owner</Text>
          <TextField
            placeholder="Tell people your story…"
            value={tagline}
            onChangeText={(value) => {
              setTagline(value);
              setTaglineSaved(false);
            }}
            multiline
            numberOfLines={3}
            style={[styles.field, styles.multiline]}
          />
          <Button
            label={savingTagline ? 'Saving…' : taglineSaved ? 'Saved ✓' : 'Save'}
            variant="dark"
            inline
            loading={savingTagline}
            onPress={onSaveTagline}
          />

          <View style={styles.divider} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  divider: {
    borderTopWidth: 2,
    borderTopColor: colors.creamDeep,
    borderStyle: 'dashed',
    marginVertical: spacing.xl,
  },
});
```

- [ ] **Step 2: Register the route**

In `app/_layout.tsx`, find:

```tsx
        <Stack.Screen name="owner/claim" options={pushedScreenOptions} />
        <Stack.Screen name="owner/index" options={pushedScreenOptions} />
```

Replace with:

```tsx
        <Stack.Screen name="owner/claim" options={pushedScreenOptions} />
        <Stack.Screen name="owner/index" options={pushedScreenOptions} />
        <Stack.Screen name="owner/place/[id]" options={pushedScreenOptions} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
Expected: no errors.

- [ ] **Step 4: Manual verification in Simulator**

From the owner dashboard, tap "Manage" on the claimed place → confirm the screen loads with the place's current status selected and tagline (if any) prefilled → tap "Temporarily closed" → confirm the reopen-date field appears → fill it in and tap "Update status" → confirm the button briefly shows "Saving…" then "Status updated ✓" → back out and back in (or pull the dashboard's list again) to confirm the status persisted. Repeat for the tagline field.

- [ ] **Step 5: Commit**

```bash
git add "app/owner/place/[id].tsx" app/_layout.tsx
git commit -m "Add per-place manage screen: status and tagline editing"
```

---

### Task 7: Dish list — inline edit, photo, delete

**Files:**
- Modify: `app/owner/place/[id].tsx`

**Interfaces:**
- Consumes: `fetchDishes` (existing, `lib/queries.ts:102-112`), `updateDish`, `deleteDish`, `uploadDishPhoto`, `Dish`, `PickedMedia` types (Task 2); `StarRating` (Task 3).
- Produces: dishes are now fetched and rendered on this screen; `dishes` state is consumed by Task 8's add-dish form.

- [ ] **Step 1: Extend imports and data loading**

In `app/owner/place/[id].tsx`, find the import block:

```tsx
import { fetchPlace, updatePlaceStatus, updatePlaceTagline, type Place } from '@/lib/queries';
```

Replace with:

```tsx
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { StarRating } from '@/components/ui/StarRating';
import {
  fetchPlace,
  fetchDishes,
  updatePlaceStatus,
  updatePlaceTagline,
  updateDish,
  deleteDish,
  uploadDishPhoto,
  type Place,
  type Dish,
} from '@/lib/queries';
```

Also add `Pressable` to the existing `react-native` import list (find `ActivityIndicator,\n  Alert,` at the top of that import block and add `Pressable,` alongside `ScrollView,`).

Find:

```tsx
  const [tagline, setTagline] = useState('');
  const [savingTagline, setSavingTagline] = useState(false);
  const [taglineSaved, setTaglineSaved] = useState(false);
```

Add immediately after:

```tsx

  const [dishes, setDishes] = useState<Dish[]>([]);
```

Find:

```tsx
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchPlace(id)
        .then((data) => {
          setPlace(data);
          setStatus(data.status);
          setReopenDate(data.reopen_date ?? '');
          setTagline(data.tagline ?? '');
        })
        .finally(() => setLoading(false));
    }, [id])
  );
```

Replace with:

```tsx
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.all([fetchPlace(id), fetchDishes(id)])
        .then(([placeData, dishData]) => {
          setPlace(placeData);
          setStatus(placeData.status);
          setReopenDate(placeData.reopen_date ?? '');
          setTagline(placeData.tagline ?? '');
          setDishes(dishData);
        })
        .finally(() => setLoading(false));
    }, [id])
  );
```

- [ ] **Step 2: Add the dish list section to the render**

Find (the final piece of the screen):

```tsx
          <Button
            label={savingTagline ? 'Saving…' : taglineSaved ? 'Saved ✓' : 'Save'}
            variant="dark"
            inline
            loading={savingTagline}
            onPress={onSaveTagline}
          />

          <View style={styles.divider} />
        </ScrollView>
```

Replace with:

```tsx
          <Button
            label={savingTagline ? 'Saving…' : taglineSaved ? 'Saved ✓' : 'Save'}
            variant="dark"
            inline
            loading={savingTagline}
            onPress={onSaveTagline}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Menu</Text>
          {dishes.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              placeId={id}
              onChange={(updated) =>
                setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
              }
              onDelete={async (dishId) => {
                try {
                  await deleteDish(dishId);
                  setDishes((prev) => prev.filter((d) => d.id !== dishId));
                } catch (error) {
                  Alert.alert(
                    'Could not remove dish',
                    error instanceof Error ? error.message : 'Something went wrong.'
                  );
                }
              }}
            />
          ))}
        </ScrollView>
```

- [ ] **Step 3: Add the `DishRow` component and its styles**

After the `ManagePlaceScreen` function's closing brace (before the `const styles = StyleSheet.create({` block), add:

```tsx
function DishRow({
  dish,
  placeId,
  onChange,
  onDelete,
}: {
  dish: Dish;
  placeId: string;
  onChange: (dish: Dish) => void;
  onDelete: (dishId: string) => void;
}) {
  const [name, setName] = useState(dish.name);
  const [tag, setTag] = useState(dish.tag ?? '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function saveField(fields: { name?: string; tag?: string | null; rating?: number | null }) {
    try {
      await updateDish(dish.id, fields);
      onChange({ ...dish, ...fields });
    } catch (error) {
      Alert.alert('Could not save dish', error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  async function onChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to add a dish photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    setUploadingPhoto(true);
    try {
      const url = await uploadDishPhoto(dish.id, placeId, {
        uri: asset.uri,
        mediaType: 'image',
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      onChange({ ...dish, photo_url: url });
    } catch (error) {
      Alert.alert('Could not upload photo', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function onConfirmDelete() {
    Alert.alert('Remove this dish?', dish.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(dish.id) },
    ]);
  }

  return (
    <View style={dishRowStyles.row}>
      <Pressable onPress={onChangePhoto} disabled={uploadingPhoto}>
        {dish.photo_url ? (
          <Image source={{ uri: dish.photo_url }} style={dishRowStyles.photo} contentFit="cover" transition={150} />
        ) : (
          <View style={dishRowStyles.photoPlaceholder}>
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.raspberry} />
            ) : (
              <Text style={dishRowStyles.photoPlaceholderText}>+</Text>
            )}
          </View>
        )}
      </Pressable>

      <View style={dishRowStyles.fields}>
        <TextField
          value={name}
          onChangeText={setName}
          onBlur={() => name.trim() && name !== dish.name && saveField({ name: name.trim() })}
          style={dishRowStyles.nameField}
        />
        <TextField
          value={tag}
          onChangeText={setTag}
          onBlur={() => tag !== (dish.tag ?? '') && saveField({ tag: tag.trim() || null })}
          placeholder="Tag (e.g. Must try)"
          style={dishRowStyles.tagField}
        />
        <StarRating rating={dish.rating} onChange={(rating) => saveField({ rating })} size={18} />
      </View>

      <Pressable onPress={onConfirmDelete} hitSlop={8}>
        <Text style={dishRowStyles.remove}>remove</Text>
      </Pressable>
    </View>
  );
}

const dishRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.creamDeep,
    borderStyle: 'dashed',
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  photoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.inkSoft,
  },
  fields: {
    flex: 1,
    gap: spacing.xs,
  },
  nameField: {
    paddingVertical: spacing.sm,
  },
  tagField: {
    paddingVertical: spacing.sm,
  },
  remove: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.raspberry,
  },
});
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification in Simulator**

On the manage screen for a place that already has at least one dish (if none exist yet, Task 8 adds the ability to create one — for this task, use `execute_sql` to insert one test dish directly, e.g. `insert into dishes (place_id, name) values ('<claimed place id>', 'Test dish');`): confirm the dish row renders with a "+" photo placeholder, editable name/tag fields, and a 5-star row. Edit the name and tab away (blur) → confirm no error and the change persists on next screen load. Tap a star → confirm it saves silently (no error alert). Tap the photo placeholder → confirm the permission prompt and library picker open (per CLAUDE.md, actually picking a photo is a manual-only check — seed a test photo into the Simulator first via `xcrun simctl addmedia <udid> <path>` if none exists, and never seed an app screenshot as the test photo — see CLAUDE.md's Live Text gotcha) → pick one → confirm it uploads and the thumbnail updates. Tap "remove" → confirm the confirm dialog appears → confirm → confirm the row disappears.

- [ ] **Step 6: Commit**

```bash
git add "app/owner/place/[id].tsx"
git commit -m "$(cat <<'EOF'
Add dish list to the manage screen: inline edit, photo, delete

Name/tag edit on blur, tap-to-set star rating, tap-to-replace photo
(uploads to the new dish-photos bucket), delete with a confirm step.
EOF
)"
```

---

### Task 8: Add-dish form

**Files:**
- Modify: `app/owner/place/[id].tsx`

**Interfaces:**
- Consumes: `addDish` (Task 2).
- Produces: nothing consumed by a later task — this is the last piece of the manage screen.

- [ ] **Step 1: Add the import**

Find:

```tsx
import {
  fetchPlace,
  fetchDishes,
  updatePlaceStatus,
  updatePlaceTagline,
  updateDish,
  deleteDish,
  uploadDishPhoto,
  type Place,
  type Dish,
} from '@/lib/queries';
```

Replace with:

```tsx
import {
  fetchPlace,
  fetchDishes,
  updatePlaceStatus,
  updatePlaceTagline,
  updateDish,
  deleteDish,
  uploadDishPhoto,
  addDish,
  type Place,
  type Dish,
} from '@/lib/queries';
```

- [ ] **Step 2: Add state and handler to `ManagePlaceScreen`**

Find:

```tsx
  const [dishes, setDishes] = useState<Dish[]>([]);
```

Replace with:

```tsx
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [newDishName, setNewDishName] = useState('');
  const [addingDish, setAddingDish] = useState(false);
```

Find (inside `ManagePlaceScreen`, right before its `if (loading || !place)` guard):

```tsx
  if (loading || !place) {
```

Add immediately before it:

```tsx
  async function onAddDish() {
    if (!id || !newDishName.trim() || addingDish) return;
    setAddingDish(true);
    try {
      const dish = await addDish(id, { name: newDishName.trim() });
      setDishes((prev) => [...prev, dish]);
      setNewDishName('');
    } catch (error) {
      Alert.alert('Could not add dish', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setAddingDish(false);
    }
  }

  if (loading || !place) {
```

- [ ] **Step 3: Add the form to the render, after the dish list**

Find:

```tsx
          {dishes.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              placeId={id}
              onChange={(updated) =>
                setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
              }
              onDelete={async (dishId) => {
                try {
                  await deleteDish(dishId);
                  setDishes((prev) => prev.filter((d) => d.id !== dishId));
                } catch (error) {
                  Alert.alert(
                    'Could not remove dish',
                    error instanceof Error ? error.message : 'Something went wrong.'
                  );
                }
              }}
            />
          ))}
        </ScrollView>
```

Replace with:

```tsx
          {dishes.map((dish) => (
            <DishRow
              key={dish.id}
              dish={dish}
              placeId={id}
              onChange={(updated) =>
                setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
              }
              onDelete={async (dishId) => {
                try {
                  await deleteDish(dishId);
                  setDishes((prev) => prev.filter((d) => d.id !== dishId));
                } catch (error) {
                  Alert.alert(
                    'Could not remove dish',
                    error instanceof Error ? error.message : 'Something went wrong.'
                  );
                }
              }}
            />
          ))}

          <View style={styles.addDishRow}>
            <TextField
              placeholder="Add a dish…"
              value={newDishName}
              onChangeText={setNewDishName}
              containerStyle={styles.addDishField}
              onSubmitEditing={onAddDish}
              returnKeyType="done"
            />
            <Button label={addingDish ? '…' : 'Add'} inline loading={addingDish} onPress={onAddDish} />
          </View>
        </ScrollView>
```

- [ ] **Step 4: Add the new style**

Find:

```tsx
  divider: {
    borderTopWidth: 2,
    borderTopColor: colors.creamDeep,
    borderStyle: 'dashed',
    marginVertical: spacing.xl,
  },
```

Add immediately after:

```tsx
  addDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addDishField: {
    flex: 1,
  },
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
Expected: no errors.

- [ ] **Step 6: Manual verification in Simulator**

On the manage screen: type a name into "Add a dish…" and tap "Add" → confirm the new dish appears at the bottom of the list immediately, the input clears, and it's immediately editable (name/tag/rating/photo) via `DishRow` from Task 7. Confirm submitting an empty name does nothing (no error, no blank row added).

- [ ] **Step 7: Commit**

```bash
git add "app/owner/place/[id].tsx"
git commit -m "Add add-dish form to the manage screen"
```

---

### Task 9: Café detail — show dish photo thumbnail

**Files:**
- Modify: `app/place/[id].tsx`

**Interfaces:**
- Consumes: `Dish.photo_url` (Task 2, already flows into this screen via the existing `fetchDishes` call — no new query needed).

- [ ] **Step 1: Import `Image`**

Find (top of `app/place/[id].tsx`):

```tsx
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
```

Replace with:

```tsx
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
```

- [ ] **Step 2: Render the thumbnail if present**

Find (`app/place/[id].tsx:158-166`):

```tsx
              dishes.map((dish) => (
                <Card key={dish.id} style={styles.dishCard}>
                  <View style={styles.dishRow}>
                    <Text style={styles.dishName}>{dish.name}</Text>
                    {dish.rating != null && <Text style={styles.dishRating}>{dish.rating}★</Text>}
                  </View>
                  {dish.tag && <Chip label={dish.tag} />}
                </Card>
              ))
```

Replace with:

```tsx
              dishes.map((dish) => (
                <Card key={dish.id} style={styles.dishCard}>
                  <View style={styles.dishRow}>
                    <View style={styles.dishRowLeft}>
                      {dish.photo_url && (
                        <Image
                          source={{ uri: dish.photo_url }}
                          style={styles.dishPhoto}
                          contentFit="cover"
                          transition={150}
                        />
                      )}
                      <Text style={styles.dishName}>{dish.name}</Text>
                    </View>
                    {dish.rating != null && <Text style={styles.dishRating}>{dish.rating}★</Text>}
                  </View>
                  {dish.tag && <Chip label={dish.tag} />}
                </Card>
              ))
```

- [ ] **Step 3: Add the new styles**

Find (`app/place/[id].tsx:387-391`):

```tsx
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
```

Replace with:

```tsx
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dishRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  dishPhoto: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint . --ext .ts,.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification in Simulator**

Open the café detail page for the place whose dish got a photo added in Task 7 → confirm the dish row shows the thumbnail next to its name. Open a café detail page for a place whose dishes have no photo → confirm those rows render exactly as before (no broken image, no layout shift).

- [ ] **Step 6: Commit**

```bash
git add "app/place/[id].tsx"
git commit -m "Show dish photo thumbnail on café detail when present"
```

---

### Task 10: Maestro E2E flow

**Files:**
- Create: `maestro/phase7-owner-dashboard.yaml`

**Interfaces:**
- Consumes: a seed place with no owner. Check first — query `select id, name from places where owner_id is null limit 5;` via `execute_sql`. If none exist (every seed place may have been claimed by manual testing in Tasks 4–5), insert one dedicated to this flow: `insert into places (name, area, city) values ('Maestro Claim Test Café', 'Gachibowli', 'Hyderabad');` — then use that exact name in the flow below.

- [ ] **Step 1: Write the flow**

Create `maestro/phase7-owner-dashboard.yaml` (substitute the actual unclaimed seed place name for `PLACE_NAME`, and its id for `PLACE_ID`, below — get both from the Step-0 `execute_sql` check above):

```yaml
appId: com.reddyscb.lore
---
# Covers the owner dashboard write path: claim an unclaimed place -> land
# on the owner dashboard -> update its status -> add a dish -> remove it.
#
# Assumes seed data: an unclaimed place named "PLACE_NAME" (no owner_id),
# reserved for this flow only. Assumes a signed-in session already exists
# in the simulator.
#
# Note: tab bar items expose composite accessibility labels, so selectors
# below use .*wildcards.* rather than exact text — Maestro's text matcher
# is anchored, not substring.
#
# Important: there is no "unclaim" feature (by design — see
# docs/superpowers/specs/2026-08-06-owner-dashboard-design.md), so this
# flow is only re-runnable from a clean state. Before re-running, reset
# both sides of the claim:
#   update places set owner_id = null, status = 'open', reopen_date = null
#     where id = 'PLACE_ID';
#   update profiles set role = 'seeker' where id = '<test account's id>';
# Without that reset, the Profile button will already read "Owner
# dashboard" instead of "Claim a place" and this flow's early steps won't
# find what they're looking for.
- stopApp
- launchApp
- extendedWaitUntil:
    visible: "Home"
    timeout: 15000
- extendedWaitUntil:
    visible: ".*Profile.*"
    timeout: 8000
- tapOn: ".*Profile.*"
- extendedWaitUntil:
    visible: ".*Claim a place.*"
    timeout: 10000
- tapOn: ".*Claim a place.*"
- extendedWaitUntil:
    visible: "Find your café"
    timeout: 10000
- tapOn: "PLACE_NAME"
- extendedWaitUntil:
    visible: "Managing your places"
    timeout: 10000
- assertVisible: "PLACE_NAME"
- tapOn: "Manage"
- extendedWaitUntil:
    visible: "PLACE_NAME"
    timeout: 10000
- tapOn: "Temporarily closed"
- tapOn: "Expected back (e.g. 25 Jul)"
- inputText: "Maestro test date"
# Single-line field (no `multiline` prop) — pressKey Enter blurs it via
# RN's default blurOnSubmit, same fix CLAUDE.md documents for single-line
# fields. No need for the "tap inert Text" workaround multiline fields need.
- pressKey: Enter
- tapOn: "Update status"
- extendedWaitUntil:
    visible: ".*Status updated.*"
    timeout: 8000
- scrollUntilVisible:
    element: "Add a dish…"
    direction: DOWN
    timeout: 8000
- tapOn: "Add a dish…"
- inputText: "Maestro regression dish"
- pressKey: Enter
- tapOn: "Add"
- extendedWaitUntil:
    visible: ".*Maestro regression dish.*"
    timeout: 8000
- scrollUntilVisible:
    element: ".*Maestro regression dish.*"
    direction: DOWN
    timeout: 8000
- tapOn: "remove"
- tapOn: "Remove"
- assertNotVisible: ".*Maestro regression dish.*"
```

- [ ] **Step 2: Run the flow standalone**

```bash
export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"
maestro test maestro/phase7-owner-dashboard.yaml
```

Expected: all steps `COMPLETED`. If any tap silently doesn't navigate, check CLAUDE.md's "Gotchas hit building this suite" section first (scroll amount, keyboard-open tap misfire, LogBox banner) before assuming new code is broken.

- [ ] **Step 3: Commit**

`scripts/test-e2e.sh` globs `maestro/*.yaml` (confirmed by reading it — no enumerated list to update), so the new flow runs automatically with no runner changes needed.

```bash
git add maestro/phase7-owner-dashboard.yaml
git commit -m "Add Maestro flow for the owner dashboard: claim, status, add/remove dish"
```

---

### Task 11: Phase wrap-up

**Files:** none directly (this task invokes the project's standard wrap-up procedure)

- [ ] **Step 1: Invoke the `phase-wrapup` project skill**

This runs `npx tsc --noEmit` and `npx eslint . --ext .ts,.tsx` project-wide, confirms whether a native rebuild is needed (it is not — this phase adds no new native module, only `expo-image-picker`/`expo-image`, both already installed and configured since Phase 5), runs the full Maestro suite (`npm run test:e2e`), updates `CLAUDE.md`'s "Phase plan" section with a new Phase 7 entry (mirroring the style of Phases 3–6: what shipped, key implementation details, how it was verified, and note dish rating/tag editing didn't exist on web at all before this), and hands back a manual test checklist. Do not commit the `CLAUDE.md` update automatically — the skill's own step 5 already covers that (only commit when the user explicitly asks).

- [ ] **Step 2: Confirm with the user before this task counts as done**

The `phase-wrapup` skill's own checklist ends in a handback, not a commit — nothing further to do here unless its regression run surfaces a real fix, in which case that fix gets its own commit per the skill's guidance.

---

## Self-review notes

(Recorded here per the writing-plans skill's self-review step — not part of the executable plan.)

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-06-owner-dashboard-design.md` maps to a task — navigation (Tasks 4–6), claim (Task 4), dashboard (Task 5), status/tagline (Task 6), dishes incl. photo/rating/tag (Tasks 3, 7, 8), café detail thumbnail (Task 9), schema (Task 1), testing (Tasks 10–11).
- **Type consistency checked:** `Dish` (Task 2) → consumed identically in Tasks 5, 7, 8, 9. `NewDishInput`/`DishUpdateInput` (Task 2) → `addDish`/`updateDish` call sites in Tasks 7–8 match their shapes exactly. `PlaceSummary` (existing, unmodified) → Task 4's `fetchUnclaimedPlaces` return type matches `PlaceListItem`'s existing prop type with no cast needed.
- **No placeholders:** every step has literal code or an exact SQL/CLI command. The reopen-date field's keyboard-dismiss step initially had no concrete answer — resolved by checking the field is single-line (no `multiline` prop), so CLAUDE.md's documented `pressKey: Enter` fix applies directly, avoiding a vague "figure it out from a screenshot" step.
- **Caught during self-review by checking real files instead of trusting memory:** the Maestro flow's `appId` was initially guessed as `com.reddyworks.lorenative` — the actual value, confirmed from `app.json` and every existing `maestro/*.yaml`, is `com.reddyscb.lore`. Also confirmed `scripts/test-e2e.sh` globs `maestro/*.yaml` rather than enumerating flows, so Task 10 doesn't touch it. Also flagged and documented the Expo Router typed-routes staleness gotcha (`.expo/types/router.d.ts` only regenerates while `expo start` is running) as a Global Constraint, since Tasks 4–6 reference routes that don't exist as files until later tasks and a stale type file would otherwise look like a real type error.
- **Caught during the pre-dispatch conflict scan (subagent-driven-development's required pass before Task 1):** the original draft had Task 4 forward-declaring all three `owner/*` `Stack.Screen` entries in `app/_layout.tsx` at once, even though `owner/index` and `owner/place/[id]` don't have files until Tasks 5–6. Since `Stack.Screen`'s `name` prop is a route reference (and this project's typed routes make route-name mistakes a build-time concern generally), forward-declaring a route to a nonexistent file was an unverified assumption not worth carrying into execution. Fixed by moving each `Stack.Screen` registration into the same task that creates its file — Task 4 now registers only `owner/claim`, Task 5 adds `owner/index` (and `app/_layout.tsx` to its Files/commit list), Task 6 adds `owner/place/[id]` (same). Every task's route registration now lands in the same commit as the file it points to.
- **Non-idempotent flow, documented not hidden:** claiming has no reverse operation (matches the design spec's explicit YAGNI decision), so `phase7-owner-dashboard.yaml` can only run clean-to-clean. Rather than build untested conditional Maestro logic to paper over that, the flow's header comment documents the exact SQL reset needed before a re-run — consistent with how CLAUDE.md already documents non-idempotency tradeoffs for the Phase 3/4 write flows.
