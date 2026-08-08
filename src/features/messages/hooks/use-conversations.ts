import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from '@/features/messages/api/messages';

export const conversationsListKey = ['conversations', 'list'] as const;

export function useConversations() {
  return useQuery({
    queryKey: conversationsListKey,
    queryFn: fetchConversations,
  });
}
