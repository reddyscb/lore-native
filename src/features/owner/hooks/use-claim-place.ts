import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimPlace } from '@/features/owner/api/owner';
import { unclaimedPlacesKey } from '@/features/owner/hooks/use-unclaimed-places';

export function useClaimPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, placeId }: { userId: string; placeId: string }) =>
      claimPlace(userId, placeId),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: unclaimedPlacesKey });
      queryClient.invalidateQueries({ queryKey: ['owner', 'places', userId] });
    },
  });
}
