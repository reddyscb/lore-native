import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { DropCard } from '@/features/drops/components/DropCard';
import { MessagesIcon } from '@/features/messages/components/MessagesIcon';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useDropFeed } from '@/features/drops/hooks/use-drop-feed';
import type { Drop } from '@/features/drops/api/drops';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function HomeScreen() {
  const router = useRouter();
  const { data: drops = [], isLoading, refetch } = useDropFeed();
  const [refreshing, setRefreshing] = useState(false);

  // Re-read on focus (not just on mount) so a drop posted elsewhere shows up
  // when you come back to Home — `isLoading` only ever gates the very first
  // load, so later focuses refresh in the background without a spinner.
  // (Deliberately not driven by the query's own isRefetching — that would
  // also flip true on this focus-triggered background refetch and pop the
  // pull-to-refresh spinner on every tab visit, not just an explicit pull.)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const keyExtractor = useCallback((item: Drop) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Drop }) => (
      <DropCard drop={item} place={item.places ? { id: item.place_id, ...item.places } : undefined} />
    ),
    []
  );

  if (isLoading) {
    return (
      <ScreenContainer style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <FlashList
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.list}
        data={drops}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Home</Text>
              <MessagesIcon />
            </View>
            <View style={styles.quickLinks}>
              <Pressable onPress={() => router.push('/collections')}>
                <Text style={styles.quickLink}>Collections</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/events')}>
                <Text style={styles.quickLink}>Events</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No drops yet — be the first to leave one.</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.raspberry} />
        }
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickLink: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.raspberry,
    textDecorationLine: 'underline',
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
