import { useQuery } from '@tanstack/react-query';
import { fetchCollectionsForPlace } from '@/features/collections/api/collections';

export function collectionsForPlaceKey(ownerId: string, placeId: string) {
  return ['collections', 'forPlace', ownerId, placeId] as const;
}

export function useCollectionsForPlace(ownerId: string | undefined, placeId: string | undefined) {
  return useQuery({
    queryKey: collectionsForPlaceKey(ownerId ?? '', placeId ?? ''),
    queryFn: () => fetchCollectionsForPlace(ownerId as string, placeId as string),
    enabled: !!ownerId && !!placeId,
  });
}
