import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createReply, type Drop } from '@/features/drops/api/drops';
import { placeDropsKey } from '@/features/drops/hooks/use-place-drops';

type CreateReplyArgs = {
  dropId: string;
  authorId: string;
  body: string;
};

/** Appends the new reply directly into the place's cached drop list rather
 *  than invalidating — same instant, no-refetch update the screen did with
 *  local state before this hook existed. */
export function useCreateReply(placeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dropId, authorId, body }: CreateReplyArgs) => createReply(dropId, authorId, body),
    onSuccess: (reply, { dropId }) => {
      queryClient.setQueryData(placeDropsKey(placeId), (old: Drop[] | undefined) =>
        old?.map((drop) =>
          drop.id === dropId ? { ...drop, drop_replies: [...(drop.drop_replies ?? []), reply] } : drop
        )
      );
    },
  });
}
