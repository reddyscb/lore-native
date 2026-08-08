import { memo, useCallback, useEffect, useState } from 'react';
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
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { MessagesIcon } from '@/features/messages/components/MessagesIcon';
import { borderWidth, colors, fontFamily, fontSize, radii, spacing } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { usePlaceList } from '@/features/places/hooks/use-place-list';
import { useStampedPlaceIds } from '@/features/passport/hooks/use-stamped-place-ids';
import type { PlaceSummary } from '@/features/places/api/places';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function PassportScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';
  const { stamped: justStamped } = useLocalSearchParams<{ stamped?: string }>();

  const { data: places = [], isLoading: placesLoading, refetch: refetchPlaces } = usePlaceList();
  const {
    data: stamped = new Set<string>(),
    isLoading: stampedLoading,
    refetch: refetchStamped,
  } = useStampedPlaceIds(ownerId || undefined);
  const loading = placesLoading || stampedLoading;
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

  // Re-read on focus so a stamp collected via check-in shows up on the way back.
  useFocusEffect(
    useCallback(() => {
      refetchPlaces();
      refetchStamped();
    }, [refetchPlaces, refetchStamped])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPlaces(), refetchStamped()]);
    setRefreshing(false);
  }, [refetchPlaces, refetchStamped]);

  const keyExtractor = useCallback((item: PlaceSummary) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PlaceSummary }) => (
      <StampCell
        place={item}
        collected={stamped.has(item.id)}
        onPress={() => router.push(`/place/${item.id}`)}
      />
    ),
    [stamped, router]
  );

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
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <View style={styles.titleRowText}>
                <PageHeader
                  eyebrow="Lore Passport"
                  title="Your city, one stamp at a time"
                  subtitle="Check in at a place from its café page to collect a stamp."
                />
              </View>
              <MessagesIcon />
            </View>
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
        renderItem={renderItem}
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

const StampCell = memo(function StampCell({
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
});

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleRowText: { flex: 1 },
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
