import { useMutation } from '@tanstack/react-query';
import { getOrCreateDirectConversation } from '@/features/messages/api/messages';

export function useGetOrCreateConversation() {
  return useMutation({
    mutationFn: (otherUserId: string) => getOrCreateDirectConversation(otherUserId),
  });
}
