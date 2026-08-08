import { useQuery } from '@tanstack/react-query';
import { fetchDiaryEntries } from '@/features/passport/api/passport';

export function diaryEntriesKey(ownerId: string) {
  return ['diary', 'entries', ownerId] as const;
}

export function useDiaryEntries(ownerId: string | undefined) {
  return useQuery({
    queryKey: diaryEntriesKey(ownerId ?? ''),
    queryFn: () => fetchDiaryEntries(ownerId as string),
    enabled: !!ownerId,
  });
}
