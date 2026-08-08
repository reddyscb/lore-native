import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePlaceTagline } from '@/features/owner/api/owner';
import { placeKey } from '@/features/places/hooks/use-place';

export function useUpdatePlaceTagline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ placeId, tagline }: { placeId: string; tagline: string | null }) =>
      updatePlaceTagline(placeId, tagline),
    onSuccess: (_data, { placeId }) => {
      queryClient.invalidateQueries({ queryKey: placeKey(placeId) });
      queryClient.invalidateQueries({ queryKey: ['owner', 'places'] });
    },
  });
}
