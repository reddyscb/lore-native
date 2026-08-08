import { useQuery } from '@tanstack/react-query';
import { fetchFeatureFlag } from '@/features/flags/api/feature-flags';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { hashToBucket } from '@/features/flags/lib/hash-bucket';

export const featureFlagKey = (key: string) => ['feature-flags', key] as const;

export function useFeatureFlag(key: string): boolean {
  const userId = useAuthStore((state) => state.session?.user.id);
  const role = useAuthStore((state) => state.profile?.role ?? null);
  const city = useAuthStore((state) => state.profile?.city ?? null);

  const { data: flag, isLoading } = useQuery({
    queryKey: featureFlagKey(key),
    queryFn: () => fetchFeatureFlag(key),
  });

  if (isLoading || !flag || !userId) return false;
  if (!flag.enabled) return false;
  if (flag.target_roles.length > 0 && (!role || !flag.target_roles.includes(role))) return false;
  if (flag.target_cities.length > 0 && (!city || !flag.target_cities.includes(city))) return false;

  return hashToBucket(`${key}:${userId}`) < flag.rollout_percentage;
}
