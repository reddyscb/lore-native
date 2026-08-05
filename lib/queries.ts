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
};

const DROP_AUTHOR = 'profiles!drops_author_id_fkey(display_name, avatar_url)';
const REPLY_AUTHOR = 'profiles!drop_replies_author_id_fkey(display_name, avatar_url)';

export async function fetchDropFeed(): Promise<Drop[]> {
  const { data, error } = await supabase
    .from('drops')
    .select(`*, places(name, area, status, cover_color), ${DROP_AUTHOR}`)
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
    .select(`*, ${DROP_AUTHOR}, drop_replies(*, ${REPLY_AUTHOR})`)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Drop[];
}
