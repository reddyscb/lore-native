import { supabase } from '@/shared/supabase/supabase';

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rollout_percentage: number;
  target_roles: string[];
  target_cities: string[];
};

export async function fetchFeatureFlag(key: string): Promise<FeatureFlag | null> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, rollout_percentage, target_roles, target_cities')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching feature flag "${key}":`, error);
    return null;
  }
  return data;
}
