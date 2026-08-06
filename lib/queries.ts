import { supabase } from './supabase';

export type Profile = {
  display_name: string | null;
  avatar_url: string | null;
};

export type Place = {
  id: string;
  name: string;
  area: string | null;
  price_range: string | null;
  tagline: string | null;
  go_for: string | null;
  skip_note: string | null;
  secret: string | null;
  status: string;
  reopen_date: string | null;
  cover_color: string | null;
};

export type Dish = {
  id: string;
  name: string;
  tag: string | null;
  rating: number | null;
  photo_url: string | null;
};

export type PlaceSummary = Pick<
  Place,
  'id' | 'name' | 'area' | 'price_range' | 'tagline' | 'status' | 'cover_color'
>;

export type ProfileSearchResult = {
  id: string;
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
  places?: Pick<Place, 'name' | 'area' | 'status' | 'cover_color'>;
  drop_replies?: DropReply[];
  drop_tags?: { profiles: Profile }[];
  drop_media?: DropMedia[];
};

const DROP_AUTHOR = 'profiles!drops_author_id_fkey(display_name, avatar_url)';
const REPLY_AUTHOR = 'profiles!drop_replies_author_id_fkey(display_name, avatar_url)';
const DROP_TAGS = 'drop_tags(profiles!drop_tags_tagged_profile_id_fkey(display_name, avatar_url))';
const DROP_MEDIA = 'drop_media(id, media_type, url, position)';

export async function fetchDropFeed(): Promise<Drop[]> {
  const { data, error } = await supabase
    .from('drops')
    .select(`*, places(name, area, status, cover_color), ${DROP_AUTHOR}, ${DROP_TAGS}, ${DROP_MEDIA}`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return sortDropMedia((data ?? []) as unknown as Drop[]);
}

function sortDropMedia(drops: Drop[]): Drop[] {
  for (const drop of drops) {
    drop.drop_media?.sort((a, b) => a.position - b.position);
  }
  return drops;
}

export async function fetchPlace(id: string): Promise<Place> {
  const { data, error } = await supabase.from('places').select('*').eq('id', id).single();

  if (error) throw error;
  return data as Place;
}

export async function fetchDishes(placeId: string): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('place_id', placeId)
    .order('rating', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as Dish[];
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

export async function searchPlaces(params: {
  query?: string;
  area?: string;
  priceRange?: string;
}): Promise<PlaceSummary[]> {
  let request = supabase
    .from('places')
    .select('id, name, area, price_range, tagline, status, cover_color')
    .order('name');

  if (params.query) request = request.ilike('name', `%${params.query}%`);
  if (params.area) request = request.eq('area', params.area);
  if (params.priceRange) request = request.eq('price_range', params.priceRange);

  const { data, error } = await request.limit(200);
  if (error) throw error;
  return (data ?? []) as PlaceSummary[];
}

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

/* ------------------------------------------------------------------ *
 * Media (drop photos/videos, profile avatars)
 *
 * Both buckets are public-read with owner-scoped write RLS keyed off the
 * storage path's first folder segment — `{drop_id}/...` for drop-media,
 * `{user_id}/...` for avatars. See the `phase5_drop_media_and_avatars`
 * migration for the exact policies.
 * ------------------------------------------------------------------ */

export type PickedMedia = {
  uri: string;
  mediaType: 'image' | 'video';
  mimeType: string;
};

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

async function uploadFile(
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

/* ------------------------------------------------------------------ *
 * Collections
 * ------------------------------------------------------------------ */

export type Collection = {
  id: string;
  name: string;
  created_at: string;
};

export type CollectionWithCount = Collection & {
  placeCount: number;
};

export async function fetchCollections(ownerId: string): Promise<CollectionWithCount[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('id, name, created_at, collection_places(count)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // PostgREST returns an aggregate join as `[{ count: n }]`, or `[]` when empty.
  return (data ?? []).map((row) => {
    const { collection_places: counts, ...collection } = row as Collection & {
      collection_places: { count: number }[];
    };
    return { ...collection, placeCount: counts?.[0]?.count ?? 0 };
  });
}

export async function fetchCollection(
  id: string
): Promise<{ collection: Collection; places: PlaceSummary[] }> {
  const [{ data: collection, error: collectionError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase.from('collections').select('id, name, created_at').eq('id', id).single(),
      supabase
        .from('collection_places')
        .select('places(id, name, area, price_range, tagline, status, cover_color)')
        .eq('collection_id', id),
    ]);

  if (collectionError) throw collectionError;
  if (rowsError) throw rowsError;

  const places = (rows ?? [])
    .map((row) => (row as unknown as { places: PlaceSummary | null }).places)
    .filter((place): place is PlaceSummary => place != null);

  return { collection: collection as Collection, places };
}

/** Which of my collections already contain this place. */
export async function fetchCollectionsForPlace(
  ownerId: string,
  placeId: string
): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collection_places')
    .select('collections!inner(id, name, created_at, owner_id)')
    .eq('place_id', placeId)
    .eq('collections.owner_id', ownerId);

  if (error) throw error;

  return (data ?? [])
    .map((row) => (row as unknown as { collections: Collection | null }).collections)
    .filter((collection): collection is Collection => collection != null);
}

/**
 * Save a place into a named collection, creating the collection on first use.
 * Both upserts lean on constraints that already exist in the database:
 * `collections_owner_id_name_key` UNIQUE (owner_id, name), and
 * `collection_places_pkey` PRIMARY KEY (collection_id, place_id) — so saving
 * the same place to the same list twice is a silent no-op.
 */
export async function saveToCollection(
  ownerId: string,
  placeId: string,
  name: string
): Promise<void> {
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .upsert({ owner_id: ownerId, name: name.trim() }, { onConflict: 'owner_id,name' })
    .select('id')
    .single();

  if (collectionError) throw collectionError;

  const { error: linkError } = await supabase
    .from('collection_places')
    .upsert(
      { collection_id: (collection as { id: string }).id, place_id: placeId },
      { onConflict: 'collection_id,place_id', ignoreDuplicates: true }
    );

  if (linkError) throw linkError;
}

export async function removeFromCollection(collectionId: string, placeId: string): Promise<void> {
  const { error } = await supabase
    .from('collection_places')
    .delete()
    .eq('collection_id', collectionId)
    .eq('place_id', placeId);

  if (error) throw error;
}

/* ------------------------------------------------------------------ *
 * Diary + passport stamps
 *
 * `diary_entries` is private by RLS ("a user sees only their own diary"),
 * so these reads are already scoped to the signed-in user — the explicit
 * owner_id filters below are belt-and-braces, not the security boundary.
 * ------------------------------------------------------------------ */

export type DiaryEntry = {
  id: string;
  place_id: string | null;
  dish: string | null;
  who_with: string | null;
  spend: number | null;
  note: string | null;
  created_at: string;
  places: { name: string } | null;
};

export type NewDiaryEntry = {
  owner_id: string;
  place_id: string;
  dish?: string;
  who_with?: string;
  spend?: number;
  note?: string;
};

export async function fetchDiaryEntries(ownerId: string): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*, places(name)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as unknown as DiaryEntry[];
}

/** A place is "stamped" once you have any diary entry for it. */
export async function fetchStampedPlaceIds(ownerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('place_id')
    .eq('owner_id', ownerId);

  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => (row as { place_id: string | null }).place_id)
      .filter((id): id is string => id != null)
  );
}

export async function createDiaryEntry(input: NewDiaryEntry): Promise<void> {
  const { error } = await supabase.from('diary_entries').insert(input);
  if (error) throw error;
}

/* ------------------------------------------------------------------ *
 * Events + tickets
 * ------------------------------------------------------------------ */

export type EventRow = {
  id: string;
  place_id: string;
  title: string;
  event_date: string;
  event_time: string;
  price: number;
  tickets_total: number;
  tickets_sold: number;
  blurb: string | null;
  places: { name: string } | null;
};

export type Ticket = {
  id: string;
  event_id: string;
  count: number;
  created_at: string;
  events: { title: string } | null;
};

export async function fetchEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, places(name)')
    .order('event_date')
    .limit(100);

  if (error) throw error;
  return (data ?? []) as unknown as EventRow[];
}

export async function fetchMyTickets(userId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*, events(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Ticket[];
}

/**
 * Reserve seats on an event.
 *
 * The capacity check lives in the `reserve_tickets` Postgres function, which
 * does a conditional UPDATE and returns zero rows when the request would
 * oversell. That's what makes concurrent reservations safe — never bump
 * `tickets_sold` from the client.
 *
 * Known gap, shared with the web app: if the `tickets` insert below fails
 * after the RPC succeeded, the seats stay counted with no ticket to show for
 * it. Closing that needs the insert folded into the same function, which is a
 * schema change and so belongs in the web repo's migrations.
 */
export async function reserveTickets(
  eventId: string,
  userId: string,
  count: number
): Promise<'ok' | 'sold-out'> {
  const { data: reserved, error: reserveError } = await supabase
    .rpc('reserve_tickets', { p_event_id: eventId, p_count: count })
    .select()
    .maybeSingle();

  if (reserveError) throw reserveError;
  if (!reserved) return 'sold-out';

  const { error: ticketError } = await supabase
    .from('tickets')
    .insert({ event_id: eventId, user_id: userId, count });

  if (ticketError) throw ticketError;
  return 'ok';
}

/* ------------------------------------------------------------------ *
 * Push notifications
 * ------------------------------------------------------------------ */

/** Registers (or re-registers) this device's Expo push token for a user. */
export async function registerPushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token', ignoreDuplicates: true });

  if (error) throw error;
}

/* ------------------------------------------------------------------ *
 * Owner dashboard (claim + manage a place)
 * ------------------------------------------------------------------ */

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
  const { error } = await supabase
    .from('places')
    .update({ status, reopen_date: status === 'temp-closed' ? reopenDate : null })
    .eq('id', placeId);

  if (error) throw error;
}

export async function updatePlaceTagline(placeId: string, tagline: string | null): Promise<void> {
  const { error } = await supabase.from('places').update({ tagline }).eq('id', placeId);
  if (error) throw error;
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
  const { error } = await supabase.from('dishes').update(fields).eq('id', dishId);
  if (error) throw error;
}

export async function deleteDish(dishId: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', dishId);
  if (error) throw error;
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
