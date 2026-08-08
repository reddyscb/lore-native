import { supabase } from '@/shared/supabase/supabase';

/*
 * `diary_entries` is private by RLS ("a user sees only their own diary"),
 * so these reads are already scoped to the signed-in user — the explicit
 * owner_id filters below are belt-and-braces, not the security boundary.
 */

export type DiaryEntry = {
  id: string;
  place_id: string | null;
  dish: string | null;
  who_with: string | null;
  spend: number | null;
  note: string | null;
  created_at: string;
  places: { name: string } | null;
};

export type NewDiaryEntry = {
  owner_id: string;
  place_id: string;
  dish?: string;
  who_with?: string;
  spend?: number;
  note?: string;
};

export async function fetchDiaryEntries(ownerId: string): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*, places(name)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as unknown as DiaryEntry[];
}

/** A place is "stamped" once you have any diary entry for it. */
export async function fetchStampedPlaceIds(ownerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('place_id')
    .eq('owner_id', ownerId);

  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => (row as { place_id: string | null }).place_id)
      .filter((id): id is string => id != null)
  );
}

export async function createDiaryEntry(input: NewDiaryEntry): Promise<void> {
  const { error } = await supabase.from('diary_entries').insert(input);
  if (error) throw error;
}
