import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { TextField } from '@/shared/components/TextField';
import { Chip } from '@/shared/components/Chip';
import { PlaceListItem } from '@/features/places/components/PlaceListItem';
import { MessagesIcon } from '@/features/messages/components/MessagesIcon';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { usePlaceList } from '@/features/places/hooks/use-place-list';
import { useSearchPlaces } from '@/features/places/hooks/use-search-places';
import type { PlaceSummary } from '@/features/places/api/places';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

const PRICE_RANGES = ['₹', '₹₹', '₹₹₹'];

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string | null>(null);

  const { data: allPlaces = [] } = usePlaceList();
  const allAreas = useMemo(
    () => [...new Set(allPlaces.map((p) => p.area).filter((a): a is string => !!a))].sort(),
    [allPlaces]
  );

  const { results, loading } = useSearchPlaces({
    query,
    area: area ?? undefined,
    priceRange: priceRange ?? undefined,
  });

  const availablePrices = useMemo(
    () => PRICE_RANGES.filter((p) => results.some((r) => r.price_range === p) || p === priceRange),
    [results, priceRange]
  );

  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => (
      <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
    ),
    [router]
  );

  return (
    <ScreenContainer padded={false}>
      <FlashList
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Explore</Text>
              <MessagesIcon />
            </View>
            <TextField
              placeholder="Search cafés by name"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
            <View style={styles.chipRow}>
              {allAreas.map((a) => (
                <Chip key={a} label={a} selected={area === a} onPress={() => setArea(area === a ? null : a)} />
              ))}
            </View>
            {availablePrices.length > 0 && (
              <View style={styles.chipRow}>
                {availablePrices.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={priceRange === p}
                    onPress={() => setPriceRange(priceRange === p ? null : p)}
                  />
                ))}
              </View>
            )}
            {loading && <ActivityIndicator color={colors.raspberry} style={styles.spinner} />}
          </View>
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No cafés match that search.</Text> : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  search: {
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  spinner: {
    marginBottom: spacing.md,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
