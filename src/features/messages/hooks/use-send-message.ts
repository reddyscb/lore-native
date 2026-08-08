import { useMutation } from '@tanstack/react-query';
import { usePostHog } from 'posthog-react-native';
import { sendMessage } from '@/features/messages/api/messages';

export function useSendMessage() {
  const posthog = usePostHog();

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
    onSuccess: (_data, { conversationId }) => {
      posthog?.capture('message_sent', { conversation_id: conversationId, has_media: false });
    },
  });
}
