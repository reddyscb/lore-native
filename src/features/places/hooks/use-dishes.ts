import { useQuery } from '@tanstack/react-query';
import { fetchDishes } from '@/features/places/api/places';

export function dishesKey(placeId: string) {
  return ['places', placeId, 'dishes'] as const;
}

export function useDishes(placeId: string | undefined) {
  return useQuery({
    queryKey: dishesKey(placeId ?? ''),
    queryFn: () => fetchDishes(placeId as string),
    enabled: !!placeId,
  });
}
