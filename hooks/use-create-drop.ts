import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDrop, tagProfilesOnDrop, uploadDropMedia } from '@/lib/queries';
import type { NewDropInput, PickedMedia } from '@/lib/queries';
import { dropFeedKey } from './use-drop-feed';

type CreateDropArgs = {
  input: NewDropInput;
  taggedProfileIds: string[];
  media: PickedMedia[];
};

/** Creates a drop plus its tags/media, then invalidates the home feed so it
 * picks up the new drop on next read instead of waiting for its staleTime. */
export function useCreateDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, taggedProfileIds, media }: CreateDropArgs) => {
      const { id: dropId } = await createDrop(input);
      await tagProfilesOnDrop(dropId, taggedProfileIds);
      await uploadDropMedia(dropId, media);
      return { id: dropId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dropFeedKey });
    },
  });
}
