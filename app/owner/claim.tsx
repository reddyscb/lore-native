import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { PlaceListItem } from '@/features/places/components/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useUnclaimedPlaces } from '@/features/owner/hooks/use-unclaimed-places';
import { useClaimPlace } from '@/features/owner/hooks/use-claim-place';
import type { PlaceSummary } from '@/features/places/api/places';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function ClaimPlaceScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuthStore();
  const userId = profile?.id ?? session?.user?.id ?? '';

  const { data: places = [], isLoading: loading, isError: loadError } = useUnclaimedPlaces();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimPlaceMutation = useClaimPlace();

  const onClaim = useCallback(
    async (placeId: string) => {
      if (!userId || claimingId) return;
      setClaimingId(placeId);
      try {
        await claimPlaceMutation.mutateAsync({ userId, placeId });
        await refreshProfile();
        router.replace('/owner');
      } catch (error) {
        Alert.alert(
          'Could not claim this place',
          error instanceof Error ? error.message : 'Something went wrong.'
        );
        setClaimingId(null);
      }
    },
    [userId, claimingId, claimPlaceMutation, refreshProfile, router]
  );

  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => <PlaceListItem place={item} onPress={() => onClaim(item.id)} />,
    [onClaim]
  );

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <FlashList
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.list}
        data={places}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <PageHeader
            eyebrow="Claim your place"
            title="Find your café"
            subtitle="Pick your café below. Claiming it makes you its owner."
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loadError
              ? "Couldn't load unclaimed places. Try again in a moment."
              : 'Nothing unclaimed right now — every seeded place already has an owner.'}
          </Text>
        }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
