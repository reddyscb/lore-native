import { supabase } from '@/shared/supabase/supabase';
import { EXTENSION_BY_MIME_TYPE, uploadFile, type PickedMedia } from '@/shared/api/media';
import type { Place, Dish, PlaceSummary } from '@/features/places/api/places';

export async function fetchUnclaimedPlaces(): Promise<PlaceSummary[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, area, price_range, tagline, status, cover_color')
    .is('owner_id', null)
    .order('name')
    .limit(200);

  if (error) throw error;
  return (data ?? []) as PlaceSummary[];
}

/**
 * Becoming an owner (flipping `profiles.role`) must happen before the claim
 * update, since the "an owner can claim an unclaimed place" RLS policy's
 * `WITH CHECK` requires `profiles.role = 'owner'` to already be true — same
 * two-step order the web app's `claimPlace` server action uses.
 */
export async function claimPlace(userId: string, placeId: string): Promise<void> {
  const { error: roleError } = await supabase
    .from('profiles')
    .update({ role: 'owner' })
    .eq('id', userId);
  if (roleError) throw roleError;

  const { data, error: claimError } = await supabase
    .from('places')
    .update({ owner_id: userId })
    .eq('id', placeId)
    .is('owner_id', null)
    .select('id');
  if (claimError) throw claimError;
  if (!data || data.length === 0) {
    throw new Error('This place was just claimed by someone else');
  }
}

export async function fetchOwnedPlaces(
  ownerId: string
): Promise<(Place & { dishes: Dish[] })[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*, dishes(*)')
    .eq('owner_id', ownerId)
    .order('created_at')
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as (Place & { dishes: Dish[] })[];
}

export async function updatePlaceStatus(
  placeId: string,
  status: string,
  reopenDate: string | null
): Promise<void> {
  const { data, error } = await supabase
    .from('places')
    .update({ status, reopen_date: status === 'temp-closed' ? reopenDate : null })
    .eq('id', placeId)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Could not update this place — it may no longer be yours.');
  }
}

export async function updatePlaceTagline(placeId: string, tagline: string | null): Promise<void> {
  const { data, error } = await supabase.from('places').update({ tagline }).eq('id', placeId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Could not save — this place may no longer be yours.');
  }
}

export type NewDishInput = {
  name: string;
  tag?: string | null;
  rating?: number | null;
};

export type DishUpdateInput = {
  name?: string;
  tag?: string | null;
  rating?: number | null;
};

export async function addDish(placeId: string, fields: NewDishInput): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      place_id: placeId,
      name: fields.name,
      tag: fields.tag ?? null,
      rating: fields.rating ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Dish;
}

export async function updateDish(dishId: string, fields: DishUpdateInput): Promise<void> {
  const { data, error } = await supabase.from('dishes').update(fields).eq('id', dishId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Could not save this dish.');
  }
}

export async function deleteDish(dishId: string): Promise<void> {
  const { data, error } = await supabase.from('dishes').delete().eq('id', dishId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Could not remove this dish.');
  }
}

/**
 * Uploads to a fixed `{place_id}/{dish_id}.<ext>` path (so re-uploading
 * replaces the old file via `upsert`, same as `updateAvatar`) and writes the
 * cache-busted public URL onto the dish.
 */
export async function uploadDishPhoto(
  dishId: string,
  placeId: string,
  media: PickedMedia
): Promise<string> {
  const ext = EXTENSION_BY_MIME_TYPE[media.mimeType] ?? 'jpg';
  const path = `${placeId}/${dishId}.${ext}`;
  const url = await uploadFile('dish-photos', path, media.uri, media.mimeType);
  const bustedUrl = `${url}?updated=${Date.now()}`;

  const { error } = await supabase.from('dishes').update({ photo_url: bustedUrl }).eq('id', dishId);
  if (error) throw error;

  return bustedUrl;
}
