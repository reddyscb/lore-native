# Phase 9 — Performance Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the concrete list-virtualization, image-caching, and navigation-transition gaps found in `lore-native`, verify the fixes with a real before/after profiling measurement on the app's 4 media-heavy screens, then bring `README.md` up to date with the app's actual state through Phase 9.

**Architecture:** No new subsystems — this is a tuning pass across existing screens. Every list screen already uses `FlatList` except `app/events.tsx` (converted here); every image already uses `expo-image`; navigation already uses Expo Router's native Stack. The work is: (1) memoize list row components and stabilize `renderItem`/`keyExtractor` so FlatList's virtualization isn't defeated by new closures every render, (2) add FlatList tuning props, (3) set explicit `expo-image` cache policy, (4) enable `react-native-screens`' `freezeOnBlur` on pushed screens, (5) measure before/after with CLI-only profiling tools, (6) refresh docs.

**Tech Stack:** Expo SDK 54, Expo Router (native Stack via `react-native-screens` 4.16), `expo-image`, React Native `FlatList`. Profiling: `xcrun simctl`/`xctrace` (CLI-only — no Instruments GUI available in this environment), React Native's in-app Perf Monitor overlay, `idb` for scripted touch/swipe input.

## Global Constraints

- No behavior change for users — this pass changes performance characteristics only. `npm run test:e2e` (the full Maestro suite) must stay green throughout; if any flow's behavior changes, that's a bug in this pass, not an accepted regression.
- All colors/fonts/spacing continue to come from `constants/theme.ts` — no new inline hex values or magic numbers (per CLAUDE.md's "Conventions").
- Import paths use the `@/` alias, consistent with the rest of the codebase.
- Every FlatList tuning pass in this plan uses the same four values for consistency: `initialNumToRender={8}`, `maxToRenderPerBatch={8}`, `windowSize={7}`, `removeClippedSubviews`.
- No unit test framework exists in this repo (confirmed: `package.json` has no Jest/Testing Library, only `expo lint` and the Maestro-driven `test:e2e`). Verification per task is `npx tsc --noEmit` + `npx eslint` on the touched files, consistent with how Phases 6–8 verified non-schema changes — do not introduce a new test framework as part of this pass, that's out of scope.
- Profiling in this environment is CLI-only: `xcrun xctrace record`/`export` and RN's in-app Perf Monitor overlay, driven via scripted `idb`/Maestro gestures. There is no way to drive the Xcode Instruments GUI interactively here — don't attempt it.

---

## Profiling artifacts convention (applies to Tasks 1 and 11)

Both profiling tasks write into `docs/superpowers/plans/phase9-profiling/` at the repo root:
- `before/` and `after/` subfolders, each holding one `<screen-slug>-fps.png` Perf Monitor screenshot per screen (at rest and mid-scroll — two screenshots per screen) and one `<screen-slug>-xctrace-summary.txt` per screen (the text/CSV `xcrun xctrace export` output, not the raw `.trace` bundle — those are large binary directories and don't belong in git).
- `comparison.md` (written in Task 11) — the before/after FPS numbers and any notable hot-symbol changes, in prose, for all 4 screens.

The 4 screens, with slugs used for filenames: `home` (Home feed, `app/(tabs)/index.tsx`), `cafe-detail` (`app/place/[id].tsx`, use the seed place "The Copper Pot" or "Ruskin & Rye" per CLAUDE.md's Maestro seed-data list — pick whichever currently has the most drops/media), `messages-thread` (`app/messages/[conversationId].tsx`, any existing thread with a few messages — start one via `/messages/new` first if none exists), `explore` (`app/(tabs)/explore.tsx`, empty search box so the full unfiltered result set renders).

---

### Task 1: Baseline profiling capture (before any code change)

**Files:**
- Create: `docs/superpowers/plans/phase9-profiling/before/home-fps.png` (and 3 more `*-fps.png`, one pair — rest + mid-scroll — per screen, so 8 PNGs total)
- Create: `docs/superpowers/plans/phase9-profiling/before/*-xctrace-summary.txt` (one per screen, 4 total)

**Interfaces:**
- Produces: baseline FPS screenshots and xctrace summaries for `home`, `cafe-detail`, `messages-thread`, `explore` — Task 11 reads these back to write the comparison.

- [ ] **Step 1: Confirm a Simulator is booted with a signed-in session**

```bash
xcrun simctl list devices booted
```

If nothing is booted, boot one (per CLAUDE.md's Maestro prerequisites — "always try `simctl boot` before assuming no Simulator" — this has reliably worked in every prior phase in this repo):

```bash
xcrun simctl boot "iPhone 16"
```

The app must already be installed and signed in (Phase 6–8 precedent: auth can't be scripted). If it isn't, stop and ask the user to sign in manually before continuing — don't attempt to script login.

- [ ] **Step 2: Enable RN's in-app Perf Monitor**

Open the dev menu (`Cmd+D` via `xcrun simctl` doesn't send this directly — shake gesture or `idb ui` key command works; the simplest reliable path in this repo's Simulator setup is to background/foreground the app and use the on-screen dev menu button if one is exposed, or run `xcrun simctl openurl booted "<dev-client-url>?enableDevMenu=1"` if the dev client supports it). If none of those are reliable, use `idb` to send the keyboard shortcut `Cmd+D` to the Simulator window via `idb ui key --keycode` is not directly supported for modifier combos — fall back to: in the running app, shake the Simulator via **Device → Shake** in the Simulator app menu (this is a real menu item, not GUI automation of arbitrary controls — it's the documented way to trigger RN's dev menu on Simulator), then tap "Show Perf Monitor" in the menu that appears (use `idb ui describe-all` to find its coordinates, same convention CLAUDE.md documents for native alert buttons).

Confirm the overlay is visible (small text block reading `JS: NN fps` / `UI: NN fps` in a top corner) via a screenshot before proceeding.

- [ ] **Step 3: For each of the 4 screens, capture at-rest and mid-scroll FPS**

For each screen (`home`, `cafe-detail`, `messages-thread`, `explore`):

1. Navigate to the screen (via the tab bar or the relevant push, same navigation any user would use).
2. Screenshot at rest:
   ```bash
   xcrun simctl io booted screenshot docs/superpowers/plans/phase9-profiling/before/<slug>-fps-rest.png
   ```
3. Drive a scripted scroll through the list — a swipe gesture repeated 3 times, e.g. via `idb`:
   ```bash
   idb ui swipe --duration 0.3 200 600 200 200
   idb ui swipe --duration 0.3 200 600 200 200
   idb ui swipe --duration 0.3 200 600 200 200
   ```
   (coordinates are illustrative — get the actual list's on-screen bounds via `idb ui describe-all` first, same convention CLAUDE.md already documents for reliable tap coordinates, and swipe within them.)
4. Screenshot immediately after the last swipe, while the list is still settling:
   ```bash
   xcrun simctl io booted screenshot docs/superpowers/plans/phase9-profiling/before/<slug>-fps-scroll.png
   ```

Rename the "rest" screenshot to `<slug>-fps.png` per the artifacts convention above (keep only one representative "mid-scroll" number in the write-up — the two-screenshot capture above is to give you both a rest and a scroll reading, but the convention section says one `*-fps.png` per screen; use the mid-scroll one since that's the interesting number, and note the rest number in the summary `.txt` instead).

- [ ] **Step 4: Capture one Time Profiler trace per screen**

```bash
xcrun xctrace record --template "Time Profiler" --device booted \
  --output docs/superpowers/plans/phase9-profiling/before/<slug>.trace \
  --time-limit 5s
```

Trigger the same 3-swipe scroll (Step 3.3) during the 5-second recording window. Then export a human-readable summary and delete the large binary trace (it doesn't get committed):

```bash
xcrun xctrace export --input docs/superpowers/plans/phase9-profiling/before/<slug>.trace \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]' \
  > docs/superpowers/plans/phase9-profiling/before/<slug>-xctrace-summary.txt
rm -rf docs/superpowers/plans/phase9-profiling/before/<slug>.trace
```

If `xctrace export`'s XPath schema name differs on the installed Xcode version (check with `xcrun xctrace export --input <trace> --toc` first to see the actual schema names available), use whatever table corresponds to the time-profile / CPU-sampling data — the goal is a text export of where CPU time went during the scroll, not that exact XPath string.

- [ ] **Step 5: Commit the baseline artifacts**

```bash
git add docs/superpowers/plans/phase9-profiling/before/
git commit -m "Capture Phase 9 baseline profiling (before fixes)"
```

---

### Task 2: Memoize shared list row components

**Files:**
- Modify: `components/ui/DropCard.tsx`
- Modify: `components/ui/PlaceListItem.tsx`
- Modify: `components/ui/ReplyRow.tsx`

**Interfaces:**
- Produces: `DropCard`, `PlaceListItem`, `ReplyRow` remain named exports with identical prop types — every existing call site keeps working unchanged. Later tasks (3–8) rely on these already being `React.memo`-wrapped when they add stable `renderItem`/`keyExtractor` around them.

- [ ] **Step 1: Wrap `DropCard` in `React.memo`**

In `components/ui/DropCard.tsx`, add `memo` to the React import and wrap the export:

```tsx
import { memo, useCallback } from 'react';
```

Wait — `DropCard` doesn't use `useCallback` internally; only add `memo`:

```tsx
import { memo } from 'react';
import { useRouter } from 'expo-router';
```

Change:

```tsx
export function DropCard({ drop, place }: Props) {
```

to:

```tsx
export const DropCard = memo(function DropCard({ drop, place }: Props) {
```

and change the closing brace of the function (currently the last `}` before the `const styles = StyleSheet.create({...})` block) from:

```tsx
}
```

to:

```tsx
});
```

- [ ] **Step 2: Wrap `PlaceListItem` in `React.memo`**

In `components/ui/PlaceListItem.tsx`, add the import:

```tsx
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
```

Change:

```tsx
export function PlaceListItem({ place, onPress }: Props) {
```

to:

```tsx
export const PlaceListItem = memo(function PlaceListItem({ place, onPress }: Props) {
```

and its closing `}` to `});`.

- [ ] **Step 3: Wrap `ReplyRow` in `React.memo`**

In `components/ui/ReplyRow.tsx`, add the import:

```tsx
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
```

Change:

```tsx
export function ReplyRow({ reply }: Props) {
```

to:

```tsx
export const ReplyRow = memo(function ReplyRow({ reply }: Props) {
```

and its closing `}` to `});`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx eslint components/ui/DropCard.tsx components/ui/PlaceListItem.tsx components/ui/ReplyRow.tsx
```

Both must be clean. `DropCard` is also used directly (not just via a `FlatList`) in `app/place/[id].tsx` — confirm that file still type-checks with no changes needed there (it consumes `DropCard` as a plain component either way, `memo()`-wrapped components are called identically).

- [ ] **Step 5: Commit**

```bash
git add components/ui/DropCard.tsx components/ui/PlaceListItem.tsx components/ui/ReplyRow.tsx
git commit -m "Memoize DropCard, PlaceListItem, and ReplyRow"
```

---

### Task 3: Home + Explore tabs — stable renderItem/keyExtractor + FlatList tuning

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/explore.tsx`

**Interfaces:**
- Consumes: `DropCard`, `PlaceListItem` from Task 2 (already memoized).

- [ ] **Step 1: Home — stabilize renderItem/keyExtractor**

In `app/(tabs)/index.tsx`, after the `onRefresh` callback (before the `if (loading)` block), add:

```tsx
  const keyExtractor = useCallback((item: Drop) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Drop }) => (
      <DropCard drop={item} place={item.places ? { id: item.place_id, ...item.places } : undefined} />
    ),
    []
  );
```

Then change the `FlatList` props:

```tsx
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DropCard drop={item} place={item.places ? { id: item.place_id, ...item.places } : undefined} />
        )}
```

to:

```tsx
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

- [ ] **Step 2: Explore — stabilize renderItem/keyExtractor**

In `app/(tabs)/explore.tsx`, after the `availablePrices` `useMemo` (before the `return`), add:

```tsx
  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => (
      <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
    ),
    [router]
  );
```

Then change the `FlatList` props:

```tsx
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
        )}
```

to:

```tsx
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx eslint "app/(tabs)/index.tsx" "app/(tabs)/explore.tsx"
```

- [ ] **Step 4: Manual smoke check**

Boot/reuse the Simulator, open Home and Explore, confirm both still scroll and show data exactly as before (no visual change expected — this task is pure performance tuning).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" "app/(tabs)/explore.tsx"
git commit -m "Stabilize renderItem/keyExtractor and tune FlatList on Home and Explore"
```

---

### Task 4: Passport + Diary — memoize local row components + stable callbacks + tuning

**Files:**
- Modify: `app/(tabs)/passport.tsx`
- Modify: `app/diary.tsx`

**Interfaces:**
- Produces: `StampCell` (passport.tsx, local) and `DiaryEntryCard` (diary.tsx, local) become `React.memo`-wrapped — both stay local to their files, no new exports.

- [ ] **Step 1: Passport — memoize `StampCell`**

In `app/(tabs)/passport.tsx`, add `memo` to the React import:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useEffect, useState } from 'react';
```

Change:

```tsx
function StampCell({
  place,
  collected,
  onPress,
}: {
  place: PlaceSummary;
  collected: boolean;
  onPress: () => void;
}) {
```

to:

```tsx
const StampCell = memo(function StampCell({
  place,
  collected,
  onPress,
}: {
  place: PlaceSummary;
  collected: boolean;
  onPress: () => void;
}) {
```

and its closing `}` (right before `const styles = StyleSheet.create({...})`) to `});`.

- [ ] **Step 2: Passport — stabilize renderItem/keyExtractor**

After the `onRefresh` callback (before the `if (loading)` block), add:

```tsx
  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => (
      <StampCell
        place={item}
        collected={stamped.has(item.id)}
        onPress={() => router.push(`/place/${item.id}`)}
      />
    ),
    [stamped, router]
  );
```

Then change the `FlatList` props:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => (
          <StampCell
            place={item}
            collected={stamped.has(item.id)}
            onPress={() => router.push(`/place/${item.id}`)}
          />
        )}
```

to:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 3: Diary — memoize `DiaryEntryCard`**

In `app/diary.tsx`, add `memo` to the React import:

```tsx
import { useCallback, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useState } from 'react';
```

Change:

```tsx
function DiaryEntryCard({ entry }: { entry: DiaryEntry }) {
```

to:

```tsx
const DiaryEntryCard = memo(function DiaryEntryCard({ entry }: { entry: DiaryEntry }) {
```

and its closing `}` (right before `const styles = StyleSheet.create({...})`) to `});`.

- [ ] **Step 4: Diary — stabilize renderItem/keyExtractor + tuning**

After the `useFocusEffect` block (before the `if (loading)` block), add:

```tsx
  const keyExtractor = useCallback((item: DiaryEntry) => item.id, []);
  const renderItem = useCallback(({ item }: { item: DiaryEntry }) => <DiaryEntryCard entry={item} />, []);
```

Then change the `FlatList` props:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => <DiaryEntryCard entry={item} />}
```

to:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx eslint "app/(tabs)/passport.tsx" app/diary.tsx
```

- [ ] **Step 6: Manual smoke check**

Open Passport (confirm the two-column stamp grid still renders and the "Stamp collected" toast still works after a check-in) and Diary (confirm entries still render). No visual change expected.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/passport.tsx" app/diary.tsx
git commit -m "Memoize Passport/Diary row components and tune their FlatLists"
```

---

### Task 5: Collections (index + detail) — extract/memoize row + stable callbacks + tuning

**Files:**
- Modify: `app/collections/index.tsx`
- Modify: `app/collections/[id].tsx`

**Interfaces:**
- Consumes: `PlaceListItem` from Task 2 (already memoized), used by `collections/[id].tsx`.
- Produces: new local memoized `CollectionRow` component in `collections/index.tsx` (not exported — this screen is the only consumer).

- [ ] **Step 1: Collections index — extract and memoize `CollectionRow`**

In `app/collections/index.tsx`, add `memo` and `useCallback` to the React import:

```tsx
import { useCallback, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useState } from 'react';
```

Add this new component above `const styles = StyleSheet.create({...})` (after the `CollectionsScreen` function's closing brace):

```tsx
const CollectionRow = memo(function CollectionRow({
  collection,
  onPress,
}: {
  collection: CollectionWithCount;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <Text style={styles.name}>{collection.name}</Text>
        <Text style={styles.count}>
          {collection.placeCount} place{collection.placeCount === 1 ? '' : 's'} saved
        </Text>
      </Card>
    </Pressable>
  );
});
```

(This references `styles`, which is declared further down in the same file as a top-level `const` — that's fine in JS/TS since `styles` is only read when `CollectionRow` actually renders, well after module evaluation completes.)

- [ ] **Step 2: Collections index — stabilize renderItem/keyExtractor + tuning**

Before the `if (loading)` block, add:

```tsx
  const keyExtractor = useCallback((item: CollectionWithCount) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: CollectionWithCount }) => (
      <CollectionRow collection={item} onPress={() => router.push(`/collections/${item.id}`)} />
    ),
    [router]
  );
```

Then change the `FlatList`:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/collections/${item.id}`)}>
            <Card style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.count}>
                {item.placeCount} place{item.placeCount === 1 ? '' : 's'} saved
              </Text>
            </Card>
          </Pressable>
        )}
```

to:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 3: Collections detail — stabilize renderItem/keyExtractor + tuning**

In `app/collections/[id].tsx`, add the `useCallback` import:

```tsx
import { useEffect, useState } from 'react';
```

becomes:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

Before the `if (loading)` block, add:

```tsx
  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => (
      <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
    ),
    [router]
  );
```

Then change the `FlatList`:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => (
          <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
        )}
```

to:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx eslint app/collections/index.tsx "app/collections/[id].tsx"
```

- [ ] **Step 5: Manual smoke check**

Open Collections, tap into a collection with saved places, confirm both screens render identically to before.

- [ ] **Step 6: Commit**

```bash
git add app/collections/index.tsx "app/collections/[id].tsx"
git commit -m "Memoize Collections row components and tune their FlatLists"
```

---

### Task 6: Owner dashboard (index + claim) — extract/memoize row + stable callbacks + tuning

**Files:**
- Modify: `app/owner/index.tsx`
- Modify: `app/owner/claim.tsx`

**Interfaces:**
- Consumes: `PlaceListItem` from Task 2, used by `owner/claim.tsx`.
- Produces: new local memoized `OwnedPlaceRow` component in `owner/index.tsx`.

- [ ] **Step 1: Owner index — extract and memoize `OwnedPlaceRow`**

In `app/owner/index.tsx`, add `memo` to the React import:

```tsx
import { useCallback, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useState } from 'react';
```

Add this new component above `const styles = StyleSheet.create({...})`:

```tsx
const OwnedPlaceRow = memo(function OwnedPlaceRow({
  place,
  onManage,
}: {
  place: OwnedPlace;
  onManage: () => void;
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.name}>{place.name}</Text>
      <Text style={styles.meta}>{[place.area, place.price_range].filter(Boolean).join(' · ')}</Text>
      <StatusBadge status={place.status} reopenDate={place.reopen_date} />
      <Button label="Manage" variant="secondary" inline onPress={onManage} />
    </Card>
  );
});
```

- [ ] **Step 2: Owner index — stabilize renderItem/keyExtractor + tuning**

Before the `if (loading)` block, add:

```tsx
  const keyExtractor = useCallback((item: OwnedPlace) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: OwnedPlace }) => (
      <OwnedPlaceRow place={item} onManage={() => router.push(`/owner/place/${item.id}`)} />
    ),
    [router]
  );
```

Then change the `FlatList`:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{[item.area, item.price_range].filter(Boolean).join(' · ')}</Text>
            <StatusBadge status={item.status} reopenDate={item.reopen_date} />
            <Button
              label="Manage"
              variant="secondary"
              inline
              onPress={() => router.push(`/owner/place/${item.id}`)}
            />
          </Card>
        )}
```

to:

```tsx
        renderItem={renderItem}
```

**Note for Task 12's Maestro re-run:** `phase7-owner-dashboard.yaml` uses the relative selector `tapOn: { text: "Manage", below: ".*<place name>.*" }` documented in CLAUDE.md because each place's Card was a plain `View`, not a single `Pressable`, making every "Manage" button textually identical. That structural fact is unchanged by this refactor (`OwnedPlaceRow` still renders a `Card` with a separate `Button`, not one big `Pressable`) — the relative selector still applies with no flow-file changes needed.

- [ ] **Step 3: Owner claim — stabilize onClaim + renderItem/keyExtractor + tuning**

In `app/owner/claim.tsx`, add the `useCallback` import:

```tsx
import { useEffect, useState } from 'react';
```

becomes:

```tsx
import { useCallback, useEffect, useState } from 'react';
```

Replace the `onClaim` function:

```tsx
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
```

with:

```tsx
  const onClaim = useCallback(
    async (placeId: string) => {
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
    },
    [userId, claimingId, refreshProfile, router]
  );

  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => <PlaceListItem place={item} onPress={() => onClaim(item.id)} />,
    [onClaim]
  );
```

Then change the `FlatList`:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => <PlaceListItem place={item} onPress={() => onClaim(item.id)} />}
```

to:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx eslint app/owner/index.tsx app/owner/claim.tsx
```

- [ ] **Step 5: Manual smoke check**

Open the Owner dashboard (if the signed-in test account already owns a place from a prior Maestro run) and the claim screen, confirm both render and the "Manage"/claim actions still work.

- [ ] **Step 6: Commit**

```bash
git add app/owner/index.tsx app/owner/claim.tsx
git commit -m "Memoize Owner dashboard row components and tune their FlatLists"
```

---

### Task 7: Messages (inbox + new + thread) — extract/memoize rows + stable callbacks + tuning

**Files:**
- Modify: `app/messages/index.tsx`
- Modify: `app/messages/new.tsx`
- Modify: `app/messages/[conversationId].tsx`

**Interfaces:**
- Produces: new local memoized `ConversationRow` (inbox) and `PersonRow` (new.tsx); `MessageBubble` (thread) becomes `React.memo`-wrapped but keeps its existing named export (nothing outside this file imports it today, but it's exported per the existing code — preserve that).

- [ ] **Step 1: Inbox — extract and memoize `ConversationRow`**

In `app/messages/index.tsx`, add `memo` and `useCallback` to the React import:

```tsx
import { useCallback, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useState } from 'react';
```

Add this new component above `const styles = StyleSheet.create({...})` (after `previewText`):

```tsx
const ConversationRow = memo(function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar
            uri={conversation.other_participant.avatar_url}
            name={conversation.other_participant.display_name}
            size={44}
          />
          <View style={styles.textCol}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{conversation.other_participant.display_name ?? 'Someone'}</Text>
              {conversation.unread && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.preview} numberOfLines={1}>
              {previewText(conversation)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});
```

- [ ] **Step 2: Inbox — stabilize renderItem/keyExtractor + tuning**

Before the `if (loading)` block, add:

```tsx
  const keyExtractor = useCallback((item: Conversation) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow conversation={item} onPress={() => router.push(`/messages/${item.id}`)} />
    ),
    [router]
  );
```

Then change the `FlatList`:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and replace the whole inline `renderItem` block:

```tsx
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/messages/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Avatar
                  uri={item.other_participant.avatar_url}
                  name={item.other_participant.display_name}
                  size={44}
                />
                <View style={styles.textCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.other_participant.display_name ?? 'Someone'}</Text>
                    {item.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {previewText(item)}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
```

with:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 3: New message — extract and memoize `PersonRow`, stabilize `onSelect`**

In `app/messages/new.tsx`, add the imports:

```tsx
import { useEffect, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useEffect, useState } from 'react';
```

Replace the `onSelect` function:

```tsx
  async function onSelect(otherUserId: string) {
    if (startingId) return;
    setStartingId(otherUserId);
    try {
      const conversationId = await getOrCreateDirectConversation(otherUserId);
      // replace, not push: backing out of a freshly started thread should
      // return to the inbox, not back to this search screen.
      router.replace(`/messages/${conversationId}`);
    } catch (error) {
      Alert.alert('Could not start conversation', error instanceof Error ? error.message : 'Something went wrong.');
      setStartingId(null);
    }
  }
```

with:

```tsx
  const onSelect = useCallback(
    async (otherUserId: string) => {
      if (startingId) return;
      setStartingId(otherUserId);
      try {
        const conversationId = await getOrCreateDirectConversation(otherUserId);
        // replace, not push: backing out of a freshly started thread should
        // return to the inbox, not back to this search screen.
        router.replace(`/messages/${conversationId}`);
      } catch (error) {
        Alert.alert('Could not start conversation', error instanceof Error ? error.message : 'Something went wrong.');
        setStartingId(null);
      }
    },
    [startingId, router]
  );

  const keyExtractor = useCallback((item: ProfileSearchResult) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: ProfileSearchResult }) => (
      <PersonRow person={item} starting={startingId === item.id} onPress={() => onSelect(item.id)} />
    ),
    [startingId, onSelect]
  );
```

Add this new component above `const styles = StyleSheet.create({...})`:

```tsx
const PersonRow = memo(function PersonRow({
  person,
  starting,
  onPress,
}: {
  person: ProfileSearchResult;
  starting: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={starting}>
      <Avatar uri={person.avatar_url} name={person.display_name} size={44} />
      <Text style={styles.name}>{person.display_name ?? 'Someone'}</Text>
      {starting && <ActivityIndicator color={colors.raspberry} style={styles.spinner} />}
    </Pressable>
  );
});
```

Then change the `FlatList`:

```tsx
        keyExtractor={(item) => item.id}
```

to:

```tsx
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
```

and:

```tsx
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item.id)} disabled={startingId === item.id}>
            <Avatar uri={item.avatar_url} name={item.display_name} size={44} />
            <Text style={styles.name}>{item.display_name ?? 'Someone'}</Text>
            {startingId === item.id && <ActivityIndicator color={colors.raspberry} style={styles.spinner} />}
          </Pressable>
        )}
```

to:

```tsx
        renderItem={renderItem}
```

- [ ] **Step 4: Thread — memoize `MessageBubble`, stabilize `onLongPressMessage` + renderItem/keyExtractor + tuning**

In `app/messages/[conversationId].tsx`, add `memo` to the React import:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
```

becomes:

```tsx
import { memo, useCallback, useEffect, useRef, useState } from 'react';
```

Replace the `onLongPressMessage` function:

```tsx
  function onLongPressMessage(message: Message) {
    if (message.sender_id !== selfId) return;
    Alert.alert('Delete this message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(message.id);
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
          } catch (error) {
            Alert.alert('Could not delete', error instanceof Error ? error.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }
```

with:

```tsx
  const onLongPressMessage = useCallback(
    (message: Message) => {
      if (message.sender_id !== selfId) return;
      Alert.alert('Delete this message?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(message.id);
              setMessages((prev) => prev.filter((m) => m.id !== message.id));
            } catch (error) {
              Alert.alert('Could not delete', error instanceof Error ? error.message : 'Something went wrong.');
            }
          },
        },
      ]);
    },
    [selfId]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isSelf={item.sender_id === selfId}
        onLongPress={() => onLongPressMessage(item)}
      />
    ),
    [selfId, onLongPressMessage]
  );
```

Then change the `FlatList`:

```tsx
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isSelf={item.sender_id === selfId}
              onLongPress={() => onLongPressMessage(item)}
            />
          )}
```

to:

```tsx
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
```

Finally, memoize `MessageBubble` itself. Change:

```tsx
export function MessageBubble({
  message,
  isSelf,
  onLongPress,
}: {
  message: Message;
  isSelf: boolean;
  onLongPress: () => void;
}) {
```

to:

```tsx
export const MessageBubble = memo(function MessageBubble({
  message,
  isSelf,
  onLongPress,
}: {
  message: Message;
  isSelf: boolean;
  onLongPress: () => void;
}) {
```

and its closing `}` (right before `const styles = StyleSheet.create({...})`) to `});`.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx eslint app/messages/index.tsx app/messages/new.tsx "app/messages/[conversationId].tsx"
```

- [ ] **Step 6: Manual smoke check**

Open the Messages inbox, start/open a thread, send a text message, confirm the realtime-echo dedup guard (`seenIds`) still prevents a duplicate bubble — this is the exact regression class the `[conversationId].tsx` header comment warns about, so specifically watch for a doubled message after sending.

- [ ] **Step 7: Commit**

```bash
git add app/messages/index.tsx app/messages/new.tsx "app/messages/[conversationId].tsx"
git commit -m "Memoize Messages row components and tune their FlatLists"
```

---

### Task 8: Convert `events.tsx` from ScrollView+map to FlatList

**Files:**
- Modify: `app/events.tsx`

**Interfaces:**
- Produces: `EventsScreen` renders identically (same header, banner, tickets section, event cards, reserve flow) but the events list is now a virtualized `FlatList` instead of a `ScrollView` + `.map()`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
```

to:

```tsx
import { memo, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
```

- [ ] **Step 2: Stabilize `onReserve` and add renderItem/keyExtractor**

Replace the `onReserve` function:

```tsx
  async function onReserve(eventId: string, count: number) {
    if (!userId) return;
    try {
      const result = await reserveTickets(eventId, userId, count);
      setBanner(result === 'ok' ? { kind: 'reserved' } : { kind: 'sold-out' });
      // Refetch either way: on success to pick up the new count, on failure
      // because a stale "N left" is exactly what caused the failure.
      await load();
    } catch (error) {
      Alert.alert(
        'Could not reserve',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    }
  }
```

with:

```tsx
  const onReserve = useCallback(
    async (eventId: string, count: number) => {
      if (!userId) return;
      try {
        const result = await reserveTickets(eventId, userId, count);
        setBanner(result === 'ok' ? { kind: 'reserved' } : { kind: 'sold-out' });
        // Refetch either way: on success to pick up the new count, on failure
        // because a stale "N left" is exactly what caused the failure.
        await load();
      } catch (error) {
        Alert.alert(
          'Could not reserve',
          error instanceof Error ? error.message : 'Something went wrong.'
        );
      }
    },
    [userId, load]
  );

  const keyExtractor = useCallback((item: EventRow) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: EventRow }) => (
      <EventCard event={item} canReserve={!!userId} onReserve={(count) => onReserve(item.id, count)} />
    ),
    [userId, onReserve]
  );
```

- [ ] **Step 3: Replace the ScrollView body with a FlatList**

Replace the entire `return (...)` block:

```tsx
  return (
    <ScreenContainer hasHeader padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <PageHeader
          eyebrow="Events & Pop-Ups"
          title="What's on this week"
          subtitle="Ticketed nights and tastings — reserve your spot ahead of time."
        />

        {banner?.kind === 'reserved' && (
          <View style={[styles.banner, styles.bannerOk]}>
            <Text style={styles.bannerText}>Reserved ✓</Text>
          </View>
        )}
        {banner?.kind === 'sold-out' && (
          <View style={[styles.banner, styles.bannerError]}>
            <Text style={styles.bannerText}>
              Not enough tickets left for that request — someone else may have just booked ahead of
              you.
            </Text>
          </View>
        )}

        {tickets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your tickets</Text>
            {tickets.map((ticket) => (
              <Card key={ticket.id} style={styles.ticketCard}>
                <Text style={styles.ticketText}>
                  🎟️ {ticket.count} × {ticket.events?.title ?? 'An event'}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {events.length === 0 && <Text style={styles.empty}>Nothing on the calendar yet.</Text>}
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              canReserve={!!userId}
              onReserve={(count) => onReserve(event.id, count)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
```

with:

```tsx
  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        data={events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            <PageHeader
              eyebrow="Events & Pop-Ups"
              title="What's on this week"
              subtitle="Ticketed nights and tastings — reserve your spot ahead of time."
            />

            {banner?.kind === 'reserved' && (
              <View style={[styles.banner, styles.bannerOk]}>
                <Text style={styles.bannerText}>Reserved ✓</Text>
              </View>
            )}
            {banner?.kind === 'sold-out' && (
              <View style={[styles.banner, styles.bannerError]}>
                <Text style={styles.bannerText}>
                  Not enough tickets left for that request — someone else may have just booked ahead
                  of you.
                </Text>
              </View>
            )}

            {tickets.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your tickets</Text>
                {tickets.map((ticket) => (
                  <Card key={ticket.id} style={styles.ticketCard}>
                    <Text style={styles.ticketText}>
                      🎟️ {ticket.count} × {ticket.events?.title ?? 'An event'}
                    </Text>
                  </Card>
                ))}
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.upcomingTitle]}>Upcoming</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing on the calendar yet.</Text>}
      />
    </ScreenContainer>
  );
```

- [ ] **Step 4: Add the `upcomingTitle` style and memoize `EventCard`**

In the `styles` object, add a new key right after `sectionTitle`:

```tsx
  sectionTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  upcomingTitle: {
    marginTop: spacing.lg,
  },
```

Wrap `EventCard` in `memo`. Change:

```tsx
function EventCard({
  event,
  canReserve,
  onReserve,
}: {
  event: EventRow;
  canReserve: boolean;
  onReserve: (count: number) => Promise<void>;
}) {
```

to:

```tsx
const EventCard = memo(function EventCard({
  event,
  canReserve,
  onReserve,
}: {
  event: EventRow;
  canReserve: boolean;
  onReserve: (count: number) => Promise<void>;
}) {
```

and its closing `}` (right before the `function Stepper(...)` declaration) to `});`.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx eslint app/events.tsx
```

- [ ] **Step 6: Manual smoke check**

Open Events. Confirm: header/subtitle render, "Your tickets" section still shows existing tickets (if the test account has any from prior Maestro runs), the events list renders below an "Upcoming" heading, and reserving a ticket still shows the "Reserved ✓" banner and updates the remaining count — the exact `phase4-events.yaml` flow.

- [ ] **Step 7: Run the existing Events Maestro flow**

```bash
export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"
bash scripts/test-e2e.sh maestro/phase4-events.yaml
```

Per CLAUDE.md, this flow may already fail for a pre-existing, unrelated reason (the seed event's `tickets_total` headroom already consumed) — if it fails, check whether the failure reason matches that known cause (not a new regression from this task) before concluding this task is broken.

- [ ] **Step 8: Commit**

```bash
git add app/events.tsx
git commit -m "Convert events.tsx from ScrollView to a virtualized FlatList"
```

---

### Task 9: expo-image explicit cache policy + recyclingKey

**Files:**
- Modify: `components/ui/Avatar.tsx`
- Modify: `components/ui/MediaStrip.tsx`
- Modify: `app/place/[id].tsx`
- Modify: `app/owner/place/[id].tsx`

**Interfaces:**
- No prop/type changes to any of these components — purely additive `expo-image` props.

- [ ] **Step 1: `Avatar` — cachePolicy + recyclingKey**

In `components/ui/Avatar.tsx`, change:

```tsx
      <Image
        source={{ uri }}
        style={[styles.image, dimension]}
        contentFit="cover"
        transition={150}
      />
```

to:

```tsx
      <Image
        source={{ uri }}
        style={[styles.image, dimension]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={uri}
      />
```

- [ ] **Step 2: `MediaStrip` — cachePolicy + recyclingKey**

In `components/ui/MediaStrip.tsx`, change:

```tsx
            <Image source={{ uri: item.url }} style={styles.thumb} contentFit="cover" transition={150} />
```

to:

```tsx
            <Image
              source={{ uri: item.url }}
              style={styles.thumb}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={item.id}
            />
```

- [ ] **Step 3: Café detail dish photo — cachePolicy**

In `app/place/[id].tsx`, change:

```tsx
                      {dish.photo_url && (
                        <Image
                          source={{ uri: dish.photo_url }}
                          style={styles.dishPhoto}
                          contentFit="cover"
                          transition={150}
                        />
                      )}
```

to:

```tsx
                      {dish.photo_url && (
                        <Image
                          source={{ uri: dish.photo_url }}
                          style={styles.dishPhoto}
                          contentFit="cover"
                          transition={150}
                          cachePolicy="memory-disk"
                        />
                      )}
```

- [ ] **Step 4: Owner manage-place dish photo — cachePolicy**

In `app/owner/place/[id].tsx`, change:

```tsx
        {dish.photo_url ? (
          <Image source={{ uri: dish.photo_url }} style={dishRowStyles.photo} contentFit="cover" transition={150} />
        ) : (
```

to:

```tsx
        {dish.photo_url ? (
          <Image
            source={{ uri: dish.photo_url }}
            style={dishRowStyles.photo}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx eslint components/ui/Avatar.tsx components/ui/MediaStrip.tsx "app/place/[id].tsx" "app/owner/place/[id].tsx"
```

- [ ] **Step 6: Manual smoke check**

Open a café detail page with a dish photo and a drop with media, and a conversation thread with an image attachment. Confirm images still load and look correct (this task shouldn't change how anything looks — only caching behavior). Scroll away and back to Home to confirm avatars don't flicker to a stale image on re-render.

- [ ] **Step 7: Commit**

```bash
git add components/ui/Avatar.tsx components/ui/MediaStrip.tsx "app/place/[id].tsx" "app/owner/place/[id].tsx"
git commit -m "Set explicit expo-image cache policy and recyclingKey"
```

---

### Task 10: Navigation/transition tuning — freezeOnBlur on pushed screens

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- No behavior change to routing — purely a `react-native-screens` perf option on already-existing `Stack.Screen` entries.

- [ ] **Step 1: Add `freezeOnBlur` to `pushedScreenOptions`**

In `app/_layout.tsx`, change:

```tsx
const pushedScreenOptions = {
  title: '',
  headerBackTitle: 'Back',
  headerStyle: { backgroundColor: colors.cream },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fontFamily.body },
  headerShadowVisible: false,
} as const;
```

to:

```tsx
const pushedScreenOptions = {
  title: '',
  headerBackTitle: 'Back',
  headerStyle: { backgroundColor: colors.cream },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: fontFamily.body },
  headerShadowVisible: false,
  // Pauses a pushed screen's React tree once the next screen fully covers
  // it, instead of leaving it mounted and re-rendering in the background —
  // a real win for screens like café detail and the messages thread that
  // otherwise keep doing state-driven work while off-screen.
  freezeOnBlur: true,
} as const;
```

This applies to every screen already listed under `pushedScreenOptions` in the `Stack.Protected` block (`place/[id]`, `checkin/[placeId]`, `collections/index`, `collections/[id]`, `diary`, `events`, `messages/index`, `messages/new`, `messages/[conversationId]`, `owner/claim`, `owner/index`, `owner/place/[id]`) — no per-screen change needed since they all spread this shared options object.

**Modal-presentation review (no code change):** the design spec asked to evaluate whether any pushed flow (compose, check-in) would read better as a modal. Compose lives on the Post tab, not a pushed screen, so it's out of scope here. Check-in (`app/checkin/[placeId].tsx`) is a focused single-purpose form, superficially modal-shaped, but changing its `presentation` would touch the exact back-navigation pattern CLAUDE.md's Maestro section already documents a gotcha for (`tapOn: "Back"` vs. the generic `back` command) — a presentation change is a UX call with no measurable performance upside, so it's deliberately left alone in this pass.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx eslint app/_layout.tsx
```

- [ ] **Step 3: Manual smoke check**

Navigate into café detail, then into check-in from there (a push-of-a-push), then swipe back twice. Confirm the swipe-back gesture and the "Back" button both still work at every level, and café detail's state (e.g., an already-loaded drop list) is still correct when you return to it — `freezeOnBlur` pausing background work shouldn't lose in-flight state, but this confirms it in practice, not just in theory.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "Enable freezeOnBlur on pushed screens"
```

---

### Task 11: Re-measure profiling (after fixes) + comparison report

**Files:**
- Create: `docs/superpowers/plans/phase9-profiling/after/*-fps.png` (4 files) and `docs/superpowers/plans/phase9-profiling/after/*-xctrace-summary.txt` (4 files)
- Create: `docs/superpowers/plans/phase9-profiling/comparison.md`

**Interfaces:**
- Consumes: `docs/superpowers/plans/phase9-profiling/before/*` from Task 1.

- [ ] **Step 1: Repeat Task 1's Steps 1–4 exactly, writing into `after/` instead of `before/`**

Same 4 screens (`home`, `cafe-detail`, `messages-thread`, `explore`), same scripted-scroll methodology, same artifact naming — this has to be the same measurement under the same conditions as the baseline for the comparison to mean anything. Use the same seed data/thread used for the baseline capture where possible (e.g. the same café detail page, the same conversation thread) so the two runs are comparable.

- [ ] **Step 2: Write the comparison report**

Create `docs/superpowers/plans/phase9-profiling/comparison.md` with, for each of the 4 screens: the before and after FPS numbers (both JS and UI thread, read off the screenshots), and a one- or two-sentence note on whether the `xctrace` summary shows any change in where CPU time went during the scroll. State plainly if a screen shows no measurable difference — don't claim an improvement that isn't in the numbers. This file is prose, not a template with blanks; write the actual findings.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/phase9-profiling/after/ docs/superpowers/plans/phase9-profiling/comparison.md
git commit -m "Capture Phase 9 after-fix profiling and write before/after comparison"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type check and lint the whole project**

```bash
npx tsc --noEmit
npx eslint . --ext .ts,.tsx
```

Both must be clean (aside from the pre-existing, unrelated `.expo/types/router.d.ts` warning CLAUDE.md already documents, if it appears).

- [ ] **Step 2: Run the full Maestro suite**

```bash
export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"
npm run test:e2e
```

Every flow should behave the same as it did before this phase — this pass changed performance characteristics, not behavior. Per CLAUDE.md's established precedent, `phase4-events` and `phase7-owner-dashboard` may fail for pre-existing, unrelated, already-documented dev-data-state reasons (ticket headroom consumed / owner-claim state already flipped from an earlier run) — if either fails, check whether the failure matches those known causes before treating it as a regression from this phase. `phase8-messages` may also still hit the documented QuickType-predictive-bar Send-tap flake, unrelated to anything in this plan.

- [ ] **Step 3: If any flow fails for a reason NOT matching a known pre-existing cause, treat it as a real regression**

Bisect which task introduced it (the tuning/memoization changes in Tasks 2–10 are all mechanically simple, but a `useCallback` dependency array typo is the most likely real bug class here — e.g. a stale closure over `startingId` or `stamped` that doesn't update after a state change would show up as a Maestro flow that used to pass now failing at an assertion). Fix it, re-run `tsc`/`eslint`/the specific failing flow, then re-run the full suite once more before moving on.

- [ ] **Step 4: No commit for this task** — it's verification-only. If Step 3 required a fix, that fix gets its own commit at that point.

---

### Task 13: Update CLAUDE.md's phase plan with a Phase 9 entry

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add the Phase 9 entry**

In `CLAUDE.md`'s "Phase plan (native rewrite)" section, insert a new bullet after the Phase 8 entry and before the "**Later:**" bullet, following the same voice/format/level of detail as the Phase 6–8 entries already there (past tense, states what shipped, calls out anything that turned out to be a real gotcha, references exact file paths). Write it once the actual implementation is done and verified — it should describe what happened (including the specific FPS before/after numbers from Task 11's `comparison.md`, and any real bug the Maestro re-run in Task 12 caught), not a preview of the plan. Do not write this until Tasks 1–12 are complete, since its whole value is being an accurate record of what actually shipped.

Update the closing `**Later:**` bullet to remove "a dedicated polish pass (list virtualization, image caching, transition tuning)" from its description, since that's now done — leave "then store submission prep" as the remaining next step.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Document Phase 9 (performance polish pass) in CLAUDE.md"
```

---

### Task 14: Rewrite README.md to reflect current state through Phase 9

**Files:**
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Rewrite the intro and "What's real" section**

`README.md` currently opens with `# lore. — native (Phase 1: foundation)` and a "What's real in this build" list that only covers Phase 1 (auth, design system, tab shell, Profile). Replace the title and that section with an accurate summary of the app as it stands after Phase 9: full auth (Google + phone OTP), the complete tab set (Home feed, Explore, Post/compose with photo+video attachments, Passport/Diary, Profile), café detail with dishes/drops/replies, collections, events/ticketing, owner dashboard (claim, status/tagline, dish management with photos and ratings), push notifications, direct messaging (inbox, threads, blocking), and this phase's performance work (virtualized lists, cached images, `freezeOnBlur` transitions). Base the exact wording on CLAUDE.md's Phase 1–9 entries (the source of truth for what shipped) rather than re-deriving it from scratch — this file's job is to summarize, not duplicate CLAUDE.md's detail level. Keep it to a similar length/tone as the original section (a short bulleted list), not a copy of CLAUDE.md's much longer phase-by-phase history.

- [ ] **Step 2: Update or retire the "What's not built yet" line**

Replace `**What's not built yet (next phases):** the actual home feed, café detail pages, drop posting, collections, owner dashboard, events/tickets, passport/diary, and everything Android.` — all of that is now built. Replace with whatever's actually still pending per CLAUDE.md's `**Later:**` bullet (post-Task-13 wording — store submission prep) plus Android, which CLAUDE.md's "What this project is" section already establishes as deliberately deferred.

- [ ] **Step 3: Retire the "What to check before moving to Phase 2" checklist**

That checklist is Phase-1-specific (welcome screen, fonts, Google/phone sign-in, onboarding, sign-out) and stale — Phase 2 happened long ago. Replace it with a short pointer to the real regression-testing process instead of a hand checklist: reference `npm run test:e2e` and CLAUDE.md's "Regression testing" section (which has the actual, current, maintained list of what's covered and the seed-data prerequisites) rather than maintaining a second, competing checklist in README that will go stale again the same way this one did.

- [ ] **Step 4: Leave the scaffold/setup instructions (sections 1–6) alone**

Those (creating the Expo project, installing packages, `app.json` merge, env vars, the Supabase redirect-URL step, `npx expo start`) are still accurate setup steps for anyone bootstrapping a fresh checkout and are out of scope for this task — only the framing/status sections at the top and the stale Phase-1 checklist at the bottom change.

- [ ] **Step 5: Proofread against CLAUDE.md**

Re-read the new README top-to-bottom next to CLAUDE.md's phase plan and confirm every claim it makes (which tabs exist, which features are live, what's deferred) is actually still true as of Phase 9 — this file is easy to let go stale again, so get it right now rather than leaving another gap for a future session to find.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "Update README.md to reflect app state through Phase 9"
```

---

## Self-Review Notes

**Spec coverage:** Task 1 → baseline profiling. Tasks 2–7 → list virtualization (memoization + stable callbacks + tuning props) across every existing `FlatList` screen. Task 8 → the `events.tsx` ScrollView→FlatList conversion. Task 9 → image caching. Task 10 → transition tuning. Task 11 → after-fix profiling + comparison. Task 12 → full verification. Task 13 → CLAUDE.md update. Task 14 → README rewrite (the user's explicit ask this session, on top of the original spec). Every item in the design spec's "In scope" list (1–7) has a task.

**Placeholder scan:** no TBD/TODO; Task 13/14's steps intentionally describe *what* the eventual prose must cover and *why* (since their exact wording depends on Tasks 1–12's real results, which don't exist yet at plan-writing time) rather than pre-writing content that would just be wrong — that's a legitimate exception, not a placeholder, because the task can't be executed before the data exists.

**Type consistency:** `keyExtractor`/`renderItem` parameter types match each screen's actual list-item type throughout (`Drop`, `PlaceSummary`, `DiaryEntry`, `CollectionWithCount`, `OwnedPlace`, `Conversation`, `ProfileSearchResult`, `Message`, `EventRow`) — each pulled from that screen's existing `useState<T[]>` declaration, not invented.
