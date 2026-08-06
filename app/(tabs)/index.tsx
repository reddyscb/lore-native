import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { DropCard } from '@/components/ui/DropCard';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchDropFeed, type Drop } from '@/lib/queries';

export default function HomeScreen() {
  const router = useRouter();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchDropFeed();
    setDrops(data);
  }, []);

  // Re-read on focus (not just on mount) so a drop posted elsewhere shows up
  // when you come back to Home — `loading` only ever gates the very first
  // load, so later focuses refresh in the background without a spinner.
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
        data={drops}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DropCard drop={item} place={item.places ? { id: item.place_id, ...item.places } : undefined} />
        )}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Home</Text>
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
