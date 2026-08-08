import { useMutation } from '@tanstack/react-query';
import { sendMessageMedia } from '@/features/messages/api/messages';
import type { PickedMedia } from '@/shared/api/media';

export function useSendMessageMedia() {
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
  });
}
