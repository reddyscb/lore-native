# DM Feature (Phase 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 1:1 direct-messaging feature (text + photo/video, real-time within an open thread, push notifications, blocking) for the lore-native app, per the approved spec at `docs/superpowers/specs/2026-08-06-dm-feature-design.md`.

**Architecture:** Four new Postgres tables behind RLS (a participants join table, not fixed two-user columns, so a future group-DM phase needs no schema migration) + a `SECURITY DEFINER` helper to avoid recursive RLS on the join table + an atomic `get_or_create_direct_conversation` RPC + a push trigger reusing the existing `send_expo_push` helper + the app's first **private** Storage bucket (signed URLs, not public URLs) + three new screens (inbox, new-message search, thread) + a small paper-plane entry icon wired into all five tab headers.

**Tech Stack:** Supabase Postgres/RLS/Storage/Realtime (all already in use elsewhere in this app), `@supabase/supabase-js` (already installed — no new package needed for Realtime or signed URLs), `expo-image-picker` (already installed, same config Phase 5 used for drop media), React Native/Expo Router.

## Global Constraints

- **No local migration files** — this repo has none (see CLAUDE.md). Every SQL block below is applied directly via the Supabase MCP (`apply_migration`), following the `supabase-migration` project skill, against project ref `jgksopmbfttqqngrsama`.
- **This repo has no unit test framework** (no Jest, no `*.test.*` files — verified). Verification for app-code tasks is `npx tsc --noEmit` + `npx eslint . --ext .ts,.tsx` (the project's actual CI-equivalent, per every prior phase's wrap-up), plus a Maestro flow and manual checks for anything native-picker/multi-account/push related, same limitations already documented in CLAUDE.md for Phases 5–7. Verification for DB tasks is structural (confirm the objects exist, run `get_advisors`) via Supabase MCP — full behavioral RLS testing as two distinct authenticated users isn't practical through raw SQL/MCP in this project and has never been done that way here; real behavioral proof comes from the client-code tasks and the final manual/Maestro pass, matching how Phase 7's claim-race behavior was actually verified.
- **All colors/spacing/fonts come from `constants/theme.ts`** — no inline hex values or magic numbers (existing project rule).
- **Error handling**: every user-initiated write (send, block, delete) wraps in try/catch and surfaces failures via `Alert.alert(title, error.message)` — the exact pattern already used in `app/events.tsx`, `app/owner/place/[id].tsx`, etc. CLAUDE.md documents a real prior bug class here (silently swallowed RLS-blocked writes) — do not repeat it. Passive background refreshes (e.g. the unread-count badge) log failures via `console.log` instead of alerting, matching `hooks/use-push-notifications.ts`'s existing precedent — that's a deliberate distinction (a failed background poll shouldn't interrupt the user with an alert on every tab switch), not an inconsistency.
- **No custom end-to-end encryption** — standard Supabase encryption-in-transit/at-rest only, per the spec's explicit decision.
- **Commit messages**: imperative mood, no `Co-Authored-By` trailer (this user's standing preference).

---

## Task 1: Core messaging schema — tables, RLS, participant helper, `fetch_conversations`, Realtime

**Files:**
- No files — this is a Supabase migration applied via MCP `apply_migration` (name: `phase8_messages_core`).

**Interfaces:**
- Produces (for later tasks): tables `conversations`, `conversation_participants(conversation_id, user_id, last_read_at)`, `messages(id, conversation_id, sender_id, body, media_path, media_type, created_at)`, `blocked_users(blocker_id, blocked_id)`; function `public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid) returns boolean`; function `public.fetch_conversations() returns table(conversation_id uuid, other_user_id uuid, other_display_name text, other_avatar_url text, last_message_body text, last_message_media_type text, last_message_at timestamptz, last_read_at timestamptz)`; Realtime enabled on `messages`.

- [ ] **Step 1: Apply the migration**

Via the Supabase MCP `apply_migration` tool (name `phase8_messages_core`), run:

```sql
-- conversations: a thread between users. No participant columns here —
-- membership lives in conversation_participants so a future group-DM phase
-- doesn't need a schema migration. No group UI/logic is built in this phase.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text,
  media_path text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create table public.blocked_users (
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.blocked_users enable row level security;

-- SECURITY DEFINER helper so RLS on conversation_participants doesn't
-- self-reference the table it's protecting (a plain "select from
-- conversation_participants where conversation_id in (select conversation_id
-- from conversation_participants where user_id = auth.uid())" policy is the
-- classic recursive-RLS trap on a join table).
create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;

revoke all on function public.is_conversation_participant(uuid, uuid) from public;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

create policy "conversations_select_participant" on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id, auth.uid()));

create policy "participants_select_own_conversations" on public.conversation_participants
  for select to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

-- Only last_read_at is ever written by a client, and only for your own row.
create policy "participants_update_own_read_state" on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deliberately no insert policy on conversation_participants: rows are only
-- ever created inside get_or_create_direct_conversation (Task 2), which
-- runs SECURITY DEFINER and so bypasses RLS. Regular clients can't insert
-- directly — that's what keeps membership (exactly 2 rows per v1 thread)
-- consistent.

create policy "messages_select_participant" on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "messages_insert_participant_not_blocked" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
    and not exists (
      select 1
      from public.conversation_participants other
      join public.blocked_users b
        on (b.blocker_id = other.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = other.user_id)
      where other.conversation_id = messages.conversation_id
        and other.user_id <> auth.uid()
    )
  );

create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());

create policy "blocked_users_select_own" on public.blocked_users
  for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

create policy "blocked_users_insert_own" on public.blocked_users
  for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "blocked_users_delete_own" on public.blocked_users
  for delete to authenticated
  using (blocker_id = auth.uid());

-- Inbox listing: one row per conversation the caller is in, with the other
-- participant's profile and the latest message computed server-side (via a
-- LATERAL join) so the client doesn't have to stitch three queries together.
create or replace function public.fetch_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_display_name text,
  other_avatar_url text,
  last_message_body text,
  last_message_media_type text,
  last_message_at timestamptz,
  last_read_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    cp.conversation_id,
    other.user_id,
    p.display_name,
    p.avatar_url,
    lm.body,
    lm.media_type,
    lm.created_at,
    cp.last_read_at
  from public.conversation_participants cp
  join public.conversation_participants other
    on other.conversation_id = cp.conversation_id and other.user_id <> auth.uid()
  join public.profiles p on p.id = other.user_id
  left join lateral (
    select m.body, m.media_type, m.created_at
    from public.messages m
    where m.conversation_id = cp.conversation_id
    order by m.created_at desc
    limit 1
  ) lm on true
  where cp.user_id = auth.uid()
  order by lm.created_at desc nulls last;
$$;

revoke all on function public.fetch_conversations() from public;
grant execute on function public.fetch_conversations() to authenticated;

-- Live delivery inside an open thread (Task 7's client subscription).
alter publication supabase_realtime add table public.messages;
```

- [ ] **Step 2: Verify**

Via Supabase MCP:
- `list_tables` — confirm `conversations`, `conversation_participants`, `messages`, `blocked_users` all exist with RLS enabled.
- `execute_sql`: `select proname from pg_proc where proname in ('is_conversation_participant', 'fetch_conversations');` — confirm both exist.
- `execute_sql`: `select tablename, policyname from pg_policies where tablename in ('conversations','conversation_participants','messages','blocked_users') order by tablename;` — confirm all policies above are present (8 total).
- `execute_sql`: `select pubname, tablename from pg_publication_tables where tablename = 'messages';` — confirm `messages` is in a publication (expected `supabase_realtime`; if this project uses a differently-named publication, the `alter publication` statement above will have errored at apply time — check the apply result and adjust the publication name if so).
- `get_advisors` (type `security`) — confirm no new warnings introduced by this migration (mirrors the `pg_net`-in-`public` hardening precedent from Phase 6).
- Note the exact auto-generated foreign-key constraint name Postgres assigned to `conversation_participants.user_id` (`select conname from pg_constraint where conrelid = 'public.conversation_participants'::regclass;`) — expected to be `conversation_participants_user_id_fkey` (Postgres's default single-column naming), but confirm rather than assume, since Task 5 doesn't currently need it (it reuses `fetch_conversations` instead of a PostgREST embed) but it's good to have confirmed in case a later task needs it.

- [ ] **Step 3: Commit**

No local files change for this task (schema only lives in Supabase) — nothing to commit to git. Proceed to Task 2.

---

## Task 2: `get_or_create_direct_conversation` RPC

**Files:**
- No files — Supabase migration via MCP `apply_migration` (name: `phase8_get_or_create_conversation`).

**Interfaces:**
- Consumes: tables from Task 1.
- Produces: `public.get_or_create_direct_conversation(other_user_id uuid) returns uuid`, callable by `authenticated`.

- [ ] **Step 1: Apply the migration**

```sql
create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
begin
  if other_user_id = auth.uid() then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  -- Serialize concurrent calls for the same pair of users so two rapid taps
  -- on "message" can't create two duplicate 1:1 threads — same atomicity
  -- reasoning as the existing reserve_tickets RPC.
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(auth.uid(), other_user_id)::text || ':' || greatest(auth.uid(), other_user_id)::text,
      0
    )
  );

  select cp1.conversation_id into v_conversation_id
  from public.conversation_participants cp1
  where cp1.user_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = cp1.conversation_id
        and cp2.user_id = other_user_id
    )
    and (
      select count(*) from public.conversation_participants cp3
      where cp3.conversation_id = cp1.conversation_id
    ) = 2
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations default values
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (v_conversation_id, auth.uid()),
    (v_conversation_id, other_user_id);

  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
```

- [ ] **Step 2: Verify**

- `execute_sql`: `select proname, prosecdef from pg_proc where proname = 'get_or_create_direct_conversation';` — confirm it exists and `prosecdef` is `true` (SECURITY DEFINER).
- `get_advisors` (type `security`) — confirm clean.
- Full behavioral verification (does it actually dedupe, does the advisory lock actually prevent a race) happens once Task 5 wires this into `lib/messages.ts` and it's exercised from the running app — `auth.uid()` isn't meaningfully set when calling via the MCP's raw SQL execution, so a true two-user round trip can't be validated at this layer.

- [ ] **Step 3: Commit**

Nothing to commit. Proceed to Task 3.

---

## Task 3: `notify_new_message` push trigger

**Files:**
- No files — Supabase migration via MCP `apply_migration` (name: `phase8_notify_new_message`).

**Interfaces:**
- Consumes: `public.messages` table (Task 1), existing `public.send_expo_push(user_id uuid, title text, body text, data jsonb)` function (Phase 6, already live on this project).
- Produces: trigger `on_message_created` firing after every `messages` insert.

- [ ] **Step 1: Apply the migration**

```sql
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_sender_name text;
begin
  select user_id into v_recipient_id
  from public.conversation_participants
  where conversation_id = new.conversation_id
    and user_id <> new.sender_id
  limit 1;

  if v_recipient_id is null then
    return new;
  end if;

  -- No blocked_users check needed here: the messages_insert_participant_not_blocked
  -- RLS policy (Task 1) already prevents this insert from happening at all
  -- when either party has blocked the other, so this trigger only ever
  -- fires for allowed sends.
  select display_name into v_sender_name
  from public.profiles
  where id = new.sender_id;

  -- Generic body, not the message content — this app doesn't do E2E
  -- encryption (see the design spec), but there's still no reason to route
  -- message text through Expo's/Apple's push infrastructure unnecessarily.
  perform public.send_expo_push(
    v_recipient_id,
    'New message',
    coalesce(v_sender_name, 'Someone') || ' sent you a message',
    jsonb_build_object('conversationId', new.conversation_id)
  );

  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.notify_new_message();
```

- [ ] **Step 2: Verify**

- `execute_sql`: `select tgname from pg_trigger where tgrelid = 'public.messages'::regclass;` — confirm `on_message_created` exists.
- `get_advisors` (type `security`) — confirm clean (this function is `SECURITY DEFINER` and calls another `SECURITY DEFINER` function; same shape as the existing `notify_drop_reply`/`notify_drop_tag` triggers from Phase 6, so it should pass the same checks those did).
- Full delivery proof happens once Task 10 sends a real message from the app — at that point, check `select * from net._http_response order by created desc limit 5;` for a queued request to `exp.host`, the exact technique CLAUDE.md documents Phase 6 having used to prove push delivery at the schema level without a physical device.

- [ ] **Step 3: Commit**

Nothing to commit. Proceed to Task 4.

---

## Task 4: Private `message-media` storage bucket

**Files:**
- No files — Supabase migration via MCP `apply_migration` (name: `phase8_message_media_bucket`).

**Interfaces:**
- Consumes: `public.is_conversation_participant` (Task 1).
- Produces: private Storage bucket `message-media`, path format `{conversation_id}/{message_id}.<ext>`.

- [ ] **Step 1: Apply the migration**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime']
);

-- Unlike every other bucket in this app (drop-media, avatars, dish-photos —
-- all public-read), DM media must stay private to the two participants.
-- This is this app's first private bucket: reads go through
-- storage.createSignedUrl() client-side (Task 5), not a stored public URL.
create policy "message_media_select_participant" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-media'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "message_media_insert_participant" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-media'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid, auth.uid())
  );
```

- [ ] **Step 2: Verify**

- `execute_sql`: `select id, public, file_size_limit from storage.buckets where id = 'message-media';` — confirm `public = false`.
- `execute_sql`: `select policyname from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname like 'message_media%';` — confirm both policies exist.
- `get_advisors` — confirm clean.

- [ ] **Step 3: Commit**

Nothing to commit. Proceed to Task 5.

---

## Task 5: `lib/messages.ts` — core conversation/message functions

**Files:**
- Create: `lib/messages.ts`

**Interfaces:**
- Consumes: `supabase` client from `./supabase`; DB objects from Tasks 1–4.
- Produces (for later tasks): types `MessageParticipant`, `Conversation`, `Message`; functions `fetchConversations(): Promise<Conversation[]>`, `fetchConversation(conversationId: string): Promise<Conversation | null>`, `fetchUnreadCount(): Promise<number>`, `getOrCreateDirectConversation(otherUserId: string): Promise<string>`, `fetchMessages(conversationId: string): Promise<Message[]>`, `sendMessage(conversationId: string, senderId: string, body: string): Promise<Message>`, `markConversationRead(conversationId: string, userId: string): Promise<void>`, `deleteMessage(messageId: string): Promise<void>`, `blockUser(blockerId: string, blockedId: string): Promise<void>`.

- [ ] **Step 1: Write `lib/messages.ts`**

```ts
import { supabase } from './supabase';

export type MessageParticipant = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Conversation = {
  id: string;
  other_participant: MessageParticipant;
  last_message: {
    body: string | null;
    media_type: 'image' | 'video' | null;
    created_at: string;
  } | null;
  unread: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  /** Resolved client-side from media_path via a signed URL — never stored. */
  media_url?: string;
  created_at: string;
};

type FetchConversationsRow = {
  conversation_id: string;
  other_user_id: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_media_type: string | null;
  last_message_at: string | null;
  last_read_at: string | null;
};

function toConversation(row: FetchConversationsRow): Conversation {
  return {
    id: row.conversation_id,
    other_participant: {
      id: row.other_user_id,
      display_name: row.other_display_name,
      avatar_url: row.other_avatar_url,
    },
    last_message: row.last_message_at
      ? {
          body: row.last_message_body,
          media_type: row.last_message_media_type as 'image' | 'video' | null,
          created_at: row.last_message_at,
        }
      : null,
    unread:
      row.last_message_at != null && (row.last_read_at == null || row.last_message_at > row.last_read_at),
  };
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('fetch_conversations');
  if (error) throw error;
  return ((data ?? []) as FetchConversationsRow[]).map(toConversation);
}

/** Used by the thread screen for its header (other participant's name/avatar)
 *  and as the block-action target. Reuses fetch_conversations rather than a
 *  second RPC or a PostgREST embed keyed to an assumed FK constraint name. */
export async function fetchConversation(conversationId: string): Promise<Conversation | null> {
  const conversations = await fetchConversations();
  return conversations.find((c) => c.id === conversationId) ?? null;
}

export async function fetchUnreadCount(): Promise<number> {
  const conversations = await fetchConversations();
  return conversations.filter((c) => c.unread).length;
}

export async function getOrCreateDirectConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    other_user_id: otherUserId,
  });

  if (error) throw error;
  return data as string;
}

async function resolveMessageMediaUrls(messages: Message[]): Promise<Message[]> {
  const paths = messages.map((m) => m.media_path).filter((path): path is string => !!path);
  if (paths.length === 0) return messages;

  const { data, error } = await supabase.storage.from('message-media').createSignedUrls(paths, 3600);
  if (error) throw error;

  const urlByPath = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return messages.map((m) => (m.media_path ? { ...m, media_url: urlByPath.get(m.media_path) } : m));
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;
  return resolveMessageMediaUrls((data ?? []) as Message[]);
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select('*')
    .single();

  if (error) throw error;
  return data as Message;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', messageId);
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx eslint lib/messages.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/messages.ts
git commit -m "Add core messages data layer (conversations, send, read state, block)"
```

---

## Task 6: `lib/messages.ts` — media send

**Files:**
- Modify: `lib/queries.ts` (export `EXTENSION_BY_MIME_TYPE`)
- Modify: `lib/messages.ts` (add `sendMessageMedia`)

**Interfaces:**
- Consumes: `PickedMedia` type and `EXTENSION_BY_MIME_TYPE` map from `lib/queries.ts`; `Message` type and `resolveMessageMediaUrls` (module-private) from Task 5.
- Produces: `sendMessageMedia(conversationId: string, senderId: string, media: PickedMedia): Promise<Message>`.

- [ ] **Step 1: Export the mime-type map from `lib/queries.ts`**

In `lib/queries.ts`, find:

```ts
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
```

Change to:

```ts
export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
```

(Purely additive — every existing use inside `queries.ts` is unaffected.)

- [ ] **Step 2: Add `sendMessageMedia` to `lib/messages.ts`**

Add the import at the top of `lib/messages.ts`:

```ts
import { EXTENSION_BY_MIME_TYPE, type PickedMedia } from './queries';
```

Add this function (after `sendMessage`):

```ts
/** Creates the message row first (to get a real id), uploads to
 *  `message-media/{conversation_id}/{message_id}.<ext>` keyed to that id,
 *  then updates the row with the path — same insert-then-upload ordering
 *  Phase 5 used for drop media. */
export async function sendMessageMedia(
  conversationId: string,
  senderId: string,
  media: PickedMedia
): Promise<Message> {
  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, media_type: media.mediaType })
    .select('*')
    .single();

  if (insertError) throw insertError;
  const message = inserted as Message;

  const ext = EXTENSION_BY_MIME_TYPE[media.mimeType] ?? 'bin';
  const path = `${conversationId}/${message.id}.${ext}`;
  const arraybuffer = await fetch(media.uri).then((res) => res.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('message-media')
    .upload(path, arraybuffer, { contentType: media.mimeType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: updated, error: updateError } = await supabase
    .from('messages')
    .update({ media_path: path })
    .eq('id', message.id)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const [withUrl] = await resolveMessageMediaUrls([updated as Message]);
  return withUrl;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx eslint lib/queries.ts lib/messages.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/queries.ts lib/messages.ts
git commit -m "Add media send to the messages data layer"
```

---

## Task 7: `hooks/use-messages-realtime.ts`

**Files:**
- Create: `hooks/use-messages-realtime.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`; `Message` type from `@/lib/messages` (Task 5).
- Produces: `useMessagesRealtime(conversationId: string, onInsert: (message: Message) => void): void`.

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/messages';

/**
 * Subscribes to new inserts on `messages` for one conversation while the
 * thread screen is mounted. Scoped narrowly on purpose — per the DM design
 * spec's "real-time inside an open thread" decision, the inbox list and the
 * tab-header unread badge refresh on focus instead of staying subscribed;
 * five simultaneous background subscriptions for a badge that's at most one
 * tab-switch stale isn't worth the lifecycle complexity.
 *
 * The ref indirection means callers can pass an inline callback every
 * render without tearing down and recreating the channel subscription.
 */
export function useMessagesRealtime(conversationId: string, onInsert: (message: Message) => void) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onInsertRef.current(payload.new as Message)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx eslint hooks/use-messages-realtime.ts`
Expected: clean.

Behavioral verification (does a message sent from a second account actually arrive live) is deferred to the manual two-simulator check at the end of Task 13 — not testable in isolation.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-messages-realtime.ts
git commit -m "Add real-time subscription hook for an open message thread"
```

---

## Task 8: `app/messages/index.tsx` — inbox

**Files:**
- Create: `app/messages/index.tsx`
- Modify: `app/_layout.tsx` (register the route)

**Interfaces:**
- Consumes: `fetchConversations`, `type Conversation` from `@/lib/messages` (Task 5); `ScreenContainer`, `PageHeader`, `Card`, `Avatar`, `Button` from `components/ui/`.
- Produces: route `/messages` (file `messages/index`).

- [ ] **Step 1: Write `app/messages/index.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchConversations, type Conversation } from '@/lib/messages';

export default function MessagesInboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchConversations()
        .then(setConversations)
        .finally(() => setLoading(false));
    }, [])
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
        data={conversations}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <PageHeader eyebrow="Messages" title="Your conversations" />
            </View>
            <Button label="New" variant="secondary" inline onPress={() => router.push('/messages/new')} />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No conversations yet — tap &quot;New&quot; to message someone.</Text>
        }
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
      />
    </ScreenContainer>
  );
}

function previewText(conversation: Conversation): string {
  const message = conversation.last_message;
  if (!message) return 'Say hello';
  if (message.body) return message.body;
  if (message.media_type === 'video') return 'Sent a video';
  if (message.media_type === 'image') return 'Sent a photo';
  return '';
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: { flex: 1 },
  card: { marginBottom: spacing.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.raspberry },
  preview: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.inkSoft },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`**

In the `Stack.Protected guard={isLoggedIn && !needsOnboarding}` block, add (alongside the other pushed screens, e.g. right after `<Stack.Screen name="events" options={pushedScreenOptions} />`):

```tsx
<Stack.Screen name="messages/index" options={pushedScreenOptions} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx eslint app/messages/index.tsx app/_layout.tsx`
Expected: clean.

Manual: `npx expo start`, sign in on Simulator, confirm `router.push('/messages')` from a temporary test link (or just navigate via the URL bar in Expo dev tools) renders the inbox with an empty state.

- [ ] **Step 4: Commit**

```bash
git add app/messages/index.tsx app/_layout.tsx
git commit -m "Add messages inbox screen"
```

---

## Task 9: `app/messages/new.tsx` — start a new conversation

**Files:**
- Create: `app/messages/new.tsx`
- Modify: `app/_layout.tsx` (register the route)

**Interfaces:**
- Consumes: `searchProfiles`, `type ProfileSearchResult` from `@/lib/queries` (existing); `getOrCreateDirectConversation` from `@/lib/messages` (Task 5).
- Produces: route `/messages/new`.

- [ ] **Step 1: Write `app/messages/new.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { searchProfiles, type ProfileSearchResult } from '@/lib/queries';
import { getOrCreateDirectConversation } from '@/lib/messages';

export default function NewMessageScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const selfId = profile?.id ?? session?.user?.id ?? '';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() || !selfId) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      searchProfiles(query, selfId).then(setResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selfId]);

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

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <PageHeader eyebrow="New message" title="Who's the lore for?" />
            <TextField
              placeholder="Search people by name"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
          </>
        }
        ListEmptyComponent={query.trim() ? <Text style={styles.empty}>No one matches that name.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item.id)} disabled={startingId === item.id}>
            <Avatar uri={item.avatar_url} name={item.display_name} size={44} />
            <Text style={styles.name}>{item.display_name ?? 'Someone'}</Text>
            {startingId === item.id && <ActivityIndicator color={colors.raspberry} style={styles.spinner} />}
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  search: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  name: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },
  spinner: { marginLeft: spacing.sm },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`**

Add, right after `<Stack.Screen name="messages/index" options={pushedScreenOptions} />`:

```tsx
<Stack.Screen name="messages/new" options={pushedScreenOptions} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no new errors.
Run: `npx eslint app/messages/new.tsx app/_layout.tsx` — expected: clean.

Manual: from the inbox's "New" button, search an existing seed profile name (e.g. "sree", per CLAUDE.md's Maestro seed data), tap the result, confirm it navigates into a (currently 404 until Task 10 lands — expected at this point) thread route.

- [ ] **Step 4: Commit**

```bash
git add "app/messages/new.tsx" app/_layout.tsx
git commit -m "Add new-message search screen"
```

---

## Task 10: `app/messages/[conversationId].tsx` — thread (text, read state, block, delete)

**Files:**
- Create: `app/messages/[conversationId].tsx`
- Modify: `app/_layout.tsx` (register the route)

**Interfaces:**
- Consumes: `fetchConversation`, `fetchMessages`, `sendMessage`, `markConversationRead`, `deleteMessage`, `blockUser`, `type Conversation`, `type Message` from `@/lib/messages` (Task 5); `useMessagesRealtime` from `@/hooks/use-messages-realtime` (Task 7).
- Produces: route `/messages/[conversationId]`; the `MessageBubble` sub-component and bubble styles that Task 11 extends with media rendering.

- [ ] **Step 1: Write `app/messages/[conversationId].tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TextField } from '@/components/ui/TextField';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useMessagesRealtime } from '@/hooks/use-messages-realtime';
import {
  blockUser,
  deleteMessage,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  type Conversation,
  type Message,
} from '@/lib/messages';

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const selfId = profile?.id ?? session?.user?.id ?? '';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const seenIds = useRef(new Set<string>());
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const [conversationData, messageData] = await Promise.all([
      fetchConversation(conversationId),
      fetchMessages(conversationId),
    ]);
    setConversation(conversationData);
    messageData.forEach((m) => seenIds.current.add(m.id));
    setMessages(messageData);
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
      if (conversationId && selfId) {
        markConversationRead(conversationId, selfId).catch((error) =>
          console.log('Failed to mark conversation read:', error)
        );
      }
    }, [load, conversationId, selfId])
  );

  // Fallback for realtime silently dropping during backgrounding: when the
  // app returns to the foreground, refetch rather than trust the socket
  // reconnected cleanly. Cheap (one query) and avoids a thread that looks
  // caught up but silently isn't.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => subscription.remove();
  }, [load]);

  useMessagesRealtime(conversationId ?? '', (incoming) => {
    if (seenIds.current.has(incoming.id)) return;
    seenIds.current.add(incoming.id);
    setMessages((prev) => [...prev, incoming]);
    if (conversationId && selfId) {
      markConversationRead(conversationId, selfId).catch(() => {});
    }
  });

  async function onSend() {
    const body = draft.trim();
    if (!body || !conversationId || !selfId || sending) return;
    setSending(true);
    setDraft('');
    try {
      const sent = await sendMessage(conversationId, selfId, body);
      seenIds.current.add(sent.id);
      setMessages((prev) => [...prev, sent]);
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Something went wrong.');
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

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

  function onBlock() {
    if (!conversation || !selfId) return;
    Alert.alert(
      `Block ${conversation.other_participant.display_name ?? 'this person'}?`,
      "They won't be able to message you again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(selfId, conversation.other_participant.id);
              router.back();
            } catch (error) {
              Alert.alert('Could not block', error instanceof Error ? error.message : 'Something went wrong.');
            }
          },
        },
      ]
    );
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Avatar
            uri={conversation?.other_participant.avatar_url}
            name={conversation?.other_participant.display_name}
            size={36}
          />
          <Text style={styles.headerName}>{conversation?.other_participant.display_name ?? 'Someone'}</Text>
          <Pressable onPress={onBlock} hitSlop={8}>
            <Text style={styles.blockLink}>Block</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isSelf={item.sender_id === selfId}
              onLongPress={() => onLongPressMessage(item)}
            />
          )}
        />

        <View style={styles.composer}>
          <TextField
            containerStyle={styles.composerField}
            placeholder="Write a message…"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable onPress={onSend} disabled={sending || !draft.trim()} style={styles.sendButton}>
            <Text style={styles.sendLabel}>{sending ? '…' : 'Send'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export function MessageBubble({
  message,
  isSelf,
  onLongPress,
}: {
  message: Message;
  isSelf: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowOther]}
    >
      <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
        {message.body && <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>{message.body}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  headerName: { flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.ink },
  blockLink: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.danger },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowSelf: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  bubbleSelf: { backgroundColor: colors.raspberry },
  bubbleOther: { backgroundColor: colors.paper },
  bubbleText: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: colors.ink },
  bubbleTextSelf: { color: colors.paper },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  composerField: { flex: 1 },
  sendButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.ink,
    justifyContent: 'center',
  },
  sendLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.base, color: colors.cream },
});
```

Note on a deliberate simplification vs. the design spec's exact wording: rather than an optimistic temp-id append + realtime-reconciliation, `onSend` awaits the real inserted row before appending it. Supabase inserts are fast enough locally that this doesn't read as laggy, and it avoids temp-id bookkeeping entirely. The `seenIds` ref-based dedup is still required regardless (for the realtime echo of your own sent message), so it's implemented either way.

- [ ] **Step 2: Register the route in `app/_layout.tsx`**

Add, right after `<Stack.Screen name="messages/new" options={pushedScreenOptions} />`:

```tsx
<Stack.Screen name="messages/[conversationId]" options={pushedScreenOptions} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no new errors.
Run: `npx eslint "app/messages/[conversationId].tsx" app/_layout.tsx` — expected: clean.

Manual: complete the Task 9 flow (search → select → land in thread), send a text message, confirm it appears in the bubble list and the composer clears. Long-press it, confirm the delete confirm dialog appears and removing it works. Tap "Block", confirm the dialog appears and confirms navigate back to the inbox on success.

Push delivery check: after sending, run (via Supabase MCP `execute_sql`): `select * from net._http_response order by created desc limit 3;` — confirm a request to `exp.host` was queued (same technique Phase 6 used; this doesn't require a physical device to prove the trigger fired).

- [ ] **Step 4: Commit**

```bash
git add "app/messages/[conversationId].tsx" app/_layout.tsx
git commit -m "Add message thread screen: send, receive, read state, block, delete"
```

---

## Task 11: Thread media — attach, send, render

**Files:**
- Modify: `app/messages/[conversationId].tsx`

**Interfaces:**
- Consumes: `sendMessageMedia` from `@/lib/messages` (Task 6); `MediaStrip` from `@/components/ui/MediaStrip` (existing, Phase 5); `ImagePicker` from `expo-image-picker` (existing dependency).
- Produces: nothing new for later tasks — this is the final piece of the thread screen.

- [ ] **Step 1: Add imports**

In `app/messages/[conversationId].tsx`, add to the imports:

```tsx
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { MediaStrip } from '@/components/ui/MediaStrip';
```

and extend the existing `@/lib/messages` import to add `sendMessageMedia`:

```tsx
import {
  blockUser,
  deleteMessage,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  sendMessageMedia,
  type Conversation,
  type Message,
} from '@/lib/messages';
```

- [ ] **Step 2: Add media-sending state and handler**

Inside `ConversationScreen`, add state next to the existing `sending` state:

```tsx
const [sendingMedia, setSendingMedia] = useState(false);
```

Add this function next to `onSend`:

```tsx
async function onPickMedia() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access needed', 'Allow photo library access in Settings to attach media.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.7,
    videoMaxDuration: 60,
  });

  if (result.canceled || !conversationId || !selfId) return;

  const asset = result.assets[0];
  setSendingMedia(true);
  try {
    const sent = await sendMessageMedia(conversationId, selfId, {
      uri: asset.uri,
      mediaType: asset.type === 'video' ? 'video' : 'image',
      mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
    seenIds.current.add(sent.id);
    setMessages((prev) => [...prev, sent]);
  } catch (error) {
    Alert.alert('Could not send', error instanceof Error ? error.message : 'Something went wrong.');
  } finally {
    setSendingMedia(false);
  }
}
```

- [ ] **Step 3: Add the attach button to the composer**

In the `composer` `View`, add a Pressable before the `TextField` — replace:

```tsx
        <View style={styles.composer}>
          <TextField
            containerStyle={styles.composerField}
            placeholder="Write a message…"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
```

with:

```tsx
        <View style={styles.composer}>
          <Pressable onPress={onPickMedia} disabled={sendingMedia} style={styles.attachButton}>
            {sendingMedia ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.ink} />
            )}
          </Pressable>
          <TextField
            containerStyle={styles.composerField}
            placeholder="Write a message…"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
```

Add to the `StyleSheet.create` block:

```tsx
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 4: Render media in the bubble**

Replace the `MessageBubble` function body:

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
  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowOther]}
    >
      <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
        {message.media_url && (
          <MediaStrip media={[{ id: message.id, media_type: message.media_type ?? 'image', url: message.media_url }]} />
        )}
        {message.body && <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>{message.body}</Text>}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no new errors.
Run: `npx eslint "app/messages/[conversationId].tsx"` — expected: clean.

Manual (native picker sheets aren't automatable — same limitation as Phase 5/7's media pickers): seed a test photo into the Simulator via `xcrun simctl addmedia <udid> <path>` (a solid-color test image, not a screenshot of this app's own UI — see CLAUDE.md's Live-Text gotcha), tap the attach button, pick it, confirm it uploads and renders in the thread as a bubble with an image.

- [ ] **Step 6: Commit**

```bash
git add "app/messages/[conversationId].tsx"
git commit -m "Add photo/video attachments to message threads"
```

---

## Task 12: `MessagesIcon` entry point on every tab + push deep link

**Files:**
- Create: `components/ui/MessagesIcon.tsx`
- Modify: `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/(tabs)/post.tsx`, `app/(tabs)/passport.tsx`, `app/(tabs)/profile.tsx`
- Modify: `hooks/use-push-notifications.ts`

**Interfaces:**
- Consumes: `fetchUnreadCount` from `@/lib/messages` (Task 5); `useAuthContext` (existing).
- Produces: `<MessagesIcon />` component, no props.

- [ ] **Step 1: Write `components/ui/MessagesIcon.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchUnreadCount } from '@/lib/messages';

/** Paper-plane entry point into the DM inbox, with an unread-count badge.
 *  Dropped into the header row of every tab screen. Refreshes its count on
 *  tab focus rather than staying subscribed — see the DM design spec's
 *  "real-time inside an open thread" decision. */
export function MessagesIcon() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const userId = profile?.id ?? session?.user?.id;
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchUnreadCount()
        .then(setUnreadCount)
        .catch((error) => console.log('Failed to refresh unread count:', error));
    }, [userId])
  );

  return (
    <Pressable
      onPress={() => router.push('/messages')}
      hitSlop={8}
      accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
      style={styles.wrap}
    >
      <Ionicons name="paper-plane-outline" size={24} color={colors.ink} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.raspberry,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.cream,
  },
  badgeText: { fontFamily: fontFamily.mono, fontSize: 9, color: colors.paper },
});
```

- [ ] **Step 2: Wire into `app/(tabs)/index.tsx` (Home)**

Add the import:

```tsx
import { MessagesIcon } from '@/components/ui/MessagesIcon';
```

Replace:

```tsx
          <View>
            <Text style={styles.title}>Home</Text>
            <View style={styles.quickLinks}>
```

with:

```tsx
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Home</Text>
              <MessagesIcon />
            </View>
            <View style={styles.quickLinks}>
```

Add to `StyleSheet.create`:

```tsx
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
```

- [ ] **Step 3: Wire into `app/(tabs)/explore.tsx`**

Same pattern. Add the `MessagesIcon` import. Replace:

```tsx
          <View>
            <Text style={styles.title}>Explore</Text>
            <TextField
```

with:

```tsx
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Explore</Text>
              <MessagesIcon />
            </View>
            <TextField
```

Add the same `titleRow` style.

- [ ] **Step 4: Wire into `app/(tabs)/post.tsx`**

Two occurrences here — `PostScreen` conditionally renders `PlacePicker` or `ComposeForm`, and both currently show "Drop lore" as their own title, so both need the icon so it doesn't disappear when a place gets selected.

Add the `MessagesIcon` import once at the top of the file.

In `PlacePicker`, replace:

```tsx
          <View>
            <Text style={styles.title}>Drop lore</Text>
            <Text style={styles.subtitle}>Which café is this about?</Text>
```

with:

```tsx
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Drop lore</Text>
              <MessagesIcon />
            </View>
            <Text style={styles.subtitle}>Which café is this about?</Text>
```

In `ComposeForm`, replace:

```tsx
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Drop lore</Text>
```

with:

```tsx
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.title}>Drop lore</Text>
            <MessagesIcon />
          </View>
```

Add the same `titleRow` style once to `post.tsx`'s `StyleSheet.create`.

- [ ] **Step 5: Wire into `app/(tabs)/passport.tsx`**

Add the `MessagesIcon` import. Replace:

```tsx
            <PageHeader
              eyebrow="Lore Passport"
              title="Your city, one stamp at a time"
              subtitle="Check in at a place from its café page to collect a stamp."
            />
```

with:

```tsx
            <View style={styles.titleRow}>
              <View style={styles.titleRowText}>
                <PageHeader
                  eyebrow="Lore Passport"
                  title="Your city, one stamp at a time"
                  subtitle="Check in at a place from its café page to collect a stamp."
                />
              </View>
              <MessagesIcon />
            </View>
```

Add to `StyleSheet.create`:

```tsx
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleRowText: { flex: 1 },
```

- [ ] **Step 6: Wire into `app/(tabs)/profile.tsx`**

Add the `MessagesIcon` import. Replace:

```tsx
      <Text style={styles.title}>Profile</Text>
```

with:

```tsx
      <View style={styles.titleRow}>
        <Text style={styles.title}>Profile</Text>
        <MessagesIcon />
      </View>
```

Add the same `titleRow` style (`flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'`) to `profile.tsx`'s `StyleSheet.create`.

- [ ] **Step 7: Extend the push notification tap handler**

In `hooks/use-push-notifications.ts`, replace:

```ts
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { placeId?: string } | undefined;
      if (data?.placeId) {
        router.push(`/place/${data.placeId}`);
      }
    });
    return () => subscription.remove();
  }, [router]);
```

with:

```ts
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { placeId?: string; conversationId?: string }
        | undefined;
      if (data?.conversationId) {
        router.push(`/messages/${data.conversationId}`);
      } else if (data?.placeId) {
        router.push(`/place/${data.placeId}`);
      }
    });
    return () => subscription.remove();
  }, [router]);
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` — expected: no new errors.
Run: `npx eslint . --ext .ts,.tsx` — expected: clean, project-wide.

Manual: relaunch the app, confirm the paper-plane icon renders on all five tabs' headers, tapping it from any tab opens the inbox. Send yourself a test push via the existing `net._http_response`/Expo push tooling (or trust the Task 10 manual check already covered delivery) and confirm tapping a delivered notification while backgrounded deep-links into the right thread.

- [ ] **Step 9: Commit**

```bash
git add components/ui/MessagesIcon.tsx "app/(tabs)/index.tsx" "app/(tabs)/explore.tsx" "app/(tabs)/post.tsx" "app/(tabs)/passport.tsx" "app/(tabs)/profile.tsx" hooks/use-push-notifications.ts
git commit -m "Add messages entry icon to every tab and wire push deep link"
```

---

## Task 13: Maestro flow + phase wrap-up

**Files:**
- Create: `maestro/phase8-messages.yaml`

**Interfaces:**
- Consumes: the fully working feature from Tasks 1–12.
- Produces: nothing for later tasks — this is the closing task of the phase.

- [ ] **Step 1: Write the Maestro flow**

```yaml
appId: com.reddyscb.lore
---
# Covers the single-account path for Phase 8 (DMs): open the inbox, start a
# new conversation via search, send a text message, see it in the thread,
# back out and see it listed in the inbox.
#
# Real two-account delivery, live realtime receipt, and push notification
# receipt are the same category of limitation Phase 6 hit with push — they
# need manual verification (two simulators, or a simulator + a physical
# device), not an automated flow. See CLAUDE.md's Regression testing section.
#
# Assumes seed data: a profile named "sree" (reused from the Phase 3 tagging
# flow's seed data). Assumes a signed-in session already exists in the
# simulator, under a *different* account than "sree" (can't message
# yourself — see get_or_create_direct_conversation's guard).
- stopApp
- launchApp
- extendedWaitUntil:
    visible: "Home"
    timeout: 15000

- tapOn: ".*Messages.*"
- extendedWaitUntil:
    visible: "Your conversations"
    timeout: 8000
- tapOn: "New"
- tapOn: "Search people by name"
- inputText: "sree"
- extendedWaitUntil:
    visible: ".*sree.*"
    timeout: 8000
- tapOn: ".*sree.*"
- extendedWaitUntil:
    visible: "Write a message…"
    timeout: 8000
- tapOn: "Write a message…"
- inputText: "Maestro regression message"
- tapOn: "Send"
- assertVisible: "Maestro regression message"
# Dismiss the keyboard via a tap on inert text (not "Back") before
# navigating — a multiline field's Enter key inserts a newline instead of
# blurring, and tapping a distant element with the keyboard still up has
# previously misfired in this app's Maestro suite. See CLAUDE.md.
- tapOn: ".*sree.*"
- tapOn: "Back"
- assertVisible: ".*Maestro regression message.*"
```

- [ ] **Step 2: Run the full verification pass**

Run: `npx tsc --noEmit`
Expected: clean, project-wide.

Run: `npx eslint . --ext .ts,.tsx`
Expected: clean, project-wide.

Run: `npm run test:e2e`
Expected: all flows green, including the new `phase8-messages.yaml`.

- [ ] **Step 3: Commit the Maestro flow**

```bash
git add maestro/phase8-messages.yaml
git commit -m "Add Phase 8 Maestro flow for the single-account messaging path"
```

- [ ] **Step 4: Phase wrap-up**

Invoke the `phase-wrapup` project skill. It will re-run the full verification pass, update CLAUDE.md's Phase plan with a Phase 8 entry (mirroring the level of detail every prior phase entry has), and hand back a manual test checklist. That checklist should explicitly include everything this plan flagged as non-automatable:
- Two-account live delivery and realtime receipt (two simulators, or a simulator + a physical device)
- Push notification receipt on a physical device (Simulator cannot obtain a real push token — same limitation as Phase 6)
- Actually picking a photo/video in the thread composer (native picker sheet, seed test media via `xcrun simctl addmedia` first — not a screenshot of this app's own UI, per the existing Live Text gotcha)
- Blocking a user from one account and confirming the other account's send attempt is rejected

---

## Self-review notes (for whoever executes this plan)

- **Spec coverage**: every section of `docs/superpowers/specs/2026-08-06-dm-feature-design.md` maps to a task above — data model → Tasks 1–4, screens → Tasks 8–11, entry point → Task 12, error handling → the try/catch+Alert.alert pattern used throughout Tasks 8–11 plus the `AppState` refetch fallback added in Task 10, testing → Task 13. Explicitly-out-of-scope items (groups, message requests, visible read receipts, typing indicators, editing, custom E2E) are not built anywhere in this plan — confirmed absent by design, not by omission.
- **One intentional deviation from the spec's exact wording**: Task 10 sends-then-appends the real row rather than doing a temp-id optimistic append + realtime reconciliation. Noted inline in Task 10 with rationale (Supabase inserts are fast enough locally; avoids temp-id bookkeeping). The `seenIds` dedup the spec anticipated is still present, just serving a slightly different purpose (dedup against your own realtime echo, not against a temp id).
- **Type/name consistency checked**: `Message`, `Conversation`, `MessageParticipant` and every function name (`fetchConversations`, `fetchConversation`, `fetchUnreadCount`, `getOrCreateDirectConversation`, `fetchMessages`, `sendMessage`, `sendMessageMedia`, `markConversationRead`, `deleteMessage`, `blockUser`) are used identically everywhere they're imported across Tasks 5–12. RPC names and parameter names (`fetch_conversations`, `get_or_create_direct_conversation(other_user_id)`) match between the SQL (Tasks 1–2) and the `.rpc()` calls (Task 5) exactly.
