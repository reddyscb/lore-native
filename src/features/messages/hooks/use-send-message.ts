import { useMutation } from '@tanstack/react-query';
import { sendMessage } from '@/features/messages/api/messages';

export function useSendMessage() {
  return useMutation({
    mutationFn: ({
      conversationId,
      senderId,
      body,
    }: {
      conversationId: string;
      senderId: string;
      body: string;
    }) => sendMessage(conversationId, senderId, body),
  });
}
