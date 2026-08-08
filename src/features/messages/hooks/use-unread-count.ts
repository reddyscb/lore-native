import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '@/features/messages/api/messages';

export const unreadCountKey = ['conversations', 'unreadCount'] as const;

/** Shared across every MessagesIcon instance (one per tab header), so this
 *  fires once per cache window rather than once per mounted icon. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: unreadCountKey,
    queryFn: fetchUnreadCount,
    enabled,
  });
}
