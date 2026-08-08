import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadDishPhoto } from '@/features/owner/api/owner';
import { dishesKey } from '@/features/places/hooks/use-dishes';
import type { Dish } from '@/features/places/api/places';
import type { PickedMedia } from '@/shared/api/media';

export function useUploadDishPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dishId,
      placeId,
      media,
    }: {
      dishId: string;
      placeId: string;
      media: PickedMedia;
    }) => uploadDishPhoto(dishId, placeId, media),
    onSuccess: (photoUrl, { dishId, placeId }) => {
      queryClient.setQueryData(dishesKey(placeId), (old: Dish[] | undefined) =>
        old?.map((dish) => (dish.id === dishId ? { ...dish, photo_url: photoUrl } : dish))
      );
    },
  });
}
