import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reserveTickets } from '@/features/events/api/events';
import { eventsListKey } from '@/features/events/hooks/use-events';
import { myTicketsKey } from '@/features/events/hooks/use-my-tickets';

export function useReserveTickets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      userId,
      count,
    }: {
      eventId: string;
      userId: string;
      count: number;
    }) => reserveTickets(eventId, userId, count),
    // Refetch on both outcomes: on success to pick up the new count, on
    // sold-out because a stale "N left" is exactly what caused the failure.
    onSuccess: (_result, { userId }) => {
      queryClient.invalidateQueries({ queryKey: eventsListKey });
      queryClient.invalidateQueries({ queryKey: myTicketsKey(userId) });
    },
  });
}
