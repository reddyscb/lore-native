import { useQuery } from '@tanstack/react-query';
import { fetchPlaceDrops } from '@/features/drops/api/drops';

export function placeDropsKey(placeId: string) {
  return ['places', placeId, 'drops'] as const;
}

export function usePlaceDrops(placeId: string | undefined) {
  return useQuery({
    queryKey: placeDropsKey(placeId ?? ''),
    queryFn: () => fetchPlaceDrops(placeId as string),
    enabled: !!placeId,
  });
}
