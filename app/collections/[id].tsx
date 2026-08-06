import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlaceListItem } from '@/components/ui/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchCollection, type Collection, type PlaceSummary } from '@/lib/queries';

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
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <PageHeader
            eyebrow="Collection"
            title={collection.name}
            subtitle={`${places.length} place${places.length === 1 ? '' : 's'} saved`}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
        renderItem={({ item }) => (
          <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
        )}
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
