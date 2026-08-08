import { useQuery } from '@tanstack/react-query';
import { fetchConversation } from '@/features/messages/api/messages';

export function conversationKey(conversationId: string) {
  return ['conversations', conversationId] as const;
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationKey(conversationId ?? ''),
    queryFn: () => fetchConversation(conversationId as string),
    enabled: !!conversationId,
  });
}
