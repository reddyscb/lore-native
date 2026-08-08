import { useMutation } from '@tanstack/react-query';
import { deleteMessage } from '@/features/messages/api/messages';

export function useDeleteMessage() {
  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
  });
}
