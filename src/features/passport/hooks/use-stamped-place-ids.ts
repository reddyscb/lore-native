import { useQuery } from '@tanstack/react-query';
import { fetchStampedPlaceIds } from '@/features/passport/api/passport';

export function stampedPlaceIdsKey(ownerId: string) {
  return ['diary', 'stampedPlaceIds', ownerId] as const;
}

export function useStampedPlaceIds(ownerId: string | undefined) {
  return useQuery({
    queryKey: stampedPlaceIdsKey(ownerId ?? ''),
    queryFn: () => fetchStampedPlaceIds(ownerId as string),
    enabled: !!ownerId,
  });
}
