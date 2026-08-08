import { useMutation } from '@tanstack/react-query';
import { updateAvatar } from '@/features/auth/api/profiles';
import type { PickedMedia } from '@/shared/api/media';

export function useUpdateAvatar() {
  return useMutation({
    mutationFn: ({ userId, media }: { userId: string; media: PickedMedia }) =>
      updateAvatar(userId, media),
  });
}
