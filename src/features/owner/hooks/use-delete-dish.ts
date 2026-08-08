import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteDish } from '@/features/owner/api/owner';
import { dishesKey } from '@/features/places/hooks/use-dishes';
import type { Dish } from '@/features/places/api/places';

export function useDeleteDish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dishId }: { placeId: string; dishId: string }) => deleteDish(dishId),
    onSuccess: (_data, { placeId, dishId }) => {
      queryClient.setQueryData(dishesKey(placeId), (old: Dish[] | undefined) =>
        old?.filter((dish) => dish.id !== dishId)
      );
    },
  });
}
