import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePostHog } from 'posthog-react-native';
import { createDrop, tagProfilesOnDrop, uploadDropMedia } from '@/features/drops/api/drops';
import type { NewDropInput } from '@/features/drops/api/drops';
import type { PickedMedia } from '@/shared/api/media';
import { dropFeedKey } from '@/features/drops/hooks/use-drop-feed';

type CreateDropArgs = {
  input: NewDropInput;
  taggedProfileIds: string[];
  media: PickedMedia[];
};

/** Creates a drop plus its tags/media, then invalidates the home feed so it
 * picks up the new drop on next read instead of waiting for its staleTime. */
export function useCreateDrop() {
  const queryClient = useQueryClient();
  const posthog = usePostHog();

  return useMutation({
    mutationFn: async ({ input, taggedProfileIds, media }: CreateDropArgs) => {
      const { id: dropId } = await createDrop(input);
      await tagProfilesOnDrop(dropId, taggedProfileIds);
      await uploadDropMedia(dropId, media);
      return { id: dropId };
    },
    onSuccess: (_data, { input, taggedProfileIds, media }) => {
      queryClient.invalidateQueries({ queryKey: dropFeedKey });
      posthog?.capture('drop_created', {
        place_id: input.place_id,
        has_media: media.length > 0,
        tagged_count: taggedProfileIds.length,
      });
    },
  });
}
