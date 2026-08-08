import { useQuery } from '@tanstack/react-query';
import { fetchUnclaimedPlaces } from '@/features/owner/api/owner';

export const unclaimedPlacesKey = ['owner', 'unclaimedPlaces'] as const;

export function useUnclaimedPlaces() {
  return useQuery({
    queryKey: unclaimedPlacesKey,
    queryFn: fetchUnclaimedPlaces,
  });
}
