import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { PlaceListItem } from '@/features/places/components/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { fetchCollection, type Collection, type PlaceSummary } from '@/shared/api/queries';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchCollection(id)
      .then((result) => {
        setCollection(result.collection);
        setPlaces(result.places);
      })
      .finally(() => setLoading(false));
  }, [id]);

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
