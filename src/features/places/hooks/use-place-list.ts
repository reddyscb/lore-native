import { useQuery } from '@tanstack/react-query';
import { searchPlaces } from '@/features/places/api/places';

export const placeListKey = ['places', 'list'] as const;

/** Every place, unfiltered — used where a screen needs the full list rather
 *  than a search-scoped subset (Explore's area chips, Passport's stamp grid). */
export function usePlaceList() {
  return useQuery({
    queryKey: placeListKey,
    queryFn: () => searchPlaces({}),
  });
}
