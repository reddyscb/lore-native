import { useMutation } from '@tanstack/react-query';
import { usePostHog } from 'posthog-react-native';
import { sendMessageMedia } from '@/features/messages/api/messages';
import type { PickedMedia } from '@/shared/api/media';

export function useSendMessageMedia() {
  const posthog = usePostHog();

  return useMutation({
    mutationFn: ({
      conversationId,
      senderId,
      media,
    }: {
      conversationId: string;
      senderId: string;
      media: PickedMedia;
    }) => sendMessageMedia(conversationId, senderId, media),
    onSuccess: (_data, { conversationId }) => {
      posthog?.capture('message_sent', { conversation_id: conversationId, has_media: true });
    },
  });
}
