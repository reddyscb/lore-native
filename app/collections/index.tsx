import { memo, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { useCollections } from '@/features/collections/hooks/use-collections';
import type { CollectionWithCount } from '@/features/collections/api/collections';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function CollectionsScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const { data: collections = [], isLoading: loading, refetch } = useCollections(ownerId || undefined);

  // Re-read on focus so a place saved from a café page shows up on return.
  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      refetch();
    }, [ownerId, refetch])
  );

  const keyExtractor = useCallback((item: CollectionWithCount) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: CollectionWithCount }) => (
      <CollectionRow collection={item} onPress={() => router.push(`/collections/${item.id}`)} />
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
      <FlatList
        contentContainerStyle={styles.list}
        data={collections}
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <PageHeader
            eyebrow="Your collections"
            title="Saved lore, organized"
            subtitle="Date spots, solo work, mom's visiting — whatever the list, it's yours."
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No collections yet — save a place from its café page to start one.
          </Text>
        }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

const CollectionRow = memo(function CollectionRow({
  collection,
  onPress,
}: {
  collection: CollectionWithCount;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <Text style={styles.name}>{collection.name}</Text>
        <Text style={styles.count}>
          {collection.placeCount} place{collection.placeCount === 1 ? '' : 's'} saved
        </Text>
      </Card>
    </Pressable>
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
    marginBottom: spacing.md,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  count: {
    fontFamily: fontFamily.body,
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
