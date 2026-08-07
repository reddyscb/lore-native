# lore. — native

The React Native rewrite of [lore-app](https://github.com/reddyscb/lore-app),
built for a genuinely native, smooth iOS experience. Full context for how
this fits together — including the phase-by-phase history below — lives in
[`CLAUDE.md`](./CLAUDE.md); read that first if you're picking this up in a
new session.

**What's real in this build:**

- Full auth: Google sign-in and phone OTP, both backed by the same live
  Supabase Auth the web app uses, plus onboarding for first-time sign-ins
- A working design system ported from the web app's cream/raspberry/mustard
  palette and Fraunces/Inter/Space Mono type system
- **Home** — a real drop feed with photo/video attachments, tagged friends,
  and replies
- **Explore** — search + area/price-filter café browsing
- **Post ("Drop lore")** — a two-step compose flow (pick a place, fill in
  the review fields, tag friends, attach up to 4 photos/videos)
- **Café detail** — place info, go-for/skip/secret-lore fields, dish menu
  with photos and ratings, drops with inline replies, save-to-collection,
  and check-in
- **Passport & Diary** — a stamp grid for places you've checked in at, and
  a private visit log behind it
- **Collections** — save places into named lists, organize, and browse them
- **Events** — browse upcoming events and reserve tickets through an atomic,
  race-safe capacity check
- **Direct messaging** — a real-time inbox, one-on-one threads with text and
  photo/video attachments, unread badges, and blocking
- **Push notifications** — replies, tags, and 24-hour event reminders
  (schema-level delivery proven; UI-level receipt needs a physical device,
  since the iOS Simulator can't obtain a real push token)
- **Owner dashboard** — claim an unclaimed café, manage its status/tagline,
  and manage its dish menu (add/edit/delete, star ratings, photo upload)
- **Profile** — your real `profiles` row, avatar upload, sign-out, and
  entry points into most of the above

**What's not built yet:** Android (deliberately deferred until the iOS app
is solid — see `CLAUDE.md`'s "What this project is" section) and App Store
submission prep. See CLAUDE.md's phase plan for the full history of how
each of the above shipped, including known gaps and gotchas per feature.

---

## 1. Scaffold the project

This repo is an overlay, not a full scaffold — it assumes a fresh Expo
project as the base so you always get current, correctly-versioned
dependencies rather than whatever versions were current when this was
written.

```
npx create-expo-app@latest lore-native
```

Then copy every file from this overlay into the newly created `lore-native`
folder, overwriting where they collide **except `app.json`** (see step 3).

## 2. Install the additional packages this phase needs

```
cd lore-native
npx expo install @supabase/supabase-js react-native-url-polyfill \
  @react-native-async-storage/async-storage expo-secure-store \
  expo-auth-session expo-web-browser expo-crypto \
  @expo-google-fonts/fraunces @expo-google-fonts/inter @expo-google-fonts/space-mono \
  expo-font expo-splash-screen react-native-get-random-values

npm install aes-js
npm install --save-dev @types/aes-js
```

## 3. Update `app.json`

Don't overwrite the generated `app.json` — it has asset paths (icons,
splash) specific to your scaffold. Just add/merge these fields:

```json
{
  "expo": {
    "scheme": "lore",
    "ios": {
      "bundleIdentifier": "com.reddyscb.lore",
      "supportsTablet": false
    }
  }
}
```

(`scheme` is what makes the Google sign-in deep-link redirect work — see
CLAUDE.md's "Required manual setup" section for the matching Supabase
dashboard step.)

## 4. Environment variables

```
cp .env.example .env
```

The values are already filled in — same public, RLS-protected Supabase
project the web app uses, nothing to look up.

## 5. One-time Supabase dashboard step

In the [Supabase dashboard](https://supabase.com/dashboard/project/jgksopmbfttqqngrsama/auth/url-configuration) →
Authentication → URL Configuration → Redirect URLs, add:

```
lore://**
```

Without this, Google sign-in will complete in the browser but fail to
redirect back into the app.

## 6. Run it

```
npx expo prebuild
npx expo start
```

Press `i` to open the iOS simulator, or scan the QR code with the Expo Go
app on a physical iPhone.

## Regression testing

Don't hand-check flows one by one — `maestro/*.yaml` holds a Maestro E2E
suite covering every feature above with a UI path Maestro can drive. Run
the whole thing with:

```
npm run test:e2e
```

This needs the Maestro CLI installed, a booted iOS Simulator with the app
already built and a **signed-in session already present** (auth can't be
scripted), and some specific seed data the flows reference. See CLAUDE.md's
"Regression testing" section for the exact prerequisites, which flows are
expected to accumulate dev data on repeat runs, and a list of known,
already-diagnosed gotchas (keyboard/tap timing quirks, native alert
buttons, etc.) worth reading before adding a new flow.
