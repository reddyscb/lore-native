import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDish, type NewDishInput } from '@/features/owner/api/owner';
import { dishesKey } from '@/features/places/hooks/use-dishes';
import type { Dish } from '@/features/places/api/places';

export function useAddDish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ placeId, fields }: { placeId: string; fields: NewDishInput }) =>
      addDish(placeId, fields),
    onSuccess: (dish, { placeId }) => {
      queryClient.setQueryData(dishesKey(placeId), (old: Dish[] | undefined) => [...(old ?? []), dish]);
    },
  });
}
