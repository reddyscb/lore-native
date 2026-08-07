# Direct messages (DMs) — design spec

Date: 2026-08-06
Status: approved, pending implementation plan (next phase after 7)

## What this is

A 1:1 direct-messaging feature between users, with photo/video
attachments. Neither the native app nor the web app has anything like
this today — the closest existing thing is public, non-private replies on
a drop (`drop_replies`, café detail's inline reply box). This is
greenfield, not a port from the web app reference repo.

## Scope decisions (confirmed in brainstorming)

- **1:1 only for v1.** No group DMs. The schema uses a participants join
  table rather than fixed `user_a_id`/`user_b_id` columns, specifically so
  a future group-DM phase doesn't need a schema migration — but no group
  UI/logic is built now (YAGNI beyond the schema shape itself).
- **Photos + videos**, same picker/limits pattern as Phase 5's drop media
  (`expo-image-picker`, `videoMaxDuration: 60`).
- **Real-time inside an open thread**, via Supabase Realtime — genuinely
  new to this app (no existing `.channel()`/`postgres_changes` usage
  anywhere in `lib/` or `hooks/`). Scoped narrowly: live updates apply
  only to a thread screen that's currently open. The inbox list and the
  tab-header unread badge refresh on tab focus / app foreground
  (`useFocusEffect`), not via a second layer of always-on subscriptions
  on every tab — five simultaneous background subscriptions for a badge
  that's at most one tab-switch stale isn't worth the lifecycle
  complexity.
- **Push notifications** on new messages, reusing the existing
  `send_expo_push` SECURITY DEFINER helper and trigger pattern from
  Phase 6 (`notify_drop_reply`/`notify_drop_tag`).
- **Unread badges**, tracked via a per-participant `last_read_at`.
- **Block a user** (prevents new messages either direction, hides the
  thread from the blocker's inbox, does not delete history) and **delete
  your own sent message**. Baseline safety controls for a feature that
  lets any user message any other user — there's no follow/friend graph
  in this app (`searchProfiles` is open name search, used identically by
  Post's tag-friends), so anyone can start a thread with anyone; blocking
  is the only mitigation for v1. No message-request/accept-first flow
  (Instagram-style) — explicitly out of scope, a fast-follow if abuse
  turns out to be a problem.
- **No custom end-to-end encryption.** Considered and explicitly declined
  in brainstorming: Supabase/Postgres encryption-at-rest + TLS in transit
  is the same standard every other table in this app already relies on
  (drops, diary entries, etc.). Real E2E would mean on-device keypairs,
  ciphertext-only storage, generic (non-preview) push bodies, and a real
  data-loss risk on reinstall (this app's Keychain-backed session already
  documents that reinstalling wipes SecureStore — the same would apply to
  an E2E private key with no backup mechanism). Rolling that from scratch
  is a security-sensitive undertaking disproportionate to this feature;
  revisit only if a specific compliance/threat-model reason emerges.
- **Entry point**: a small paper-plane-style icon with an unread badge,
  added to the existing header row of all five tab screens (Home,
  Explore, Post, Passport, Profile — each currently builds its own header
  inline, there's no shared header component today), opening the inbox.
  Starting a brand-new conversation happens from inside the inbox via a
  "new message" button → the existing name-search pattern (reusing
  `searchProfiles`). No message-button entry points elsewhere in the app
  (drop cards, reply rows, tag chips) for v1.

## Data model

Four new tables:

```sql
conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
)

conversation_participants (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
)

messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) not null,
  body text,
  media_path text,          -- storage path, not a public URL (see Storage below)
  media_type text,          -- 'image' | 'video', null if text-only
  created_at timestamptz not null default now()
)

blocked_users (
  blocker_id uuid references profiles(id),
  blocked_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
)
```

### RLS

`conversation_participants` is the tricky one: a policy like "select rows
where I'm a participant in that conversation" is self-referential and
Postgres RLS can recurse on that shape. Fix: a `SECURITY DEFINER` helper
function, `is_conversation_participant(conversation_id uuid, user_id
uuid) returns boolean`, `search_path = ''`, every reference
schema-qualified (same hardening standard as `send_expo_push` from Phase
6). Policies on `conversation_participants` and `messages` call this
helper instead of querying the join table directly.

`messages` insert policy additionally requires no `blocked_users` row
exists in either direction between `sender_id` and the other participant.

Exact SQL confirmed via the `supabase-migration` project skill at
implementation time, including a run through
`supabase-postgres-best-practices` given the self-referential RLS shape.

### Avoiding duplicate 1:1 threads

New RPC, `get_or_create_direct_conversation(other_user_id uuid) returns
uuid`, `SECURITY DEFINER`: finds an existing 2-participant conversation
between the caller and `other_user_id` or creates one, atomically — same
race-safety reasoning as the existing `reserve_tickets` RPC (two rapid
taps on "message" shouldn't create two threads).

### Storage — new pattern for this app

Every existing bucket (`drop-media`, `avatars`, `dish-photos`) is
public-read because that content is public. Message media can't be — it
needs to stay private to the two participants. This phase adds the app's
first **private** bucket, `message-media`, path format
`{conversation_id}/{message_id}.<ext>`, write RLS scoped to
`is_conversation_participant`, read via `storage.createSignedUrl()`
resolved client-side at render time rather than a stored public URL.
Signed URLs are resolved in a batch per message-list fetch (not one call
per row) to avoid N round trips on thread load.

## Screens & components

- **`app/messages/index.tsx`** (inbox) — `fetchConversations()`: each
  row shows the other participant (`Avatar`, name), last message preview,
  relative time, unread indicator. Pull-to-refresh. Tap → thread. "New
  message" button → search screen. Empty state for no conversations yet.
- **`app/messages/new.tsx`** — search via `searchProfiles` (identical
  function Post's tag-friends already uses) → tap a result →
  `getOrCreateDirectConversation(otherUserId)` → `router.push` into the
  thread.
- **`app/messages/[conversationId].tsx`** (thread) — inverted message
  list, composer (text input + photo/video picker button reusing Phase
  5's `expo-image-picker` config), marks the conversation read on focus
  (`updateLastRead`), subscribes to `postgres_changes` on `messages`
  filtered by `conversation_id` while mounted, unsubscribes on unmount.
  Long-press a message you sent → delete (`Alert.alert` confirm, matching
  existing destructive-action convention). Header overflow → block user
  (`Alert.alert` confirm).
- **`components/ui/MessagesIcon.tsx`** — paper-plane icon + unread-count
  badge, dropped into the existing header row of all five tab screens,
  navigates to `/messages`.
- **`lib/messages.ts`** (new file, kept separate from the already-large
  `lib/queries.ts`): `fetchConversations`, `getOrCreateDirectConversation`,
  `fetchMessages`, `sendMessage`, `markConversationRead`, `blockUser`,
  `deleteMessage`, `fetchUnreadCount`.
- **`hooks/use-messages-realtime.ts`** (new) — subscribes/unsubscribes to
  a conversation's `postgres_changes` channel, mirroring the
  mount/permission/ref-guard structure `hooks/use-push-notifications.ts`
  already established in this codebase.

## Data flow

- **Sending text**: optimistic local append (temp client-generated id) →
  `sendMessage()` persists → the realtime echo for the sender's own
  message is filtered out by matching the temp id, so it doesn't
  double-render.
- **Sending media**: `sendMessage()` creates the row first (to get a real
  id) → upload to `message-media/{conversation_id}/{message_id}.<ext>` →
  update the row with `media_path`/`media_type` — same "insert then
  upload keyed to the id" ordering Phase 5 used for drop media.
- **Read state**: thread screen updates `last_read_at` for the caller on
  focus; inbox/badge unread counts are `messages.created_at >
  last_read_at` per conversation, refreshed on tab focus / app
  foreground.
- **Push**: new `notify_new_message` trigger, `AFTER INSERT on messages`,
  calls `send_expo_push` for the other participant, skipped if a block
  row exists. No message content in the push body beyond a generic
  "New message from {name}" — deliberate, not a leak vector even though
  this phase isn't doing E2E (still no reason to put message content
  through Expo/APNs).
- **Blocking**: insert into `blocked_users` → RLS blocks future message
  inserts either direction → thread disappears from the blocker's inbox
  query (filtered, not deleted) → existing history is untouched in the
  database.

## Error handling

CLAUDE.md documents a real prior bug class in this codebase: silently
swallowed RLS-blocked writes (fixed in a prior commit). This phase must
not repeat it — a blocked-send or any RLS rejection surfaces as a toast,
not a silent no-op. Media upload failures show a visible failed-to-send
state on the message bubble (with a retry), not a swallowed error.
Realtime disconnects (app backgrounded/foregrounded) trigger a resubscribe
or, failing that, a manual refetch on next focus — never a silently stale
thread.

## Testing

- New Maestro flow covering the single-account path: open inbox (empty
  state) → new message → search → start a conversation → send a text
  message → see it in the thread → back out → see it listed in the
  inbox with a preview.
- Real two-account delivery, live realtime receipt, and push notification
  receipt are the same category of limitation Phase 6 already documented
  for push — they need manual verification (two simulators, or a
  simulator + a physical device), not an automated flow.
- Media picker interaction: smoke-tested only (button renders, opens the
  native sheet), same treatment as every other native-picker touchpoint
  in this app (Phase 5's media picker, Phase 7's dish photo picker) —
  native picker sheets aren't Maestro-drivable.
- Full `phase-wrapup` project skill applies at the end: typecheck, lint,
  full suite, CLAUDE.md update, manual test checklist handback.

## Explicitly out of scope for v1

- Group DMs (schema allows it later; no UI/logic now)
- Message-request/accept-first flow for strangers
- Read receipts visible to the other participant (only the recipient's
  own unread-count is tracked, not exposed as "seen by" to the sender)
- Typing indicators
- Message editing (delete-and-resend is the only correction path)
- Custom end-to-end encryption
