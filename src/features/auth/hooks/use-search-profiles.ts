import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { searchProfiles } from '@/features/auth/api/profiles';

/** Debounced people search, shared by the drop composer's "tag friends" and
 *  the new-message screen's recipient picker. */
export function useSearchProfiles(query: string, excludeId: string) {
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const trimmed = debouncedQuery.trim();
  const enabled = !!trimmed && !!excludeId;

  const result = useQuery({
    queryKey: ['profiles', 'search', trimmed, excludeId],
    queryFn: () => searchProfiles(trimmed, excludeId),
    enabled,
  });

  return { results: enabled ? (result.data ?? []) : [] };
}
