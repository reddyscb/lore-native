import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveToCollection } from '@/features/collections/api/collections';

export function useSaveToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ownerId,
      placeId,
      name,
    }: {
      ownerId: string;
      placeId: string;
      name: string;
    }) => saveToCollection(ownerId, placeId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
