import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { searchPlaces } from '@/features/places/api/places';

export type PlaceSearchParams = {
  query?: string;
  area?: string;
  priceRange?: string;
};

/** Debounces `params` before querying, and reports `loading` as true from
 *  the moment the params change (not just once the debounced fetch starts)
 *  so typing doesn't look like it's doing nothing for the debounce window. */
export function useSearchPlaces(params: PlaceSearchParams) {
  const [debounced, isPending] = useDebouncedValue(params, 300);

  const query = useQuery({
    queryKey: ['places', 'search', debounced],
    queryFn: () => searchPlaces(debounced),
  });

  return { results: query.data ?? [], loading: isPending || query.isFetching };
}
