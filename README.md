# lore. — native (Phase 1: foundation)

The React Native rewrite of [lore-app](https://github.com/reddyscb/lore-app),
built for a genuinely native, smooth iOS experience. Full context for how
this fits together lives in [`CLAUDE.md`](./CLAUDE.md) — read that first if
you're picking this up in a new session.

**What's real in this build:**

- Google sign-in and phone OTP, both backed by the same live Supabase Auth
  the web app uses
- A working design system ported from the web app's cream/raspberry/mustard
  palette and Fraunces/Inter/Space Mono type system
- Tab navigation shell (Home, Explore, Drop lore, Passport, Profile) with
  auth-gated routing — logged-out users can't reach the tabs, and new users
  get routed through onboarding automatically
- A real Profile screen showing your actual `profiles` row and a working
  sign-out

**What's not built yet (next phases):** the actual home feed, café detail
pages, drop posting, collections, owner dashboard, events/tickets, passport/
diary, and everything Android. See the phase plan in `CLAUDE.md`.

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

## What to check before moving to Phase 2

- [ ] App opens to the welcome screen with the `lore.` wordmark, fonts
      rendering correctly (Fraunces headline, Inter body)
- [ ] Google sign-in completes and lands you in the app (or onboarding, if
      it's your first time)
- [ ] Phone sign-in: code arrives by SMS, verifying it signs you in
- [ ] First-time sign-in lands on the onboarding screen; saving a name
      takes you straight to the tabs — no manual refresh needed
- [ ] Returning sign-in (same account, sign out then back in) skips
      onboarding and goes straight to the tabs
- [ ] Profile tab shows your real display name and role from Supabase
- [ ] Sign out returns you to the welcome screen

Once those are solid, tell me and we'll scope Phase 2 — I'd suggest the
home feed and café detail page next, since that's the core loop, same as
it was for the web app.
