import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TextField } from '@/components/ui/TextField';
import { Chip } from '@/components/ui/Chip';
import { PlaceListItem } from '@/components/ui/PlaceListItem';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { searchPlaces, type PlaceSummary } from '@/lib/queries';

const PRICE_RANGES = ['₹', '₹₹', '₹₹₹'];

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [allAreas, setAllAreas] = useState<string[]>([]);
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    searchPlaces({}).then((places) => {
      const areas = [...new Set(places.map((p) => p.area).filter((a): a is string => !!a))];
      setAllAreas(areas.sort());
    });
  }, []);

  const runSearch = useCallback(() => {
    setLoading(true);
    searchPlaces({ query, area: area ?? undefined, priceRange: priceRange ?? undefined })
      .then(setResults)
      .finally(() => setLoading(false));
  }, [query, area, priceRange]);

  useEffect(() => {
    // Show the spinner immediately on keystroke rather than waiting for the
    // debounce to elapse — otherwise typing looks like it does nothing for
    // the first 300ms.
    setLoading(true);
    const timeout = setTimeout(runSearch, 300);
    return () => clearTimeout(timeout);
  }, [runSearch]);

  const availablePrices = useMemo(
    () => PRICE_RANGES.filter((p) => results.some((r) => r.price_range === p) || p === priceRange),
    [results, priceRange]
  );

  return (
    <ScreenContainer padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PlaceListItem place={item} onPress={() => router.push(`/place/${item.id}`)} />
        )}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Explore</Text>
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
