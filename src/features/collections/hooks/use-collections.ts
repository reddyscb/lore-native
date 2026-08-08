import { useQuery } from '@tanstack/react-query';
import { fetchCollections } from '@/features/collections/api/collections';

export function collectionsListKey(ownerId: string) {
  return ['collections', 'list', ownerId] as const;
}

export function useCollections(ownerId: string | undefined) {
  return useQuery({
    queryKey: collectionsListKey(ownerId ?? ''),
    queryFn: () => fetchCollections(ownerId as string),
    enabled: !!ownerId,
  });
}
