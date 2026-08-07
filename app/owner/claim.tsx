import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlaceListItem } from '@/components/ui/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchUnclaimedPlaces, claimPlace, type PlaceSummary } from '@/lib/queries';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/RouteErrorBoundary';

export default function ClaimPlaceScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuthContext();
  const userId = profile?.id ?? session?.user?.id ?? '';

  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchUnclaimedPlaces()
      .then(setPlaces)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const onClaim = useCallback(
    async (placeId: string) => {
      if (!userId || claimingId) return;
      setClaimingId(placeId);
      try {
        await claimPlace(userId, placeId);
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
    [userId, claimingId, refreshProfile, router]
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
      <FlatList
        contentContainerStyle={styles.list}
        data={places}
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
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
