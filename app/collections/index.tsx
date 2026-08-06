import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchCollections, type CollectionWithCount } from '@/lib/queries';

export default function CollectionsScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-read on focus so a place saved from a café page shows up on return.
  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      fetchCollections(ownerId)
        .then(setCollections)
        .finally(() => setLoading(false));
    }, [ownerId])
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
        keyExtractor={(item) => item.id}
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
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/collections/${item.id}`)}>
            <Card style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.count}>
                {item.placeCount} place{item.placeCount === 1 ? '' : 's'} saved
              </Text>
            </Card>
          </Pressable>
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
