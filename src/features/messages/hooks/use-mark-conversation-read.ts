import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markConversationRead } from '@/features/messages/api/messages';
import { unreadCountKey } from '@/features/messages/hooks/use-unread-count';
import { conversationsListKey } from '@/features/messages/hooks/use-conversations';

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      markConversationRead(conversationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
      queryClient.invalidateQueries({ queryKey: conversationsListKey });
    },
  });
}
