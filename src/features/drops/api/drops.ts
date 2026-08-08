import { supabase } from '@/shared/supabase/supabase';
import { EXTENSION_BY_MIME_TYPE, uploadFile, type PickedMedia } from '@/shared/api/media';

export type Profile = {
  display_name: string | null;
  avatar_url: string | null;
};

export type DropReply = {
  id: string;
  body: string;
  created_at: string;
  profiles: Profile | null;
};

export type DropMedia = {
  id: string;
  media_type: 'image' | 'video';
  url: string;
  position: number;
};

export type Drop = {
  id: string;
  place_id: string;
  must_order: string | null;
  skip_note: string | null;
  sweet_spot: string | null;
  damage: number | null;
  vibe_check: string | null;
  plot_twist: string | null;
  secret_lore: string | null;
  created_at: string;
  profiles: Profile | null;
  places?: { name: string; area: string | null; status: string; cover_color: string | null };
  drop_replies?: DropReply[];
  drop_tags?: { profiles: Profile }[];
  drop_media?: DropMedia[];
};

const DROP_AUTHOR = 'profiles!drops_author_id_fkey(display_name, avatar_url)';
const REPLY_AUTHOR = 'profiles!drop_replies_author_id_fkey(display_name, avatar_url)';
const DROP_TAGS = 'drop_tags(profiles!drop_tags_tagged_profile_id_fkey(display_name, avatar_url))';
const DROP_MEDIA = 'drop_media(id, media_type, url, position)';

function sortDropMedia(drops: Drop[]): Drop[] {
  for (const drop of drops) {
    drop.drop_media?.sort((a, b) => a.position - b.position);
  }
  return drops;
}

export async function fetchDropFeed(): Promise<Drop[]> {
  const { data, error } = await supabase
    .from('drops')
    .select(`*, places(name, area, status, cover_color), ${DROP_AUTHOR}, ${DROP_TAGS}, ${DROP_MEDIA}`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return sortDropMedia((data ?? []) as unknown as Drop[]);
}

export async function fetchPlaceDrops(placeId: string): Promise<Drop[]> {
  const { data, error } = await supabase
    .from('drops')
    .select(`*, ${DROP_AUTHOR}, drop_replies(*, ${REPLY_AUTHOR}), ${DROP_TAGS}, ${DROP_MEDIA}`)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return sortDropMedia((data ?? []) as unknown as Drop[]);
}

export type NewDropInput = {
  place_id: string;
  author_id: string;
  must_order?: string;
  skip_note?: string;
  sweet_spot?: string;
  damage?: number;
  vibe_check?: string;
  plot_twist?: string;
  secret_lore?: string;
};

export async function createDrop(input: NewDropInput): Promise<{ id: string }> {
  const { data, error } = await supabase.from('drops').insert(input).select('id').single();

  if (error) throw error;
  return data as { id: string };
}

export async function tagProfilesOnDrop(dropId: string, profileIds: string[]): Promise<void> {
  if (profileIds.length === 0) return;

  const { error } = await supabase
    .from('drop_tags')
    .insert(profileIds.map((tagged_profile_id) => ({ drop_id: dropId, tagged_profile_id })));

  if (error) throw error;
}

/** Uploads each picked file to the `drop-media` bucket and links it to the drop. */
export async function uploadDropMedia(dropId: string, media: PickedMedia[]): Promise<void> {
  if (media.length === 0) return;

  const rows = await Promise.all(
    media.map(async (item, index) => {
      const ext = EXTENSION_BY_MIME_TYPE[item.mimeType] ?? 'bin';
      const path = `${dropId}/${index}-${Date.now()}.${ext}`;
      const url = await uploadFile('drop-media', path, item.uri, item.mimeType);
      return { drop_id: dropId, media_type: item.mediaType, url, position: index };
    })
  );

  const { error } = await supabase.from('drop_media').insert(rows);
  if (error) throw error;
}

export async function createReply(
  dropId: string,
  authorId: string,
  body: string
): Promise<DropReply> {
  const { data, error } = await supabase
    .from('drop_replies')
    .insert({ drop_id: dropId, author_id: authorId, body })
    .select(`*, ${REPLY_AUTHOR}`)
    .single();

  if (error) throw error;
  return data as unknown as DropReply;
}
