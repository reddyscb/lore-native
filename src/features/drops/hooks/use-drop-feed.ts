import { useQuery } from '@tanstack/react-query';
import { fetchDropFeed } from '@/features/drops/api/drops';

/** Shared so useCreateDrop can invalidate exactly this query on success. */
export const dropFeedKey = ['drops', 'feed'] as const;

export function useDropFeed() {
  return useQuery({
    queryKey: dropFeedKey,
    queryFn: fetchDropFeed,
  });
}
