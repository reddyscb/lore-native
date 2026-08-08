import { supabase } from '@/shared/supabase/supabase';
import type { PlaceSummary } from '@/features/places/api/places';

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
