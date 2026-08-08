import { useQuery } from '@tanstack/react-query';
import { fetchPlace } from '@/features/places/api/places';

export function placeKey(placeId: string) {
  return ['places', placeId] as const;
}

export function usePlace(placeId: string | undefined) {
  return useQuery({
    queryKey: placeKey(placeId ?? ''),
    queryFn: () => fetchPlace(placeId as string),
    enabled: !!placeId,
  });
}
