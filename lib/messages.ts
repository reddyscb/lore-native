import { supabase } from './supabase';
import { EXTENSION_BY_MIME_TYPE, type PickedMedia } from './queries';

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
  return messages.map((m) => {
    if (!m.media_path) return m;
    const url = urlByPath.get(m.media_path);
    return url ? { ...m, media_url: url } : m;
  });
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  const chronological = ((data ?? []) as Message[]).reverse();
  return resolveMessageMediaUrls(chronological);
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

  if (uploadError) {
    // Partial failure: clean up the orphaned row so it doesn't appear as a blank message to the other participant.
    try {
      await supabase.from('messages').delete().eq('id', message.id);
    } catch {
      // Best-effort cleanup — ignore failures here, the real error is uploadError below.
    }
    throw uploadError;
  }

  const { data: updated, error: updateError } = await supabase
    .from('messages')
    .update({ media_path: path })
    .eq('id', message.id)
    .select('*')
    .single();

  if (updateError) {
    // Partial failure: clean up the orphaned row so it doesn't appear as a blank message to the other participant.
    try {
      await supabase.from('messages').delete().eq('id', message.id);
    } catch {
      // Best-effort cleanup — ignore failures here, the real error is updateError below.
    }
    throw updateError;
  }

  const [withUrl] = await resolveMessageMediaUrls([updated as Message]);
  return withUrl;
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
