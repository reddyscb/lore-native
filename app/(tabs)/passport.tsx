import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { borderWidth, colors, fontFamily, fontSize, radii, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchStampedPlaceIds, searchPlaces, type PlaceSummary } from '@/lib/queries';

export default function PassportScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';
  const { stamped: justStamped } = useLocalSearchParams<{ stamped?: string }>();

  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [stamped, setStamped] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStampedToast, setShowStampedToast] = useState(false);

  // Check-in routes back here with ?stamped=1. Clear the param once shown so
  // the banner doesn't reappear every time the tab is revisited.
  useEffect(() => {
    if (!justStamped) return;
    setShowStampedToast(true);
    router.setParams({ stamped: undefined });
    const timeout = setTimeout(() => setShowStampedToast(false), 4000);
    return () => clearTimeout(timeout);
  }, [justStamped, router]);

  const load = useCallback(async () => {
    if (!ownerId) return;
    const [allPlaces, stampedIds] = await Promise.all([
      searchPlaces({}),
      fetchStampedPlaceIds(ownerId),
    ]);
    setPlaces(allPlaces);
    setStamped(stampedIds);
  }, [ownerId]);

  // Re-read on focus so a stamp collected via check-in shows up on the way back.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <ScreenContainer style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <FlatList
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.column}
        numColumns={2}
        data={places}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PageHeader
              eyebrow="Lore Passport"
              title="Your city, one stamp at a time"
              subtitle="Check in at a place from its café page to collect a stamp."
            />
            <Pressable onPress={() => router.push('/diary')}>
              <Text style={styles.diaryLink}>view your private diary →</Text>
            </Pressable>
            {showStampedToast && (
              <View style={styles.toast}>
                <Text style={styles.toastText}>Stamp collected ✓</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No places to stamp yet.</Text>}
        renderItem={({ item }) => (
          <StampCell
            place={item}
            collected={stamped.has(item.id)}
            onPress={() => router.push(`/place/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.raspberry}
          />
        }
      />
    </ScreenContainer>
  );
}

function StampCell({
  place,
  collected,
  onPress,
}: {
  place: PlaceSummary;
  collected: boolean;
  onPress: () => void;
}) {
  return (
    <Card style={styles.cell}>
      <View style={[styles.stamp, collected ? styles.stampCollected : styles.stampEmpty]}>
        <Text style={styles.stampMark}>{collected ? '✦' : '?'}</Text>
      </View>
      <Text style={styles.placeName}>{place.name}</Text>
      <Text style={styles.stampState}>
        {collected ? 'collected ✦' : 'not yet — check in to unlock'}
      </Text>
      <Button label={collected ? 'view' : 'visit page'} variant="secondary" onPress={onPress} />
    </Card>
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
  column: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stamp: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: borderWidth,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCollected: {
    backgroundColor: colors.mustard,
  },
  stampEmpty: {
    backgroundColor: colors.creamDeep,
    opacity: 0.4,
  },
  stampMark: {
    fontFamily: fontFamily.mono,
    fontSize: 22,
    color: colors.ink,
  },
  placeName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
    textAlign: 'center',
  },
  stampState: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  diaryLink: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.raspberry,
    textDecorationLine: 'underline',
    marginBottom: spacing.xl,
  },
  toast: {
    alignSelf: 'flex-start',
    backgroundColor: colors.teal,
    borderRadius: radii.card,
    borderWidth,
    borderColor: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  toastText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.paper,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
