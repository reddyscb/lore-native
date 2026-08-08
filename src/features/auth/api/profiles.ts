import { supabase } from '@/shared/supabase/supabase';
import { EXTENSION_BY_MIME_TYPE, uploadFile, type PickedMedia } from '@/shared/api/media';

export type ProfileSearchResult = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function searchProfiles(
  query: string,
  excludeId: string
): Promise<ProfileSearchResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .ilike('display_name', `%${query}%`)
    .neq('id', excludeId)
    .limit(10);

  if (error) throw error;
  return (data ?? []) as ProfileSearchResult[];
}

/**
 * Uploads to a fixed `{user_id}/avatar.<ext>` path (so re-uploading replaces
 * the old file via `upsert`) and writes the public URL onto the profile.
 * A cache-busting query param is appended since the URL would otherwise stay
 * identical across re-uploads, leaving `expo-image` showing the stale photo.
 */
export async function updateAvatar(userId: string, media: PickedMedia): Promise<string> {
  const ext = EXTENSION_BY_MIME_TYPE[media.mimeType] ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const url = await uploadFile('avatars', path, media.uri, media.mimeType);
  const bustedUrl = `${url}?updated=${Date.now()}`;

  const { error } = await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', userId);
  if (error) throw error;

  return bustedUrl;
}
