import { memo, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useOwnedPlaces } from '@/features/owner/hooks/use-owned-places';
import type { Place, Dish } from '@/features/places/api/places';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

type OwnedPlace = Place & { dishes: Dish[] };

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const { profile, session } = useAuthStore();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const {
    data: places = [],
    isLoading: loading,
    isError: loadError,
    refetch,
  } = useOwnedPlaces(ownerId || undefined);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      refetch();
    }, [ownerId, refetch])
  );

  const keyExtractor = useCallback((item: OwnedPlace) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: OwnedPlace }) => (
      <OwnedPlaceRow place={item} onManage={() => router.push(`/owner/place/${item.id}`)} />
    ),
    [router]
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
        ListHeaderComponent={<PageHeader eyebrow="Owner's Lore" title="Managing your places" />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loadError
              ? "Couldn't load your places. Try again in a moment."
              : "You don't own any places yet."}
          </Text>
        }
        renderItem={renderItem}
        ListFooterComponent={
          <Button label="+ claim another place" variant="ghost" onPress={() => router.push('/owner/claim')} />
        }
      />
    </ScreenContainer>
  );
}

const OwnedPlaceRow = memo(function OwnedPlaceRow({
  place,
  onManage,
}: {
  place: OwnedPlace;
  onManage: () => void;
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.name}>{place.name}</Text>
      <Text style={styles.meta}>{[place.area, place.price_range].filter(Boolean).join(' · ')}</Text>
      <StatusBadge status={place.status} reopenDate={place.reopen_date} />
      <Button label="Manage" variant="secondary" inline onPress={onManage} />
    </Card>
  );
});

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    // Row spacing lives here rather than as a contentContainerStyle `gap` —
    // FlashList positions recycled cells itself, so container gap isn't a
    // reliable way to space items.
    marginBottom: spacing.md,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  meta: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
