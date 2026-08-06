# lore. — native app (CLAUDE.md)

Read this before doing anything in this repo. It's the context a fresh
Claude session (or Claude Code session) needs to pick up exactly where the
last one left off.

## What this project is

`lore.` is a café/restaurant social discovery app for Hyderabad, India. This
repo is the **React Native (Expo) rewrite** of the web app, built to get a
genuinely native, smooth, App-Store-quality experience — the web version
(Next.js + Vercel, `github.com/reddyscb/lore-app`) stays live and unaffected
while this is built out.

**Platform focus right now: iOS only.** Android comes later, once the iOS
app is solid. The codebase is still cross-platform-capable by default
(that's just how Expo works) — we're simply not doing Android-specific
config, testing, or store submission yet.

## Why this repo exists instead of extending the web app

The web app is Next.js App Router with Server Components and Server
Actions — architecture that can't be wrapped into a native app binary
without a rewrite of the data layer anyway (static export drops support for
Server Actions and cookie-based auth). Given that a UI rewrite was
happening regardless, this is a clean separate repo rather than bolting
React Native onto the Next.js one.

## What's shared with the web app (don't rebuild this)

**Same Supabase backend, unchanged.** Project ref `jgksopmbfttqqngrsama`,
Mumbai region. Every table, RLS policy, and Postgres RPC function (e.g. the
atomic ticket-reservation function from web Phase 6) already exists and
works — this app is just a different client talking to the same database.
Do not duplicate schema or RLS work here; if something needs a schema
change, it should usually happen once, in the web repo's migrations, and
just be consumed here.

**Same design language.** Cream / raspberry / mustard neo-brutalist system —
3px ink borders and hard, un-blurred offset shadows (`hardShadow()` in
`constants/theme.ts`), not soft Material-style ones — plus Fraunces
(display) + Inter (body) + Space Mono (mono/stamps, and the `Eyebrow` kicker
component used to open most screens) typefaces. `constants/theme.ts` holds
the exact color values read from the web app's `app/globals.css` (not
approximations — see "Reference: the web app repo" below) — every color,
font, and shadow in the app should come from that one file, nothing
hardcoded inline.

**Same auth providers.** Google OAuth and Phone OTP (Twilio Verify) are
already configured on the Supabase project's Auth settings. This app reuses
that configuration as-is (see "Auth architecture" below) — no new Google
Cloud OAuth client needed for the mobile app.

## Tech stack

- Expo (SDK 57, Expo Router — file-based routing, forked from
  `@react-navigation` as of SDK 56, so app code imports navigation
  primitives from `expo-router`, not `@react-navigation/*`)
- TypeScript
- `@supabase/supabase-js` — same client library the web app uses
- `expo-secure-store` + `@react-native-async-storage/async-storage` +
  `aes-js` — encrypted session storage (see "Security" below)
- `expo-auth-session` + `expo-web-browser` — Google OAuth via deep link
- `@expo-google-fonts/*` — Fraunces, Inter, Space Mono

## Auth architecture

Three states, each its own protected route branch in `app/_layout.tsx`
using Expo Router's `Stack.Protected`:

1. **Logged out** → `app/(auth)/` (welcome, phone, verify)
2. **Logged in, `profiles.onboarded` is not `true`** → `app/onboarding.tsx`
3. **Logged in and onboarded** → `app/(tabs)/` (the actual app)

`providers/auth-provider.tsx` owns the Supabase session subscription and
the profile fetch. It exposes `refreshProfile()` — call this after any
screen writes to the `profiles` table (onboarding does), since the
provider only re-fetches automatically on session changes, not on
arbitrary profile writes.

**Google sign-in** uses `supabase.auth.signInWithOAuth({ provider: 'google',
skipBrowserRedirect: true })` + `expo-web-browser`'s
`openAuthSessionAsync`, catching the redirect via the app's custom URL
scheme. This is the browser-sheet flow (not the native Google Sign-In SDK)
— it needs zero new Google Cloud Console setup because Supabase's hosted
OAuth proxy does the same thing it already does for the web app. See
`lib/oauth.ts`.

Confirmed working in the **iOS Simulator only**. Testing Google sign-in in
a plain mobile browser will always redirect into the old web app instead of
back into this app — expected, not a bug: the deep link back to `lore://`
only resolves on a device/simulator where iOS has actually registered that
scheme. Phone OTP has no such caveat and works fine in a browser too.

**Phone OTP** is a direct `supabase.auth.signInWithOtp({ phone })` /
`verifyOtp(...)` call, same as the web app, no extra native config.

## Security

Session tokens are stored via a custom `LargeSecureStore` adapter
(`lib/secure-store-adapter.ts`): a random AES-256 key lives in
`expo-secure-store` (iOS Keychain, hardware-backed), and the actual session
blob (which can exceed SecureStore's ~2KB per-item limit) lives in
AsyncStorage encrypted with that key. This is Supabase's documented
pattern for Expo apps that need session data encrypted at rest — plain
AsyncStorage alone would leave tokens unencrypted on disk.

The publishable key in `.env` is meant to be public — every table it can
touch is behind RLS. Never put the Supabase **service role** key or DB
password in this repo or in any client code.

## Required manual setup (can't be automated)

Before Google sign-in will work on a real device:

1. In the [Supabase dashboard](https://supabase.com/dashboard) →
   Authentication → URL Configuration → Redirect URLs, add the app's
   custom scheme redirect (e.g. `lore://**`) alongside the existing
   `lore-app-iota.vercel.app` entry. The exact value depends on the
   `scheme` set in `app.json`.
2. Phone OTP needs no new setup — it reuses the Twilio Verify config
   already on the Supabase project.

## Phase plan (native rewrite)

Mirrors the web app's phases conceptually, but re-scoped for what a native
rewrite actually needs:

- **Phase 1 — done, pushed to GitHub.** Design system, navigation shell,
  full auth flow (Google + phone + onboarding), wired to the real backend.
  Full Phase 1 test checklist (see README) passed. Tab screens beyond
  Profile are still placeholders.
- **Phase 2 — done, verified in Simulator.** Home tab is a real drop feed
  (`app/(tabs)/index.tsx`); café detail is a new route (`app/place/[id].tsx`)
  showing place info, the go-for/skip/secret lore fields, dishes, and drops
  (must-order/skip/vibe-check/etc.) with their replies shown read-only.
  Data layer is `lib/queries.ts`.
- **Phase 3 — done, verified end-to-end (including real writes to
  Supabase).** The app is now writable. Explore tab (`app/(tabs)/explore.tsx`)
  is a real search + area/price-filter browse view. Post tab
  (`app/(tabs)/post.tsx`) is a two-step compose flow — pick a place (or
  skip straight to the form via a `placeId` param, used by the new "Drop
  lore about this place" button on the café detail page) — then fill in
  the review fields, tag friends, and submit. Café detail page now has an
  inline reply box under each drop. `DropCard` shows tagged friends
  ("with X, Y"). New shared component: `components/ui/PlaceListItem.tsx`.
  Collections, owner dashboard, events/tickets, passport/diary remain
  later phases.
- **Phase 4 — done, verified end-to-end (including real writes to
  Supabase).** Passport tab (`app/(tabs)/passport.tsx`) is a real two-column
  stamp grid — a place is "stamped" once the signed-in user has any
  `diary_entries` row for it. Check-in (`app/checkin/[placeId].tsx`, linked
  from a new "Been here?" button on café detail) writes that diary entry and
  routes back to Passport with a "Stamp collected" toast. Diary
  (`app/diary.tsx`) is the private visit log behind it. Collections
  (`app/collections/index.tsx` + `app/collections/[id].tsx`) are a real
  save/organize flow — café detail grew a "Save to a collection" row whose
  upsert keys off the real `(owner_id, name)` unique constraint, so saving
  to an existing collection name adds to it rather than duplicating.
  Events (`app/events.tsx`) lists upcoming events and reserves tickets
  through the `reserve_tickets` RPC (unchanged from web — it's the atomic,
  race-safe capacity check; see its doc comment on `reserveTickets` in
  `lib/queries.ts` for the one known gap, shared with web, around a
  post-RPC insert failure). Entry points mirror where the web app puts them
  (Profile tab buttons, Home feed quick links, café detail). This phase also
  did a design-parity pass — see "Same design language" above — that
  touched every existing screen, and added `ScreenContainer`'s `hasHeader`
  prop (pushed screens under a nav header pass `hasHeader` so the top safe-
  area inset isn't double-applied).
- **Phase 5 — done, verified end-to-end (including real uploads to
  Supabase Storage).** Photo/video attachments on drops, and profile
  avatars — greenfield on both native and web (neither had any image
  upload before this; `expo-image` was installed but unused). New Storage
  buckets `drop-media` (images + `video/mp4`/`video/quicktime`, 50MB limit)
  and `avatars` (images only, 10MB limit), both public-read with
  owner-scoped write RLS keyed off the storage path's first folder segment
  (`{drop_id}/...`, `{user_id}/...`) — see the `phase5_drop_media_and_avatars`
  migration (applied directly via Supabase MCP, same as prior phases; no
  local migrations folder exists in this repo). New table `drop_media`
  (`drop_id`, `media_type: image|video`, `url`, `position`), RLS mirroring
  `drop_tags`. Compose flow (`app/(tabs)/post.tsx`) gained a picker for up
  to 4 photos/videos (`expo-image-picker`, `videoMaxDuration: 60` since
  nothing transcodes on the way in) shown as a removable preview strip;
  upload happens after `createDrop` returns an id, keyed into the storage
  path. `DropCard` renders attachments via the new
  `components/ui/MediaStrip.tsx` (images via `expo-image`, video via
  `expo-video`'s `VideoView` with native controls, no autoplay) and a new
  `components/ui/Avatar.tsx` (circular photo, falls back to the name's
  first initial) now renders everywhere `profiles.avatar_url` already
  flowed but was previously unused (`DropCard` author row, `ReplyRow`).
  Profile tab grew a tap-to-change avatar (uploads to a fixed
  `{user_id}/avatar.<ext>` path with `upsert: true`, cache-busted with a
  `?updated=` query param since the URL would otherwise stay identical
  across re-uploads). Dish/place photos were explicitly deferred — dishes
  are owner-only writes with no creation UI in this app at all yet, so
  that's owner-dashboard scope, not this phase. Adding `expo-image-picker`
  needed an `app.json` plugin entry (photo library + camera permission
  strings) and thus a full native rebuild (`npx expo run:ios`).
- **Later:** push notifications, owner dashboard, a dedicated polish pass
  (list virtualization, image caching, transition tuning), then store
  submission prep.

Android setup, testing, and Play Store submission are deliberately
deferred until the iOS app is in a good place.

## Reference: the web app repo

`github.com/reddyscb/lore-app` is cloned read-only at
`../lore-app-reference` (sibling to this repo, not inside it). It's the
fastest way to check exact copy, field names/shapes, and screen structure
for any feature that already exists on web before building the native
version — used for Phase 4 (collections/diary/events) and worth reusing for
owner dashboard later. It's a snapshot, not a live mirror — re-clone or
`git pull` it if it's been a while and something looks off.

## Regression testing

`maestro/*.yaml` holds a Maestro E2E suite covering the flows built so far
(Profile smoke test, Home feed + café detail, Explore search/filter, the
compose-and-tag write path, the reply composer, Phase 4's
passport/diary, check-in, collections, and events/ticket-reservation
flows, and Phase 5's media section/avatar affordance smoke test). Run it
with `npm run test:e2e` — this runs each flow one at a time
via `scripts/test-e2e.sh` against a booted Simulator with the app already
installed (running the whole `maestro/` folder at once via
`maestro test maestro/` showed scheduling flakiness; one at a time is
reliable).

Both the Maestro CLI and `idb` (see the iOS Simulator workflow note below)
install to `~/.maestro/bin` and `~/.local/bin` respectively — neither is
necessarily on `PATH` in a fresh shell, so `export PATH="$HOME/.maestro/bin:$HOME/.local/bin:$PATH"`
before using them if `command not found`.

**Requirements before running:** Maestro CLI installed
(`curl -Ls "https://get.maestro.mobile.dev" | bash`), a booted Simulator
with a **signed-in session already present** (auth can't be scripted —
flows assume you're logged in and land on the tab bar), and the seed
data the flows reference still existing (places "The Copper Pot" and
"Ruskin & Rye", a profile named "sree" for the tagging flow). Reinstalling
the app (e.g. `npx expo run:ios` after a native-level change) wipes the
signed-in session — SecureStore's Keychain item is tied to the install —
so sign in again before running the suite if you've just done that.

Most write flows (`phase3-compose-and-tag`, `phase3-reply`,
`phase4-checkin`, `phase4-events`) insert new rows into the live dev
Supabase project every run — there's no separate test project to reset
between runs, so don't be surprised by rows accumulating (e.g. "Maestro
regression dish" drops). `phase4-collections` is the exception: its upsert
keys off the real `(owner_id, name)` constraint, so repeat runs are a
no-op past the first. `phase4-events` reserves 1 ticket per run against a
real seed event — `tickets_total` was padded with headroom specifically so
the suite doesn't eventually sell the event out and start failing; if it
ever does, bump `tickets_total` again (dev data, not schema).

**Gotchas hit building this suite, worth knowing before writing more
flows:**
- Maestro's text selectors are anchored (exact match), not substring —
  our tab bar items and place-card headers expose composite accessibility
  labels (`"Profile, tab, 5 of 5"`, `"The Copper Pot, Gachibowli, Open"`),
  so selectors need `.*wildcards.*`.
- `launchApp` alone doesn't reliably cold-restart the JS state on this
  Expo dev client — add `stopApp` before it, or a screen can retain stale
  state (e.g. Post tab still showing a previously-selected place) from an
  earlier flow.
- Right after `launchApp`, the accessibility snapshot can race the dev
  client's Metro reconnect — wrap the first interaction in
  `extendedWaitUntil` with a generous timeout (15s) rather than a bare
  `assertVisible`/`tapOn`.
- Maestro's generic `back` command doesn't reliably trigger navigation on
  the custom Stack header here — `tapOn: "Back"` (the actual button) works.
- `hideKeyboard` is unreliable on iOS Simulator. Don't rely on it — add
  `keyboardShouldPersistTaps="handled"` to the relevant ScrollView/FlatList
  instead (see "Bugs found" below) so taps work regardless of keyboard
  state, same as real users experience.
- **Leaving the keyboard open before a tap on a distant element is
  unreliable, and fails silently rather than erroring** — found building
  the Phase 4 flows. With the keyboard still up (from an earlier
  `inputText`/`eraseText`), a subsequent `tapOn` by accessibility text can
  miscompute the hit point on this iOS Simulator/XCTest combination and
  land on the still-focused field or even a keyboard key instead of the
  intended target — e.g. `tapOn: ".*The Copper Pot.*"` landed back on the
  search field and typed into it; `tapOn: "Save to my diary"` landed on the
  keyboard's "y" key and appended a stray character to the field above.
  Both looked like `assertVisible` failures with no indication the tap
  itself misfired — the debug screenshot was the only way to see it. Fix:
  dismiss the keyboard before that tap. For a single-line field, `pressKey:
  Enter` works (RN's default `blurOnSubmit`). For a multiline field (Enter
  inserts a newline instead), tap a plain, non-interactive `Text` on screen
  instead — `keyboardShouldPersistTaps="handled"` only protects touches on
  *interactive* elements from dismissing the keyboard, so a tap on inert
  text still blurs and dismisses normally. `hideKeyboard` (above) does not
  fix this — it fails outright when tried here.
- **Native photo/video picker sheets can't be driven by Maestro** — found
  writing Phase 5's flow. `expo-image-picker`'s library sheet is OS UI, not
  app UI, same category of limitation as Google OAuth's browser sheet (see
  "Auth architecture" above). `phase5-media.yaml` only asserts the picker
  *button* renders; actually picking a photo/video stays a manual Simulator
  check (seed a test photo/video into its library first via
  `xcrun simctl addmedia <udid> <path>` — a few seconds of
  `xcrun simctl io <udid> recordVideo out.mov` makes a throwaway test video
  when nothing else is handy).

**Real bugs this suite caught, not just test flakiness:** the Explore
tab, Post tab's place picker, and café detail's reply box were all
missing `keyboardShouldPersistTaps="handled"` on their scrollable
container. Without it, the *first* tap on a result/button right after
typing just dismisses the keyboard instead of registering — a real user
tapping a search result immediately after typing would need to tap twice.
Fixed in all three screens.

## Conventions

- Import paths use the `@/` alias (`@/lib/supabase`, `@/constants/theme`).
- Every screen wraps in `<ScreenContainer>` for consistent background/safe
  area handling. Screens pushed under a navigation header (anything besides
  the five tabs) pass `hasHeader` so the top safe-area inset isn't
  double-applied on top of the header's own.
- All colors/fonts/spacing come from `constants/theme.ts` — no inline hex
  values or magic numbers in component styles.
- Reusable UI lives in `components/ui/`; screen-specific one-offs stay in
  the screen file.
