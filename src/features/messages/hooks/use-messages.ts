import { useQuery } from '@tanstack/react-query';
import { fetchMessages } from '@/features/messages/api/messages';

export function messagesKey(conversationId: string) {
  return ['conversations', conversationId, 'messages'] as const;
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: messagesKey(conversationId ?? ''),
    queryFn: () => fetchMessages(conversationId as string),
    enabled: !!conversationId,
  });
}
