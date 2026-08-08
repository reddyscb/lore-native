import { useQuery } from '@tanstack/react-query';
import { fetchCollection } from '@/features/collections/api/collections';

export function collectionKey(collectionId: string) {
  return ['collections', collectionId] as const;
}

export function useCollection(collectionId: string | undefined) {
  return useQuery({
    queryKey: collectionKey(collectionId ?? ''),
    queryFn: () => fetchCollection(collectionId as string),
    enabled: !!collectionId,
  });
}
