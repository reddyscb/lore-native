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
};

const DROP_AUTHOR = 'profiles!drops_author_id_fkey(display_name, avatar_url)';
const REPLY_AUTHOR = 'profiles!drop_replies_author_id_fkey(display_name, avatar_url)';
const DROP_TAGS = 'drop_tags(profiles!drop_tags_tagged_profile_id_fkey(display_name, avatar_url))';

export async function fetchDropFeed(): Promise<Drop[]> {
  const { data, error } = await supabase
    .from('drops')
    .select(`*, places(name, area, status, cover_color), ${DROP_AUTHOR}, ${DROP_TAGS}`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as unknown as Drop[];
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
    .order('rating', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Dish[];
}

export async function fetchPlaceDrops(placeId: string): Promise<Drop[]> {
  const { data, error } = await supabase
    .from('drops')
    .select(`*, ${DROP_AUTHOR}, drop_replies(*, ${REPLY_AUTHOR}), ${DROP_TAGS}`)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Drop[];
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

  const { data, error } = await request;
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
