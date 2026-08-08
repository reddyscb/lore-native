import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDiaryEntry, type NewDiaryEntry } from '@/features/passport/api/passport';

export function useCreateDiaryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewDiaryEntry) => createDiaryEntry(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['diary', 'entries', input.owner_id] });
      queryClient.invalidateQueries({ queryKey: ['diary', 'stampedPlaceIds', input.owner_id] });
    },
  });
}
