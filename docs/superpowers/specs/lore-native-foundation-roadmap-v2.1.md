# lore. Native — Foundation & Roadmap Document
## Current State, Gaps, Foundation Plan & App Store Path

**Version:** 2.1
**Date:** August 2026
**Scope:** iOS app (Expo / React Native)
**Goal:** Industry-standard foundation for 100K+ users, then App Store submission
**Target Audience:** College students, young professionals, cafe culture enthusiasts, event-goers in India
**Product Vision:** A hybrid of District (event discovery + ticketing) and Instagram (social photo/video drops), focused on cafe/restaurant discovery and hangout culture

**Note:** this is the v2.1 source document as authored (adds Product
Vision/audience framing, an audience-driven severity reprioritization, a
Data Strategy part for cafe content, and a Long-Term Infrastructure part,
on top of v1.0). See
`2026-08-07-phase12-14-roadmap-revision-design.md` in this same directory
for how its differences from v1.0 were reconciled into the actual tracked
plan (CLAUDE.md's Phase 11 sequencing update, and new Phases 13/14) —
several of this document's positions (FlashList severity, the owner claim
flow's described document-upload/approval step, the `places` schema
additions) were decided or corrected there rather than adopted verbatim.

---

## Part 1: Where We Are Today

### 1.1 What's Shipped (Phases 1–9)

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Auth (Google + Phone OTP), onboarding, tab shell, design system | Done |
| Phase 2 | Home drop feed, café detail page | Done |
| Phase 3 | Explore search/filter, compose drop, inline replies, tagging | Done |
| Phase 4 | Passport stamps, diary, collections, events + ticket reservation | Done |
| Phase 5 | Photo/video attachments on drops, avatar upload, storage buckets | Done |
| Phase 6 | Push notifications (replies, tags, event reminders), perf pass | Done |
| Phase 7 | Owner dashboard (claim place, manage status, dishes, ratings) | Done |
| Phase 8 | Direct messaging (real-time, attachments, blocking, unread badges) | Done |
| Phase 9 | Performance polish (React.memo, FlatList tuning, image caching, freezeOnBlur) | Done |

### 1.2 What's Working Well (Preserve)

| Area | What's Right |
|------|-------------|
| **Security** | Encrypted session storage (AES-256 + Keychain), RLS on every table, SECURITY DEFINER helpers with `search_path = ''`, no service role key in client |
| **Auth** | Google OAuth via deep link, Phone OTP, onboarding gate, three-state routing |
| **Backend** | Shared Supabase project with web app, `pg_net` + `pg_cron` for server-side push, atomic ticket reservation RPC |
| **Design** | Centralized theme tokens (cream/raspberry/mustard), consistent `ScreenContainer`, `hardShadow()` system |
| **Testing** | Maestro E2E suite covering real write paths (12 flows), documented gotchas |
| **Performance (Phase 9)** | `React.memo` on all list rows, `useCallback` on renderItem, FlatList tuning props, `freezeOnBlur: true`, `cachePolicy="memory-disk"`, `recyclingKey` on images |
| **Expo Config** | New Architecture enabled, typed routes, EAS project linked (`reddyworks-team`) |
| **Owner Claim Flow** | Self-service place claiming with document upload, admin approval, owner dashboard |

> Note (added during v2.1 reconciliation): the "Owner Claim Flow" row above
> does not match the actual Phase 7 build, which is a one-tap claim with no
> document upload and no admin approval step. Document upload + approval was
> decided to be real, new scope — see Phase 14 in the revision doc.

### 1.3 Current Architecture Snapshot

```
lore-native/
├── app/                          — Expo Router routes (business logic lives here)
│   ├── (auth)/                   — Welcome, phone, verify screens
│   ├── (tabs)/                   — Home, Explore, Post, Passport, Profile
│   ├── place/[id].tsx            — Café detail
│   ├── messages/                 — Inbox, new conversation, thread
│   ├── owner/                    — Claim, dashboard, manage place
│   ├── collections/              — List + detail
│   ├── checkin/[placeId].tsx     — Check-in screen
│   ├── diary.tsx                 — Visit log
│   ├── events.tsx                — Events list
│   └── onboarding.tsx            — Name + role onboarding
├── components/
│   ├── ui/                       — Shared UI (Card, Button, Avatar, MediaStrip, etc.)
│   └── splash-screen-controller.tsx
├── lib/                          — God-file for all data access
│   ├── queries.ts                — Every feature's Supabase calls
│   ├── messages.ts               — Messaging-specific queries
│   ├── oauth.ts                  — Google OAuth helper
│   ├── secure-store-adapter.ts   — Encrypted session storage
│   └── format.ts                 — Date formatting
├── hooks/                        — Scattered business logic hooks
│   ├── use-auth-context.ts
│   ├── use-app-fonts.ts
│   ├── use-push-notifications.ts
│   └── use-messages-realtime.ts
├── providers/
│   └── auth-provider.tsx         — Context-based auth state
├── constants/
│   └── theme.ts                  — Colors, fonts, spacing, shadows
├── maestro/                      — E2E test flows (12 .yaml files)
├── scripts/
│   └── test-e2e.sh               — Sequential Maestro runner
├── app.json                      — Expo config (New Arch, EAS project)
├── package.json                  — Dependencies (no TanStack Query, no Zustand, no FlashList)
└── CLAUDE.md                     — Living architecture doc
```

**Key observation:** The app is **feature-complete** but **architecturally immature**. It works well for a single developer building linearly, but it will not scale to multiple features, multiple developers, or high user volume without structural pain.

---

## Part 2: Product Vision & Target Audience

### 2.1 Who We're Building For

- **Primary:** College students (18–24) in urban India — Hyderabad first, then Bangalore, Mumbai, Pune
- **Secondary:** Young professionals (24–30) who frequent cafes, attend events, and discover hangout spots
- **Behavior:** Heavy Instagram/TikTok users, expect 60fps scrolling, instant feedback, photo-first sharing
- **Pain points:** No single app combines event discovery (District) with social sharing (Instagram) for the cafe/hangout niche

### 2.2 The District + Instagram Hybrid

| From District | From Instagram | lore. Implementation |
|---------------|----------------|----------------------|
| Event discovery + ticketing | — | Done (Phase 4) |
| Venue pages with photos/info | — | Done (Phase 2) |
| — | Social feed of activity | Done (Phase 2–3) |
| — | Photo/video posts (drops) | Done (Phase 3, 5) |
| — | Tagging friends | Done (Phase 3) |
| — | Direct messaging | Done (Phase 8) |
| — | Stories / ephemeral content | Not built yet — Phase 10+ |
| — | Reels / short video | Not built yet — Phase 10+ |
| Location-aware discovery | — | Not built yet — Post-Foundation |
| Check-in + passport stamps | — | Done (Phase 4) — unique to lore. |

### 2.3 Audience-Driven Technical Priorities

This audience reshuffles the foundation priorities:

| Audience Trait | Technical Implication | Priority Shift |
|----------------|----------------------|----------------|
| Scrolls infinitely through feeds | FlashList is non-negotiable | Bump to P0 |
| Uploads 4K photos without thinking | Image compression is essential | Bump to P0 |
| Campus WiFi is spotty | Offline support matters | Bump to P1 |
| Expects TikTok/Instagram-level smoothness | Haptics + skeletons + 60fps required | Bump to P1 |
| City-by-city rollout (Hyderabad → Bangalore → Mumbai) | Feature flags for geo-gating | Keep P1 |
| Opens app at 8pm to find "what's open?" | Location-aware discovery | Post-Foundation |

---

## Part 3: Honest Gap Assessment

### 3.1 The 7 Critical Gaps

| # | Gap | Why It Matters | Severity |
|---|-----|---------------|----------|
| 1 | **No server-state management layer** | Every screen fetches its own data with raw Supabase calls. No caching, no deduplication, no background refresh, no optimistic UI. | Critical |
| 2 | **God-file data layer (`lib/queries.ts`)** | All features' data access in one file. Adding a feature means appending to a 400+ line file. Impossible to delete a feature cleanly. | Critical |
| 3 | **No generated Supabase types** | All Supabase responses are implicitly `any`. Schema drift between web and native is only caught at runtime. | Critical |
| 4 | **No error boundaries** | One malformed drop/media URL crashes the entire screen. No per-feature isolation. | High |
| 5 | **No crash reporting or analytics** | Zero visibility into production crashes or user behavior. Flying blind at 100 users, let alone 100K. | High |
| 6 | **No CI/CD or automated builds** | No `eas.json`. No GitHub Actions. Every build and TestFlight upload is manual. | High |
| 7 | **No feature flags** | Every feature is hardcoded. Can't soft-launch, A/B test, or roll back without a full app release. | Medium |

### 3.2 Secondary Gaps (Important but Not Blocking)

| # | Gap | Why It Matters | Severity |
|---|-----|---------------|----------|
| 8 | **FlatList instead of FlashList** | FlatList mounts every item. FlashList recycles views. Difference is invisible at 20 items, catastrophic at 500. Critical for college audience. | Critical |
| 9 | **No image compression pipeline** | Raw uploads of full-resolution photos. Wastes bandwidth, storage, and user patience. Critical for college audience. | Critical |
| 10 | **No offline support** | App is useless without connectivity. Can't compose a drop on a subway and send it when online. | Medium |
| 11 | **Context-based auth state** | Re-renders the entire tree on auth changes. Zustand would isolate updates. | Low |
| 12 | **No bundle splitting / lazy loading** | Every feature's code loads on first app launch. Owner dashboard code is parsed even if user never opens it. | Low |
| 13 | **No biometric auth for sensitive actions** | Owner can delete dishes with a single tap. No confirmation gate beyond native Alert. | Low |
| 14 | **No privacy manifest (`PrivacyInfo.xcprivacy`)** | Apple requires this for iOS 17+. Missing it = automatic rejection. | Critical (for store) |

### 3.3 What Phase 9 Did NOT Fix

Phase 9 was a **performance polish pass**, not an architecture refactor. It optimized within the existing structure:
- Memoized components (prevents re-renders)
- Tuned FlatList props (scrolling headroom)
- Image caching (fewer re-downloads)
- Did NOT add a data caching layer
- Did NOT split the god-file
- Did NOT add type generation
- Did NOT add error boundaries
- Did NOT add CI/CD

**Phase 9 made the app smoother. It did not make it more maintainable.**

---

## Part 4: Foundation Build Plan

### 4.1 Philosophy

- **Server state ≠ Client state.** Server data lives in TanStack Query. UI/auth/draft state lives in Zustand.
- **Features own their code.** A feature is a vertical slice: API, components, screens, state.
- **Types are generated, not hand-written.** One command keeps web and native in sync.
- **Build once, distribute automatically.** EAS Build + GitHub Actions = push-to-TestFlight.
- **Features ship behind flags.** No feature goes live to 100% of users on day one.
- **Audience-first.** College students scroll infinitely, upload huge photos, and expect TikTok-level smoothness.

### 4.2 The 10 Foundation Steps

---

#### Step 1: Generate Supabase Types (1 hour)

**Goal:** End-to-end type safety. Catch schema drift at build time, not runtime.

**Actions:**
1. Install Supabase CLI: `npm install supabase --save-dev`
2. Add to `package.json` scripts:
   ```json
   "types:supabase": "supabase gen types typescript --project-id jgksopmbfttqqngrsama --schema public > src/shared/supabase/database.types.ts"
   ```
3. Run: `npm run types:supabase`
4. Create typed client:
   ```ts
   // src/shared/supabase/client.ts
   import { createClient } from '@supabase/supabase-js';
   import { Database } from './database.types';

   export const supabase = createClient<Database>(
     process.env.EXPO_PUBLIC_SUPABASE_URL!,
     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```
5. Replace all `import { supabase } from '@/lib/supabase'` with the typed client.
6. Run `npx tsc --noEmit` and fix every type error that surfaces.

**Success criteria:** `tsc --noEmit` passes with zero errors using generated types.

---

#### Step 2: Restructure to Feature-Based Folders (1 day)

**Goal:** A feature can be added, modified, or deleted by touching one directory.

**Actions:**
1. Create the new directory structure:
   ```
   src/
   ├── features/
   │   ├── auth/
   │   ├── places/
   │   ├── drops/
   │   ├── messages/
   │   ├── passport/
   │   ├── events/
   │   ├── collections/
   │   └── owner/
   ├── shared/
   │   ├── components/
   │   ├── theme/
   │   ├── supabase/
   │   ├── hooks/
   │   └── utils/
   └── app/              — Route files only, re-export from features/
   ```

2. **Move files** (do NOT rewrite logic yet, just move):
   - `components/ui/DropCard.tsx` → `src/features/drops/components/DropCard.tsx`
   - `components/ui/PlaceListItem.tsx` → `src/features/places/components/PlaceListItem.tsx`
   - `components/ui/MediaStrip.tsx` → `src/features/drops/components/MediaStrip.tsx`
   - `components/ui/Avatar.tsx` → `src/shared/components/Avatar.tsx`
   - `components/ui/StarRating.tsx` → `src/features/owner/components/StarRating.tsx`
   - `lib/secure-store-adapter.ts` → `src/shared/supabase/secure-store-adapter.ts`
   - `lib/format.ts` → `src/shared/utils/formatDate.ts`
   - `constants/theme.ts` → `src/shared/theme/` (split into colors.ts, typography.ts, spacing.ts)

3. Update `tsconfig.json` paths:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     }
   }
   ```

4. Update all imports. Use find-and-replace:
   - `@/lib/queries` → `@/features/*/api/*` (temporary, will split in Step 3)
   - `@/components/ui/*` → `@/features/*/components/*` or `@/shared/components/*`
   - `@/constants/theme` → `@/shared/theme/*`

**Success criteria:** App compiles and runs. No files in `lib/` or `components/` except during migration.

---

#### Step 3: Add TanStack Query (2 days)

**Goal:** Server-state layer with caching, background refresh, deduplication, and optimistic updates.

**Actions:**
1. Install: `npm install @tanstack/react-query`
2. Install devtools: `npm install --save-dev @tanstack/eslint-plugin-query`
3. Create QueryProvider:
   ```tsx
   // src/shared/components/QueryProvider.tsx
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 1000 * 60 * 2,     // 2 minutes
         gcTime: 1000 * 60 * 10,       // 10 minutes cache
         retry: 2,
         refetchOnWindowFocus: false,
       },
     },
   });
   ```
4. Wrap app in `app/_layout.tsx`.
5. **Migrate ONE feature as proof of concept** — Home feed:
   ```ts
   // src/features/drops/api/useDrops.ts
   export function usePlaceDrops(placeId: string) {
     return useQuery({
       queryKey: ['places', placeId, 'drops'],
       queryFn: async () => {
         const { data, error } = await supabase
           .from('drops')
           .select(`...`)
           .eq('place_id', placeId)
           .order('created_at', { ascending: false })
           .limit(50);
         if (error) throw error;
         return data;
       },
       staleTime: 1000 * 60 * 2,
     });
   }
   ```
6. Replace `app/(tabs)/index.tsx` to use `usePlaceDrops()` instead of `fetchDropFeed()`.
7. Add `useCreateDrop` mutation with invalidation:
   ```ts
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ['home', 'feed'] });
   }
   ```

**Success criteria:** Home screen loads drops via TanStack Query, pull-to-refresh works, creating a drop updates the feed automatically.

---

#### Step 4: Migrate All Features to TanStack Query (3 days)

**Goal:** Every feature uses its own API hooks. Delete `lib/queries.ts`.

**Migration order:**
1. `places/` — `usePlace`, `usePlaceList`, `useSearchPlaces`
2. `messages/` — `useConversations`, `useMessages`, `useSendMessage`
3. `passport/` — `usePassport`, `useCheckIn`
4. `events/` — `useEvents`, `useReserveTickets`
5. `collections/` — `useCollections`
6. `owner/` — `useOwnerPlaces`, `useManageDishes`

**For each feature:**
- Create `src/features/{feature}/api/` directory
- Extract relevant functions from `lib/queries.ts` into feature-specific hooks
- Convert raw Supabase calls to `useQuery` / `useMutation`
- Update screens to use new hooks
- Add query invalidation on mutations

**Query key convention:**
```ts
['places', 'list']                    // explore list
['places', 'search', query]           // search results
['places', placeId]                   // single place
['places', placeId, 'dishes']         // place dishes
['places', placeId, 'drops']          // place drops
['home', 'feed']                      // global home feed
['conversations', 'list']             // inbox
['conversations', conversationId]     // single conversation
['user', userId, 'profile']           // any user's profile
['user', 'me', 'passport']            // signed-in user's passport
```

**Success criteria:** `lib/queries.ts` is deleted. Every screen uses feature-based TanStack Query hooks.

---

#### Step 5: Add Zustand for Client State (1 day)

**Goal:** Replace Context-based auth with a store that doesn't re-render the entire tree.

**Actions:**
1. Install: `npm install zustand`
2. Create auth store:
   ```ts
   // src/features/auth/stores/authStore.ts
   import { create } from 'zustand';
   import { Session, User } from '@supabase/supabase-js';

   interface Profile {
     id: string;
     display_name: string | null;
     role: string;
     onboarded: boolean;
     avatar_url: string | null;
   }

   interface AuthState {
     session: Session | null;
     user: User | null;
     profile: Profile | null;
     isLoading: boolean;
     setSession: (session: Session | null) => void;
     setProfile: (profile: Profile | null) => void;
     setLoading: (loading: boolean) => void;
     signOut: () => void;
   }

   export const useAuthStore = create<AuthState>((set) => ({
     session: null,
     user: null,
     profile: null,
     isLoading: true,
     setSession: (session) => set({ session, user: session?.user ?? null }),
     setProfile: (profile) => set({ profile }),
     setLoading: (isLoading) => set({ isLoading }),
     signOut: () => set({ session: null, user: null, profile: null }),
   }));
   ```
3. Refactor `AuthProvider` to hydrate the store instead of managing its own state.
4. Update `RootNavigator` to read from `useAuthStore`.
5. Update all `useAuthContext()` calls to `useAuthStore()`.

**Success criteria:** Auth state works identically but without Context provider wrapping. `tsc` and E2E pass.

---

#### Step 6: Add Error Boundaries (4 hours)

**Goal:** One bad component doesn't crash the entire screen.

**Actions:**
1. Create reusable ErrorBoundary:
   ```tsx
   // src/shared/components/ErrorBoundary.tsx
   import React, { Component, ReactNode } from 'react';
   import { View, Text, Pressable } from 'react-native';

   interface Props { children: ReactNode; fallback?: ReactNode; onReset?: () => void; }
   interface State { hasError: boolean; error?: Error; }

   export class ErrorBoundary extends Component<Props, State> {
     state = { hasError: false };
     static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
     componentDidCatch(error: Error, info: React.ErrorInfo) {
       // Will integrate Sentry here in Step 7
       console.error(error, info.componentStack);
     }
     render() {
       if (this.state.hasError) {
         return this.props.fallback ?? (
           <View>
             <Text>Something went wrong</Text>
             <Pressable onPress={() => { this.setState({ hasError: false }); this.props.onReset?.(); }}>
               <Text>Retry</Text>
             </Pressable>
           </View>
         );
       }
       return this.props.children;
     }
   }
   ```
2. Wrap every tab screen:
   ```tsx
   <ErrorBoundary onReset={() => queryClient.invalidateQueries({ queryKey: ['home', 'feed'] })}>
     <HomeScreen />
   </ErrorBoundary>
   ```
3. Wrap every pushed screen route in `app/`.

**Success criteria:** Intentionally throw an error in a `DropCard` — only that card's boundary catches it, not the whole Home screen.

---

#### Step 7: Add Crash Reporting + Analytics (4 hours)

**Goal:** Know what's breaking and how users behave before you have 100K users.

**Actions:**
1. **Sentry** for crashes:
   ```bash
   npx expo install @sentry/react-native
   ```
   Initialize in `app/_layout.tsx`:
   ```ts
   import * as Sentry from '@sentry/react-native';

   Sentry.init({
     dsn: 'YOUR_DSN',
     debug: __DEV__,
     tracesSampleRate: 0.1,
   });
   ```
   Wrap the app: `Sentry.wrap(App)`.

2. **PostHog** for analytics (privacy-friendly, EU-hosted option):
   ```bash
   npx expo install posthog-react-native expo-file-system
   ```
   Track key events:
   ```ts
   posthog.capture('drop_created', { place_id, has_media, tagged_count });
   posthog.capture('message_sent', { conversation_id, has_media });
   posthog.screen('PlaceDetail', { place_id });
   ```

3. **App Tracking Transparency (ATT)** — required BEFORE any analytics:
   ```bash
   npx expo install expo-tracking-transparency
   ```
   ```ts
   import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

   const { status } = await requestTrackingPermissionsAsync();
   if (status === 'granted') posthog.optIn();
   else posthog.optOut();
   ```

4. **Privacy Manifest** (`ios/PrivacyInfo.xcprivacy`):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
   <plist version="1.0">
   <dict>
     <key>NSPrivacyCollectedDataTypes</key>
     <array>
       <dict>
         <key>NSPrivacyCollectedDataType</key>
         <string>NSPrivacyCollectedDataTypeUserID</string>
         <key>NSPrivacyCollectedDataTypeLinked</key>
         <true/>
         <key>NSPrivacyCollectedDataTypeTracking</key>
         <false/>
         <key>NSPrivacyCollectedDataTypePurposes</key>
         <array>
           <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
         </array>
       </dict>
       <dict>
         <key>NSPrivacyCollectedDataType</key>
         <string>NSPrivacyCollectedDataTypePhotosOrVideos</string>
         <key>NSPrivacyCollectedDataTypeLinked</key>
         <true/>
         <key>NSPrivacyCollectedDataTypeTracking</key>
         <false/>
         <key>NSPrivacyCollectedDataTypePurposes</key>
         <array>
           <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
         </array>
       </dict>
     </array>
   </dict>
   </plist>
   ```

**Success criteria:** Sentry receives a test crash report. PostHog receives a test event. ATT prompt shows on first launch. `PrivacyInfo.xcprivacy` is in the iOS build.

---

#### Step 8: Add Feature Flags (4 hours)

**Goal:** Ship code for new features without enabling them for all users. Critical for city-by-city rollout.

**Actions:**
1. Create Supabase table:
   ```sql
   create table feature_flags (
     key text primary key,
     enabled boolean default false,
     rollout_percentage int default 100 check (rollout_percentage between 0 and 100),
     target_roles text[] default '{}',
     target_cities text[] default '{}'  -- for geo-gating
   );
   ```

2. Create hook:
   ```ts
   // src/features/flags/api/useFeatureFlag.ts
   export function useFeatureFlag(key: string) {
     const { profile } = useAuthStore();
     return useQuery({
       queryKey: ['flags', key],
       queryFn: async () => {
         const { data } = await supabase.from('feature_flags').select('*').eq('key', key).single();
         if (!data?.enabled) return false;
         if (data.target_roles.length > 0 && !data.target_roles.includes(profile?.role)) return false;
         const hash = profile?.id?.split('').reduce((a, b) => a + b.charCodeAt(0), 0) ?? 0;
         return (hash % 100) < data.rollout_percentage;
       },
       staleTime: 1000 * 60 * 5,
     });
   }
   ```

3. Use in screens:
   ```tsx
   const showOwnerDashboard = useFeatureFlag('owner_dashboard_v2');
   const showEventsInCity = useFeatureFlag('events_bangalore');
   ```

**Success criteria:** Can toggle a feature on/off from Supabase dashboard without an app release.

---

#### Step 9: Add CI/CD with EAS Build (1 day)

**Goal:** Push to `main` → automatic TestFlight. Tag release → automatic App Store submission.

**Actions:**
1. Create `eas.json`:
   ```json
   {
     "cli": { "version": ">= 16.0.0" },
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "ios": { "simulator": true }
       },
       "preview": {
         "distribution": "internal",
         "ios": { "simulator": false },
         "env": {
           "EXPO_PUBLIC_SUPABASE_URL": "...",
           "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..."
         }
       },
       "production": {
         "autoIncrement": true,
         "env": {
           "EXPO_PUBLIC_SUPABASE_URL": "...",
           "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..."
         }
       }
     }
   }
   ```

2. Create `.github/workflows/check.yml` (runs on every PR):
   ```yaml
   name: Check
   on: [pull_request]
   jobs:
     check:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20', cache: 'npm' }
         - run: npm ci
         - run: npm run types:supabase
         - run: npx tsc --noEmit
         - run: npx eslint . --ext .ts,.tsx
   ```

3. Create `.github/workflows/build-preview.yml` (runs on merge to `main`):
   ```yaml
   name: EAS Preview Build
   on:
     push:
       branches: [main]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20', cache: 'npm' }
         - run: npm ci
         - run: npm run types:supabase
         - run: npx tsc --noEmit
         - uses: expo/expo-github-action@v8
           with:
             eas-version: latest
             token: ${{ secrets.EXPO_TOKEN }}
         - run: eas build --platform ios --profile preview --non-interactive
   ```

4. Create `.github/workflows/build-production.yml` (runs on tag):
   ```yaml
   name: EAS Production Build
   on:
     push:
       tags: ['v*']
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20', cache: 'npm' }
         - run: npm ci
         - run: npm run types:supabase
         - run: npx tsc --noEmit
         - uses: expo/expo-github-action@v8
           with:
             eas-version: latest
             token: ${{ secrets.EXPO_TOKEN }}
         - run: eas build --platform ios --profile production --non-interactive
         - run: eas submit --platform ios --non-interactive
   ```

5. Add `EXPO_TOKEN` secret to GitHub repo settings.

**Success criteria:** Push to `main` triggers a preview build. Tag `v1.0.0` triggers production build + App Store submission.

---

#### Step 10: Replace FlatList with FlashList (4 hours)

**Goal:** 60fps at 500+ items, not just 50. Critical for college audience that scrolls infinitely.

**Actions:**
1. Install: `npm install @shopify/flash-list`
2. Replace every `FlatList`:
   ```tsx
   // Before
   <FlatList data={drops} renderItem={...} />

   // After
   <FlashList
     data={drops}
     renderItem={...}
     estimatedItemSize={400}  // Required! Measure a typical item.
   />
   ```
3. Test on Simulator with 100+ seed drops (generate test data if needed).

**Success criteria:** Scroll through 100+ drops without frame drops. RN Perf Monitor shows 60fps.

---

### 4.3 Foundation Completion Checklist

After all 10 steps:

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx eslint . --ext .ts,.tsx` passes with zero errors
- [ ] `npm run types:supabase` generates `database.types.ts` successfully
- [ ] `lib/queries.ts` is **deleted**
- [ ] `lib/messages.ts` is **deleted**
- [ ] Every screen uses feature-based TanStack Query hooks
- [ ] Auth state uses Zustand, not Context
- [ ] Error boundaries wrap every tab and pushed screen
- [ ] Sentry receives a test crash report
- [ ] PostHog receives a test analytics event
- [ ] ATT prompt shows on first launch
- [ ] `PrivacyInfo.xcprivacy` exists in iOS build
- [ ] Feature flags table exists and `useFeatureFlag` hook works
- [ ] `eas.json` exists with dev/preview/production profiles
- [ ] GitHub Action runs `tsc + eslint` on every PR
- [ ] GitHub Action triggers EAS preview build on merge to `main`
- [ ] FlashList replaces all FlatList usage in feeds/lists
- [ ] Maestro E2E suite passes (9/12 green, same as before — no regressions)
- [ ] No `console.warn` on startup

---

## Part 5: Post-Foundation Enhancements

Do these after Step 10. Order by priority for your audience.

### 5.1 Image Compression Pipeline (P0 — Do Immediately After Step 10)

**Why:** College students upload 4K photos without thinking. 50MB uploads = instant churn.

**Actions:**
1. Install: `npx expo install expo-image-manipulator`
2. Create helper:
   ```ts
   export async function compressImage(uri: string): Promise<string> {
     const manipulated = await ImageManipulator.manipulateAsync(
       uri,
       [{ resize: { width: 1080 } }],
       { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
     );
     return manipulated.uri;
   }
   ```
3. Use before every upload in `useCreateDrop`, avatar change, dish photo, message media.
4. Use Supabase Storage image transformations for thumbnails:
   ```ts
   const thumbnailUrl = `${storageUrl}/render/image/public/drop-media/${path}?width=400&height=400&resize=cover`;
   ```

### 5.2 Haptics + Skeleton Screens (P1 — Premium Feel)

**Why:** This demographic notices jank. TikTok/Instagram trained them to expect 60fps and instant feedback.

**Actions:**
1. Create `src/shared/utils/haptics.ts`:
   ```ts
   import * as Haptics from 'expo-haptics';
   export const haptics = {
     light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
     medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
     success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
     error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
   };
   ```
2. Add to all primary actions (drop, send, check-in, claim, reserve).
3. Create skeleton components that mirror `DropCard`, `PlaceCard`, etc.
4. Replace `ActivityIndicator` spinners with skeleton screens on first load.

### 5.3 Offline Support (P1 — Campus WiFi Reality)

**Why:** App is useless without connectivity. Can't compose a drop on a subway and send it when online.

**Actions:**
1. Add TanStack Query persistence:
   ```bash
   npm install @tanstack/react-query-persist-client
   npm install @tanstack/query-async-storage-persister
   ```
2. Wrap QueryClient with `PersistQueryClientProvider`.
3. Add mutation queue with Zustand for offline mutations.
4. Process queue when connectivity returns (use `NetInfo`).

### 5.4 Location-Aware Discovery (P1 — "What's Near Me?")

**Why:** Users open the app at 8pm asking "what's open near me?"

**Actions:**
1. Install: `npx expo install expo-location`
2. Create `useNearbyPlaces` hook:
   ```ts
   export function useNearbyPlaces(radiusMeters: number = 5000) {
     return useQuery({
       queryKey: ['places', 'nearby', radiusMeters],
       queryFn: async () => {
         const { coords } = await Location.getCurrentPositionAsync();
         const { data } = await supabase.rpc('nearby_places', {
           lat: coords.latitude,
           lng: coords.longitude,
           radius: radiusMeters,
         });
         return data;
       },
       staleTime: 1000 * 60 * 5,
     });
   }
   ```
3. Add `nearby_places` RPC to Supabase (PostGIS).

### 5.5 MMKV for Fast Local Storage (P2)

**Why:** AsyncStorage is slow and async-only. MMKV is synchronous and 10-100x faster.

**Actions:**
1. Install: `npm install react-native-mmkv`
2. Create storage instance for non-session data (search history, feature flags cache, onboarding state).
3. Keep `expo-secure-store` + AES for the Supabase session only.

### 5.6 Biometric Auth for Sensitive Actions (P2)

**Why:** Owner dashboard actions (delete dish, change status) should require confirmation.

**Actions:**
1. Install: `npx expo install expo-local-authentication`
2. Create helper:
   ```ts
   export async function requireBiometric(reason: string): Promise<boolean> {
     const hasHardware = await LocalAuthentication.hasHardwareAsync();
     if (!hasHardware) return true;
     const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
     return result.success;
   }
   ```
3. Gate destructive actions in owner dashboard.

### 5.7 Shared Element Transitions (P2 — Trendy)

**Why:** Café card → detail screen should animate the image and title. Instagram/Airbnb standard.

**Actions:**
1. Use Reanimated 3 shared transitions (already installed):
   ```tsx
   <Animated.View sharedTransitionTag={`place-image-${place.id}`}>
     <Image source={place.image_url} />
   </Animated.View>
   ```

### 5.8 Backend Scaling (Ongoing)

**Why:** The frontend foundation is useless if the backend chokes.

**Actions:**
1. **Materialized view for home feed** — refresh every 5 minutes instead of querying 4 joins on every request.
2. **Connection pooling** — Supabase free tier = 60 connections. Move to Pro + PgBouncer before 1K DAU.
3. **CDN for media** — Cloudflare in front of Supabase Storage.
4. **Edge Functions** — Move feed algorithm and search ranking to Deno Edge Functions.

---

## Part 6: Data Strategy — Cafe & Venue Content

### 6.1 The Core Principle

**Content follows brand. Brand follows community. Community follows product.**

Don't let cafe data population block the foundation. The architecture (Supabase schema, owner claim flow, RLS policies) is what matters now. Content can be added incrementally.

### 6.2 The Three-Phase Content Strategy

#### Phase A: Manual Curation (Pre-TestFlight)

**Timeline:** 1 day of work, done right before beta
**Volume:** 20–50 hand-picked Hyderabad cafes
**Why:**
- Quality over quantity — 30 curated cafes with great photos beats 500 scraped listings with stale data
- First impression matters — an empty app kills retention; a tight curated list feels intentional
- No legal risk — you own the data
- Sets the standard — when owners claim later, they see what a "good" listing looks like

**What to include per cafe:**
```sql
-- places table fields
name, area, address, cuisine, price_range, hours
images[] -- 3-5 high-quality photos (you take or ask owner)
instagram_handle -- for social proof
claimed_by_user_id -- null initially
claimed_at -- null initially
is_verified -- false initially
source -- 'manual'
city -- 'hyderabad'
lat, lng -- for future location features
```

**Suggested initial cafes (Hyderabad):**
- Blue Tokai Coffee Roasters (Jubilee Hills)
- Third Wave Coffee (Banjara Hills)
- Roastery Coffee House (Film Nagar)
- The Hole in the Wall Cafe (Kondapur)
- Beyond Coffee (Jubilee Hills)
- Autumn Leaf Cafe (Banjara Hills)
- The Gallery Cafe (Hitech City)
- The Moonshine Project (Jubilee Hills)
- Olive Bistro (Jubilee Hills)
- The Fat Pigeon - Bar Hop (Jubilee Hills)
- Add 20-30 more based on your personal favorites

#### Phase B: Owner Self-Service (Post-TestFlight)

**Timeline:** Ongoing, starts during beta
**Volume:** Unlimited — owners claim their own places
**Mechanism:** Your existing Phase 7 owner claim flow

**Process:**
1. Owner discovers their cafe on lore. (from your manual curation)
2. Taps "Claim this place"
3. Uploads business registration / GST / menu photos
4. Admin (you) reviews and approves via Supabase dashboard
5. Owner gets access to dashboard to update status, dishes, photos

**Why this scales:**
- Zero manual data entry for you
- Owners have incentive to keep data fresh (hours, menus, photos)
- Creates a two-sided marketplace dynamic

#### Phase C: Bulk Import for New Cities (Post-Launch)

**Timeline:** When expanding to Bangalore, Mumbai, Pune
**Volume:** Hundreds of cafes per city
**Sources:**

| Source | Legit? | Quality | Effort | When to Use |
|--------|--------|---------|--------|-------------|
| **OpenStreetMap (OSM)** | Open data | Mixed — no photos, no menus | Medium — needs cleaning | For new city launch, seed 100-200 basic listings |
| **Google Places API** | Paid API | Good — photos, hours, reviews | High — $$$, rate limits | If you have budget for API costs |
| **Zomato/District scraping** | Illegal | — | — | **Never** — against ToS, unreliable |
| **Owner outreach** | — | High | Medium — email/DM campaigns | Preferred method for verified listings |

**OSM Import Process:**
```bash
# 1. Query OSM for cafes in Bangalore
# Overpass API query:
# [out:json];
# node["amenity"="cafe"](12.8,77.5,13.1,77.7);
# out body;

# 2. Clean and transform data
# 3. Insert into places table with source='osm_import', is_verified=false
# 4. Owners claim and verify their listings
```

**Important:** OSM data is a **starting point**, not final data. Always pair with owner verification.

### 6.3 Database Schema Additions for Content Strategy

Add these fields to your `places` table if not present:

```sql
-- Add to existing places table
alter table places add column if not exists
  source text default 'manual' check (source in ('manual', 'owner_claimed', 'osm_import')),
  is_verified boolean default false,
  city text default 'hyderabad',
  lat double precision,
  lng double precision,
  instagram_handle text,
  claimed_by_user_id uuid references profiles(id),
  claimed_at timestamptz,
  verified_at timestamptz,
  verification_documents text[] default '{}'; -- URLs to uploaded docs

-- Index for geo queries
create index if not exists idx_places_location on places using gist (point(lng, lat));
create index if not exists idx_places_city on places(city);
create index if not exists idx_places_source on places(source);
```

> Note (added during v2.1 reconciliation): `claimed_by_user_id` duplicates
> the `owner_id` column Phase 7 already added to `places`. The reconciled
> plan (Phase 14) reuses `owner_id` instead of adding this column.

### 6.4 Content Moderation Strategy

| Content Type | Moderation Approach |
|-------------|---------------------|
| **Cafe listings (manual)** | Pre-approved by you before going live |
| **Cafe listings (owner claimed)** | Admin approval required before `is_verified = true` |
| **Drops (user posts)** | Post-moderation via community reporting + AI flagging (future) |
| **Dish photos (owner uploaded)** | Post-moderation — users can report inaccurate photos |
| **Event listings** | Admin approval required (events involve ticketing/money) |
| **Reviews/ratings** | Post-moderation — flag fake reviews via reporting |

**For now (pre-launch):**
- Manual approval for all owner claims
- No AI moderation needed at <1K users
- Community reporting feature in Phase 10+

---

## Part 7: Long-Term Infrastructure Considerations

### 7.1 Backend Architecture Evolution

| Phase | Users | Infrastructure | Supabase Tier |
|-------|-------|---------------|---------------|
| **Now** | <100 | Single Supabase project, shared with web | Free |
| **TestFlight** | <1K | Same, monitor connection usage | Free |
| **Launch** | 1K–10K | Add PgBouncer, CDN for media | Pro |
| **Growth** | 10K–50K | Read replicas, Edge Functions for heavy queries | Pro + addons |
| **Scale** | 50K–100K+ | Multi-region, dedicated Postgres, caching layer | Enterprise |

### 7.2 Database Scaling Checklist

- [ ] **Materialized views** for home feed, trending places, popular events
- [ ] **Connection pooling** (PgBouncer) before hitting 60 concurrent connections
- [ ] **Read replicas** for analytics/reporting queries
- [ ] **Partitioning** for large tables (`drops`, `messages`, `notifications` by date)
- [ ] **Archive strategy** — old drops move to cold storage after 1 year
- [ ] **Rate limiting** — API rate limits per user to prevent abuse

### 7.3 Multi-City Expansion Strategy

| City | Launch Strategy | Data Source |
|------|----------------|-------------|
| **Hyderabad** | Manual curation + owner claims | Your personal network |
| **Bangalore** | OSM seed + owner outreach | OSM import + Instagram DMs to cafes |
| **Mumbai** | OSM seed + owner outreach | Same |
| **Pune** | OSM seed + owner outreach | Same |
| **Delhi NCR** | Partner with cafe chains | Chain-level API integration (Blue Tokai, Third Wave) |

**Feature flags for city gating:**
```sql
-- Enable explore tab only for Hyderabad initially
insert into feature_flags (key, enabled, target_cities) values
('explore_tab', true, '{hyderabad}'),
('events_tab', false, '{}'),  -- disabled everywhere until Phase 10
('owner_dashboard', true, '{hyderabad}');
```

### 7.4 Security Hardening (Ongoing)

| Layer | Current | Target |
|-------|---------|--------|
| **Auth** | Google + Phone OTP | Add Apple Sign-In (required for App Store), biometric lock |
| **API** | Direct Supabase access | Edge Functions for sensitive operations (payments, claims) |
| **Storage** | Public buckets with RLS | Signed URLs for private media, CDN for public |
| **Push** | `pg_net` + `pg_cron` | Add fallback to Firebase Cloud Messaging |
| **Rate limiting** | None | Per-user rate limits on drops, messages, claims |
| **Audit logging** | None | Log all admin actions, owner changes, ticket transactions |

### 7.5 Compliance & Legal

| Requirement | Status | Action |
|-------------|--------|--------|
| **Apple ATT** | Not done | Implement before analytics (Step 7) |
| **Privacy manifest** | Not done | Add `PrivacyInfo.xcprivacy` (Step 7) |
| **GDPR (EU users)** | N/A | Not needed for India-only launch |
| **DPDP (India 2023)** | Future | Prepare consent flows for data processing |
| **App Store guidelines** | Partial | Review guideline 4.0 (design), 5.0 (legal) |
| **Terms of Service** | Not done | Draft before public beta |
| **Privacy Policy** | Not done | Required for App Store submission |
| **Content moderation policy** | Not done | Define before user-generated content scales |

---

## Part 8: App Store Submission Path

### 8.1 Pre-Submission Checklist

After Foundation (Part 4) + Post-Foundation (Part 5) + Data Strategy (Part 6) are complete:

| Category | Checklist Item |
|----------|---------------|
| **Build** | `eas build --platform ios --profile production` succeeds |
| **Tests** | Maestro E2E passes on a release build (not just dev client) |
| **Performance** | RN Perf Monitor shows 60fps on Home, Explore, Messages with 100+ items |
| **Bundle** | Bundle size < 50MB (check EAS build artifacts) |
| **Analytics** | PostHog receiving events, Sentry receiving crashes |
| **Privacy** | ATT prompt implemented, `PrivacyInfo.xcprivacy` included |
| **Legal** | App Store description, screenshots (5.5" + 6.5"), privacy policy URL |
| **Content** | 20–30 curated Hyderabad cafes with photos and accurate data |
| **Backend** | Supabase project on Pro tier (or at least PgBouncer enabled) |
| **Beta** | TestFlight internal testing with 5+ real users for 1 week |

### 8.2 Submission Order

1. **Internal TestFlight** — You + team only. Catch crashes on real devices.
2. **External TestFlight (beta)** — Up to 10K testers via public link. Collect feedback.
3. **App Store Review** — Submit for review. Expect 1–2 rejections for metadata/fixes.
4. **Release** — Phased release (1% → 5% → 25% → 100%) with feature flags as safety net.

---

## Part 9: Execution Order Summary

### Phase A: Foundation (Do These In Order)

| Step | Task | Time | Depends On |
|------|------|------|-----------|
| 1 | Generate Supabase types | 1 hour | — |
| 2 | Feature-based folder restructure | 1 day | Step 1 |
| 3 | Add TanStack Query + proof of concept | 2 days | Step 2 |
| 4 | Migrate all features to TanStack Query | 3 days | Step 3 |
| 5 | Zustand for auth state | 1 day | Step 4 |
| 6 | Error boundaries | 4 hours | Step 5 |
| 7 | Sentry + PostHog + ATT + Privacy Manifest | 4 hours | Step 6 |
| 8 | Feature flags | 4 hours | Step 7 |
| 9 | CI/CD (eas.json + GitHub Actions) | 1 day | Step 8 |
| 10 | FlashList migration | 4 hours | Step 9 |

**Total: ~2 weeks of focused work.**

### Phase B: Audience-Critical Polish (Do Immediately After Foundation)

| Task | Time | Priority | Why |
|------|------|----------|-----|
| Image compression pipeline | 1 day | P0 | College students upload 4K photos |
| Haptics + skeleton screens | 1 day | P1 | TikTok/Instagram-trained expectations |
| Offline support | 2 days | P1 | Campus WiFi reality |
| Location-aware discovery | 1 day | P1 | "What's open near me?" |
| MMKV for local storage | 3 hours | P2 | Speed |
| Biometric auth | 4 hours | P2 | Security for owner actions |
| Shared element transitions | 1 day | P2 | Trendy, not critical |

### Phase C: Content & Launch Prep

| Task | Time | When |
|------|------|------|
| Manual curation: 20–30 Hyderabad cafes | 1 day | Right before TestFlight |
| Owner claim flow testing | 2 hours | During TestFlight beta |
| Terms of Service + Privacy Policy | 4 hours | Before App Store submission |
| App Store screenshots + description | 1 day | Before submission |
| Production build + TestFlight internal | 2 hours | — |
| Real device testing | 2 days | — |
| External beta (1 week) | 1 week | — |
| App Store review submission | 1–3 days | — |
| Address review feedback | 1–2 days | — |

---

## Part 10: Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Language** | TypeScript + React Native | Same as web app, massive ecosystem, proven at scale (Instagram, Discord, Shopify) |
| **Framework** | Expo SDK 54 | Best RN DX, handles builds/updates/signing, New Arch ready |
| **State (server)** | TanStack Query | Industry standard, caching, optimistic UI, devtools |
| **State (client)** | Zustand | Simpler than Redux, no provider wrapping, excellent RN support |
| **List virtualization** | FlashList | Recycled views = 60fps at scale. Critical for college audience. |
| **Feature flags** | Supabase table | No third-party cost, already using Supabase, SQL-level control, geo-gating |
| **Analytics** | PostHog | Open-source, EU-hosted option, no Google/Facebook dependency |
| **Crash reporting** | Sentry | Best-in-class for RN, native crash capture, breadcrumbs |
| **CI/CD** | EAS Build + GitHub Actions | Expo-native, handles signing, auto-increment, submission |
| **Offline** | TanStack Query persistence + queue | Don't reinvent — use battle-tested patterns |
| **Image compression** | Client-side (expo-image-manipulator) | Reduces upload size before it hits the network |
| **Cafe data (initial)** | Manual curation | Quality over quantity, legal safety, sets the standard |
| **Cafe data (scale)** | Owner self-service + OSM import | Two-sided marketplace dynamic, zero manual bottleneck |
| **Monorepo** | Deferred | Not needed until web and native share >3 packages |
| **SwiftUI** | Rejected | Would require rewriting 8 phases, zero Android sharing, smaller talent pool |
| **Scraping** | Rejected | Illegal, unreliable, can't handle real-time inventory, no ticketing integration |

---

*End of Document*
