import { useQuery } from '@tanstack/react-query';
import { fetchOwnedPlaces } from '@/features/owner/api/owner';

export function ownedPlacesKey(ownerId: string) {
  return ['owner', 'places', ownerId] as const;
}

export function useOwnedPlaces(ownerId: string | undefined) {
  return useQuery({
    queryKey: ownedPlacesKey(ownerId ?? ''),
    queryFn: () => fetchOwnedPlaces(ownerId as string),
    enabled: !!ownerId,
  });
}
