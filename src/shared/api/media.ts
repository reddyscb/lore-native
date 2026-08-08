import { supabase } from '@/shared/supabase/supabase';

export type PickedMedia = {
  uri: string;
  mediaType: 'image' | 'video';
  mimeType: string;
};

export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export async function uploadFile(
  bucket: string,
  path: string,
  uri: string,
  mimeType: string
): Promise<string> {
  const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arraybuffer, { contentType: mimeType, upsert: true });

  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
