import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { PlaceListItem } from '@/features/places/components/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useCollection } from '@/features/collections/hooks/use-collection';
import type { PlaceSummary } from '@/features/places/api/places';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading: loading } = useCollection(id);
  const collection = data?.collection ?? null;
  const places = data?.places ?? [];

  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => (
      <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
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

  if (!collection) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <Text style={styles.empty}>Couldn&apos;t find this collection.</Text>
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
            eyebrow="Collection"
            title={collection.name}
            subtitle={`${places.length} place${places.length === 1 ? '' : 's'} saved`}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
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
