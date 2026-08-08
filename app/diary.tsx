import { memo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { useDiaryEntries } from '@/features/passport/hooks/use-diary-entries';
import type { DiaryEntry } from '@/features/passport/api/passport';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function DiaryScreen() {
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const { data: entries = [], isLoading: loading, refetch } = useDiaryEntries(ownerId || undefined);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      refetch();
    }, [ownerId, refetch])
  );

  const keyExtractor = useCallback((item: DiaryEntry) => item.id, []);
  const renderItem = useCallback(({ item }: { item: DiaryEntry }) => <DiaryEntryCard entry={item} />, []);

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
        data={entries}
        keyExtractor={keyExtractor}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <PageHeader
            eyebrow="Private — only you can see this"
            title="Your visit diary"
            subtitle="What you ordered, who you went with, little memories."
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing yet — check in at a café page to start your diary.
          </Text>
        }
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

const DiaryEntryCard = memo(function DiaryEntryCard({ entry }: { entry: DiaryEntry }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.placeName}>{entry.places?.name ?? 'A place'}</Text>
      <View style={styles.details}>
        {entry.dish && <Text style={styles.detail}>Ordered: {entry.dish}</Text>}
        {entry.who_with && <Text style={styles.detail}>With: {entry.who_with}</Text>}
        {entry.spend != null && <Text style={styles.detail}>Spent: ₹{entry.spend}</Text>}
      </View>
      {entry.note && <Text style={styles.note}>{entry.note}</Text>}
    </Card>
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
    gap: spacing.xs,
  },
  placeName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  details: {
    gap: 2,
  },
  detail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  note: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
