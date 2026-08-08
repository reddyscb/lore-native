import { supabase } from '@/shared/supabase/supabase';

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
    .order('rating', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as Dish[];
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
