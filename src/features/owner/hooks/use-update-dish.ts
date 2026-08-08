import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDish, type DishUpdateInput } from '@/features/owner/api/owner';
import { dishesKey } from '@/features/places/hooks/use-dishes';
import type { Dish } from '@/features/places/api/places';

export function useUpdateDish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dishId,
      fields,
    }: {
      placeId: string;
      dishId: string;
      fields: DishUpdateInput;
    }) => updateDish(dishId, fields),
    onSuccess: (_data, { placeId, dishId, fields }) => {
      queryClient.setQueryData(dishesKey(placeId), (old: Dish[] | undefined) =>
        old?.map((dish) => (dish.id === dishId ? { ...dish, ...fields } : dish))
      );
    },
  });
}
