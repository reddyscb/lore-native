import { useQuery } from '@tanstack/react-query';
import { fetchMyTickets } from '@/features/events/api/events';

export function myTicketsKey(userId: string) {
  return ['events', 'myTickets', userId] as const;
}

export function useMyTickets(userId: string | undefined) {
  return useQuery({
    queryKey: myTicketsKey(userId ?? ''),
    queryFn: () => fetchMyTickets(userId as string),
    enabled: !!userId,
  });
}
