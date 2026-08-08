import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeFromCollection } from '@/features/collections/api/collections';

export function useRemoveFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, placeId }: { collectionId: string; placeId: string }) =>
      removeFromCollection(collectionId, placeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
