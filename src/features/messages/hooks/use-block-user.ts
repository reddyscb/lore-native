import { useMutation } from '@tanstack/react-query';
import { blockUser } from '@/features/messages/api/messages';

export function useBlockUser() {
  return useMutation({
    mutationFn: ({ blockerId, blockedId }: { blockerId: string; blockedId: string }) =>
      blockUser(blockerId, blockedId),
  });
}
