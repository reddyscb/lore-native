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
- **Phase 6 — done, verified end-to-end (schema-level push delivery
  proven via `net._http_response`; UI-level notification receipt
  requires a physical device, see below).** Push notifications (replies,
  tags, and 24-hour event reminders) plus an app-wide performance pass.
  New table `push_tokens` (`user_id`, `token`, unique on both together),
  RLS scoped to the owning user. `pg_net` (schema `extensions`, moved
  there in a hardening follow-up migration after `get_advisors` flagged it
  in `public`) and `pg_cron` extensions enabled. A `send_expo_push(user_id,
  title, body, data)` SECURITY DEFINER helper (`search_path = ''`, every
  reference schema-qualified — see Postgres security best practices)
  fans out to every token row for that user via `net.http_post` against
  `https://exp.host/--/api/v2/push/send`; pg_net queues the request and
  fires it after the transaction commits, so it never blocks the
  triggering write. `notify_drop_reply`/`notify_drop_tag` triggers on
  `drop_replies`/`drop_tags` call it (both `revoke execute`d from
  `anon`/`authenticated` in the hardening migration — SECURITY DEFINER
  functions are PostgREST-exposed by default). A new `events.reminder_sent_at`
  column plus `send_event_reminders()` (matches events whose
  IST-timezone-converted start time falls in the next 24h and hasn't
  fired yet, loops its ticket holders) is driven by a `pg_cron` job
  running hourly. Client side: `hooks/use-push-notifications.ts` requests
  permission and calls `getExpoPushTokenAsync` once per signed-in user
  (guarded by a ref so it doesn't re-fire on every render), upserts the
  token via `registerPushToken` in `lib/queries.ts`
  (`onConflict: 'user_id,token', ignoreDuplicates: true`), and listens
  for notification taps to deep-link into `/place/[id]`. Wired into
  `app/_layout.tsx`'s `RootNavigator`, gated on logged-in-and-onboarded.
  Needed an EAS project link (`npx eas-cli login`, then `eas init`) to
  populate `app.json`'s `extra.eas.projectId` — required by
  `getExpoPushTokenAsync`; project is owned by the `reddyworks-team` EAS
  account. Adding `expo-notifications` needed an `app.json` plugin entry
  and thus a full native rebuild (`npx expo run:ios`), same as any new
  native module.
  **iOS Simulator cannot obtain a real push token** ("no valid
  aps-environment entitlement string found for application") — this is
  an Apple platform limitation, not a bug; `getExpoPushTokenAsync` is
  expected to reject every time in Simulator, caught and logged (not
  surfaced to the user). Also, `expo-notifications` itself
  `console.warn`s about this on every launch — worth knowing about even
  beyond this app, since an uncaught `console.warn` this early surfaces
  React Native's "Open debugger to view warnings" banner directly over
  the tab bar for several seconds after every launch (see the Maestro
  gotcha below); silenced via `LogBox.ignoreLogs(...)` in the hook, since
  the underlying warning is expected noise on Simulator specifically.
  Performance pass (the other half of this phase's ask — "no lag, once
  you click something there should not be any delay"): Home
  (`app/(tabs)/index.tsx`) switched from a mount-only `useEffect` to
  `useFocusEffect`, so revisiting the tab re-fetches in the background
  without re-showing the blocking spinner (`loading` only gates the very
  first load, same pattern already used by Passport); Explore
  (`app/(tabs)/explore.tsx`) now sets `loading` synchronously on
  keystroke instead of waiting for the 300ms debounce to elapse, so
  typing doesn't look like it's doing nothing; café detail
  (`app/place/[id].tsx`) split its single gated `Promise.all` fetch into
  three independent effects (place / dishes / drops) so the page renders
  as soon as place info loads instead of blocking on dishes and drops
  too; and `fetchDishes`, `fetchPlaceDrops`, `searchPlaces`,
  `fetchDiaryEntries`, `fetchEvents` in `lib/queries.ts` all gained safety
  `.limit()`s so none of them can degrade into an unbounded query as data
  grows.
- **Phase 7 — done, verified end-to-end on a real booted Simulator**
  (`npm run test:e2e` green, plus a manual walkthrough of everything
  Maestro can't drive — see below). Owner dashboard: claim an unclaimed
  café, manage its open/closed status and tagline, and manage its dish
  menu (add/edit/delete, tap-to-set 1–5 star rating, tap-to-upload photo).
  Three new pushed-stack screens under `app/owner/` — claim
  (`app/owner/claim.tsx`, lists places with `owner_id is null`, one tap
  claims), dashboard (`app/owner/index.tsx`, lists the signed-in user's
  owned places), and per-place manage (`app/owner/place/[id].tsx`,
  status/tagline editing plus the dish list and an add-dish form) —
  reached from a new Profile tab button that reads "Claim a place" or
  "Owner dashboard" depending on `profiles.role`. New `dishes.photo_url`
  column and a `dish-photos` Storage bucket (public-read, owner-scoped
  write RLS keyed off the storage path's `{place_id}/...` segment, same
  pattern as `avatars`/`drop-media` from Phase 5) via the
  `phase7_dishes_photo_url` and `phase7_dish_photos_bucket` migrations.
  New `components/ui/StarRating.tsx` (read-only when `onChange` is
  omitted, tap-to-set otherwise), reused for dish-rating entry here and
  available for future read-only display. Claiming flips `profiles.role`
  to `'owner'` *before* the `places.owner_id` update, since the "an owner
  can claim an unclaimed place" RLS policy's `WITH CHECK` requires
  `role = 'owner'` to already be true — same two-step order the web app's
  `claimPlace` server action uses; a losing racer in the claim race gets a
  clear thrown error (verified via `.select('id')` on the second update)
  but keeps a stray `role: 'owner'` on their own profile with no
  compensating rollback, a known, accepted gap carried from the original
  design. There is deliberately no "unclaim" feature (YAGNI, see
  `docs/superpowers/specs/2026-08-06-owner-dashboard-design.md`) — claiming
  is one-way, which the Maestro flow below has to work around. Dish
  rating and tag editing did not exist on the web app at all before this —
  greenfield here, not a port. Café detail (`app/place/[id].tsx`) now
  shows a small thumbnail next to any dish that has a `photo_url`.
  Built (Tasks 1–11) via `superpowers:subagent-driven-development` in a
  git worktree during a session with no booted Simulator, so it initially
  shipped as code-complete-but-unverified — `npx tsc --noEmit` and
  `npx eslint . --ext .ts,.tsx` clean project-wide, including a genuine
  (non-stale) typed-routes check (`.expo/types/router.d.ts` didn't exist
  in that checkout until a real `npx expo start` run generated it), but
  nothing had actually been run on a device. A follow-up session then
  ran the real thing end to end: `npm run test:e2e` (12 flows, including
  the new `phase7-owner-dashboard.yaml`) plus a manual walkthrough of
  claim → status/tagline save → add/edit a dish → tap-to-upload a dish
  photo (native picker, can't be Maestro-driven — seeded a solid-color
  test photo via `xcrun simctl addmedia`, confirmed it uploads to
  `dish-photos` and renders both on the manage screen and the public
  café-detail thumbnail) → remove a dish, all against the real seed place
  `Maestro Claim Test Café`.
  **Two environment assumptions from the code-complete pass turned out to
  be wrong, not just incomplete** — worth internalizing for any future
  session in this same setup:
  - **"No Simulator available" was never actually tested.** `xcrun simctl
    list devices booted` returning nothing only means nothing is
    *currently* booted, not that nothing *can* be booted. `xcrun simctl
    boot <device>` worked immediately, first try, no special setup.
    Simulators here are always available; a session just has to boot one.
  - **A single stale `expo start` process on the default port can silently
    hijack an entire test run.** A leftover dev server for the *main*
    repo checkout (unrelated to this worktree, over a day old, from some
    earlier session) was still listening on :8081. Pointing the worktree's
    own Metro at a different port and launching the app didn't stop the
    already-installed dev client from reconnecting to whatever bundler URL
    it had cached — which was the stale server's. The entire first full
    Maestro run "passed" 11 of 14 flows and failed the other 3 for reasons
    that looked like real regressions, but every flow had actually
    exercised **main's old code, not this branch** — confirmed by
    `phase7-owner-dashboard.yaml` failing at "Claim a place" not being on
    the Profile screen at all, because that code doesn't exist on main.
    Fix: kill every other `expo`/Metro process first, then confirm the
    intended server is the one actually being hit by checking *its own*
    log for a real full bundle (`Bundled ...ms ... (N modules)` with N in
    the hundreds/thousands) after a fresh app launch — a small `(1
    module)` line is Metro's normal incremental-request cost and does not
    by itself prove which server served the app.
  Running against the real, correctly-connected code surfaced three real
  bugs invisible to `tsc`/`eslint`/code review, all fixed in this phase
  before merge:
  - `borderStyle: 'dashed'` (used on the manage screen's divider and dish-
    row separator) triggers React Native's "Unsupported dashed / dotted
    border style" warning on this RN version — an uncaught warning that
    surfaces the debugger banner over newly rendered content, the same
    mechanism documented below for the tab bar. Switched both to solid,
    matching every other border in the app (no screen here used a dashed
    border before this phase).
  - `maestro/phase7-owner-dashboard.yaml`'s `tapOn: "Add"` after
    `pressKey: Enter` was chasing a button already pushed out of the
    scrolled viewport by the newly-added dish row — Enter's
    `onSubmitEditing` already completes the add. Removed the redundant
    tap; see the new Maestro gotcha below for the same fix applied to a
    native alert button.
  - The delete-dish confirm flow's final `assertNotVisible` ran ahead of
    `deleteDish`'s network round-trip; switched to `extendedWaitUntil`.
- **Later:** a dedicated polish pass (list virtualization, image caching,
  transition tuning), then store submission prep.

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
flows, Phase 5's media section/avatar affordance smoke test, and Phase 7's
owner-dashboard write path). Phase 6 added no new flow of its own — push
notifications have no UI path Maestro can drive (permission dialogs are OS
UI, and Simulator can't get a real token anyway), so that phase leans
entirely on the existing suite staying green plus the schema-level
`net._http_response` check described above. Run it with
`npm run test:e2e` — this runs each flow one at a time
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
"Ruskin & Rye", a profile named "sree" for the tagging flow, and an
unclaimed place named "Maestro Claim Test Café" — id
`80a63bec-6542-41bc-b96c-acdb6ad524c3` — reserved for
`phase7-owner-dashboard.yaml`; see that file's header comment for the
reset SQL needed before re-running it, since claiming has no reverse
operation). Reinstalling
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
`phase7-owner-dashboard` is a third kind of exception: unlike the
accumulate-forever flows above or `phase4-collections`'s no-op-on-repeat,
it's only re-runnable from a clean state — claiming a place has no
reverse operation by design, so re-running without first resetting
`places.owner_id`/`status`/`reopen_date` and the test account's
`profiles.role` (exact SQL in the flow file's header comment) will fail
at an early step rather than silently duplicating data.

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
- **An uncaught `console.warn` early in app startup can silently break
  every tab-bar tap for several seconds after every launch** — found
  diagnosing a Phase 6 suite run where `phase1-profile-smoke`,
  `phase3-explore`, `phase4-passport-and-diary`, and `phase5-media` all
  failed identically: `tapOn` on a tab bar item (`.*Explore.*`,
  `.*Passport.*`, `.*Profile.*`, `.*Drop lore.*`) reported `COMPLETED`
  but the app never navigated, even with `extendedWaitUntil` already
  wrapping the tap. Root cause: `expo-notifications` itself calls
  `console.warn` on every launch on Simulator ("obtaining a push token
  may not work..."), which surfaces React Native's "Open debugger to
  view warnings" banner — and that banner renders *directly over the tab
  bar* and doesn't auto-dismiss. A tap landing there gets swallowed
  regardless of whether it's delivered by Maestro, `idb`, or (per a
  timed repro) a real touch — it's not Maestro-specific and it isn't
  timing-sensitive in the way it first looks (a 7-second wait before the
  tap didn't help; what actually clears it is any prior successful touch
  or the banner's own dismissal, not elapsed time). Regular in-content
  taps (place cards, links, buttons) were unaffected throughout, which is
  the tell — a same-cause investigation should watch for "only the tab
  bar breaks, everything else on the same screen is fine." Fixed via
  `LogBox.ignoreLogs(...)` in `hooks/use-push-notifications.ts` (see
  Phase 6 above); worth remembering for *any* future mount-time
  `console.warn`, not just this one. Two unrelated flows were also
  hardened while diagnosing this: `phase3-reply` and `phase4-collections`
  had fixed, un-scrolled assumptions about where their target element
  would be, which months of accumulated seed/test data had outgrown —
  both now use `scrollUntilVisible` instead of a bare `tapOn`/scroll-then-assert.
- **Don't seed an app screenshot as Simulator test media** — found while
  cleaning up after the same investigation. A screenshot of the app's own
  tab bar, seeded via `simctl addmedia` to manually verify Phase 5's
  photo/video picker, got iOS Live Text-recognized once attached to a
  drop; the OCR'd text (including "Explore", "Passport", etc.) was
  exposed as that thumbnail's accessibility label, which briefly made
  Maestro's `.*wildcard.*` tab-bar selectors match text baked into a feed
  image instead of the real tab bar. Any photo/video with visible text
  works as picker-verification media — just not one containing this
  app's own UI chrome.
- **A screen with one interactive element carrying identical text per
  list row can't be disambiguated with a bare `tapOn` — needs a relative
  selector.** Found writing Phase 7's flow: `app/owner/index.tsx` renders
  one Card + one "Manage" `Button` per place the signed-in account owns.
  Unlike the composite-label place cards elsewhere in the app (first
  gotcha above), this Card is a plain `View`, not a single `Pressable`, so
  each "Manage" button is its own separate accessible element with the
  exact same label on every card — a bare `tapOn: "Manage"` hits whichever
  one Maestro's accessibility walk finds first, not necessarily the place
  the flow just claimed. Fixed with Maestro's relative-selector syntax
  (new to this repo's flows): `tapOn: { text: "Manage", below:
  ".*<place name>.*" }` scopes the tap to the "Manage" button positioned
  below that specific place's name text. The same technique applies to any
  other screen with N visually-identical buttons in a list.
- **`tapOn` by text can silently fail to dismiss a native
  `Alert.alert` button — it reports `COMPLETED` but nothing happens.**
  Found finishing Phase 7's delete-dish confirm step: `tapOn: "Remove"`
  against the destructive button in a native `UIAlertController`
  consistently left the dialog open (reproduced 3 times in a row,
  screenshot showed the same "Remove this dish?" alert every time), yet
  Maestro never reported a failure on that step — only the *next*
  assertion failed, elsewhere on screen, which is what made it look at
  first like a delete-didn't-complete bug rather than a tap-didn't-land
  bug. Confirmed the real cause by comparing against a manual coordinate
  tap at the same button (`idb ui describe-all` to get its real frame,
  then `idb ui tap <x> <y>`), which dismissed the dialog immediately.
  Fix: for any native `Alert.alert` button (this app's other confirm
  dialogs may hit the same issue — none currently have an automated
  flow), use a `tapOn: { point: "X%,Y%" }` at the button's center instead
  of text matching. Get the real coordinates from `idb ui describe-all`
  and convert to a percentage of `idb describe`'s `screen_dimensions`
  (`width_points`/`height_points`) rather than eyeballing from a
  screenshot — same convention as getting any other idb tap coordinate in
  this repo.

**Real bugs this suite caught, not just test flakiness:** the Explore
tab, Post tab's place picker, and café detail's reply box were all
missing `keyboardShouldPersistTaps="handled"` on their scrollable
container. Without it, the *first* tap on a result/button right after
typing just dismisses the keyboard instead of registering — a real user
tapping a search result immediately after typing would need to tap twice.
Fixed in all three screens. Phase 6 added one more: `expo-notifications`'s
own startup warning was covering the tab bar for real users too, not
just tests — see the LogBox gotcha above. Phase 7 added another: the
manage screen's `borderStyle: 'dashed'` triggered the same
uncaught-warning-covers-the-UI mechanism, this time over the add-dish
form instead of the tab bar — see the Phase 7 entry above.

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
