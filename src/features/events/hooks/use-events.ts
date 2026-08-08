import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '@/features/events/api/events';

export const eventsListKey = ['events', 'list'] as const;

export function useEvents() {
  return useQuery({
    queryKey: eventsListKey,
    queryFn: fetchEvents,
  });
}
