import { useEffect, useRef } from 'react';
import { supabase } from '@/shared/supabase/supabase';
import type { Message } from '@/features/messages/api/messages';

/**
 * Subscribes to new inserts on `messages` for one conversation while the
 * thread screen is mounted. Scoped narrowly on purpose — per the DM design
 * spec's "real-time inside an open thread" decision, the inbox list and the
 * tab-header unread badge refresh on focus instead of staying subscribed;
 * five simultaneous background subscriptions for a badge that's at most one
 * tab-switch stale isn't worth the lifecycle complexity.
 *
 * The ref indirection means callers can pass an inline callback every
 * render without tearing down and recreating the channel subscription.
 */
export function useMessagesRealtime(conversationId: string, onInsert: (message: Message) => void) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onInsertRef.current(payload.new as Message)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
