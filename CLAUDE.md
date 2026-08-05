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

**Same design language.** Cream / raspberry / mustard pixel-art system,
Fraunces (display) + Inter (body) + Space Mono (mono/stamps) typefaces. See
`constants/theme.ts` — every color and font in the app should come from
that one file, nothing hardcoded inline.

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
  Data layer is `lib/queries.ts`. Still read-only — no drop posting or
  reply composing yet. Drop posting + replies UI, collections, owner
  dashboard, events/tickets, passport/diary, explore/search all remain
  later phases.
- **Later:** push notifications, photo/video upload (Supabase Storage —
  not built on web either yet), a dedicated polish pass (list
  virtualization, image caching, transition tuning), then store
  submission prep.

Android setup, testing, and Play Store submission are deliberately
deferred until the iOS app is in a good place.

## Conventions

- Import paths use the `@/` alias (`@/lib/supabase`, `@/constants/theme`).
- Every screen wraps in `<ScreenContainer>` for consistent background/safe
  area handling.
- All colors/fonts/spacing come from `constants/theme.ts` — no inline hex
  values or magic numbers in component styles.
- Reusable UI lives in `components/ui/`; screen-specific one-offs stay in
  the screen file.
