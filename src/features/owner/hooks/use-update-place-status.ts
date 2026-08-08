import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePlaceStatus } from '@/features/owner/api/owner';
import { placeKey } from '@/features/places/hooks/use-place';

export function useUpdatePlaceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      placeId,
      status,
      reopenDate,
    }: {
      placeId: string;
      status: string;
      reopenDate: string | null;
    }) => updatePlaceStatus(placeId, status, reopenDate),
    onSuccess: (_data, { placeId }) => {
      queryClient.invalidateQueries({ queryKey: placeKey(placeId) });
      queryClient.invalidateQueries({ queryKey: ['owner', 'places'] });
    },
  });
}
