import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchOwnedPlaces, type Place, type Dish } from '@/lib/queries';

type OwnedPlace = Place & { dishes: Dish[] };

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const [places, setPlaces] = useState<OwnedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      fetchOwnedPlaces(ownerId)
        .then(setPlaces)
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
        data={places}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<PageHeader eyebrow="Owner's Lore" title="Managing your places" />}
        ListEmptyComponent={<Text style={styles.empty}>You don&apos;t own any places yet.</Text>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{[item.area, item.price_range].filter(Boolean).join(' · ')}</Text>
            <StatusBadge status={item.status} reopenDate={item.reopen_date} />
            <Button
              label="Manage"
              variant="secondary"
              inline
              onPress={() => router.push(`/owner/place/${item.id}`)}
            />
          </Card>
        )}
        ListFooterComponent={
          <Button label="+ claim another place" variant="ghost" onPress={() => router.push('/owner/claim')} />
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
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  meta: {
    fontFamily: fontFamily.mono,
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
