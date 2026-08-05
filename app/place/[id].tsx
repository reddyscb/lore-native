import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DropCard } from '@/components/ui/DropCard';
import { ReplyRow } from '@/components/ui/ReplyRow';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { fetchPlace, fetchDishes, fetchPlaceDrops, type Place, type Dish, type Drop } from '@/lib/queries';

const LORE_FIELDS: { key: keyof Place; label: string }[] = [
  { key: 'go_for', label: 'Go for' },
  { key: 'skip_note', label: 'Skip' },
  { key: 'secret', label: 'Secret' },
];

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [place, setPlace] = useState<Place | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchPlace(id), fetchDishes(id), fetchPlaceDrops(id)])
      .then(([placeData, dishData, dropData]) => {
        setPlace(placeData);
        setDishes(dishData);
        setDrops(dropData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  if (!place) {
    return (
      <ScreenContainer style={styles.centered}>
        <Text style={styles.empty}>Couldn&apos;t find this café.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.meta}>
          {[place.area, place.price_range].filter(Boolean).join(' · ')}
        </Text>
        {place.tagline && <Text style={styles.tagline}>{place.tagline}</Text>}
        <StatusBadge status={place.status} reopenDate={place.reopen_date} />

        {LORE_FIELDS.some(({ key }) => place[key]) && (
          <Card style={styles.section}>
            {LORE_FIELDS.map(({ key, label }) => {
              const value = place[key];
              if (!value) return null;
              return (
                <View key={key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{value}</Text>
                </View>
              );
            })}
          </Card>
        )}

        {dishes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Menu highlights</Text>
            {dishes.map((dish) => (
              <Card key={dish.id} style={styles.dishCard}>
                <View style={styles.dishRow}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  {dish.rating != null && <Text style={styles.dishRating}>{dish.rating}★</Text>}
                </View>
                {dish.tag && <Chip label={dish.tag} />}
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drops</Text>
          {drops.length === 0 && <Text style={styles.empty}>No drops for this place yet.</Text>}
          {drops.map((drop) => (
            <View key={drop.id}>
              <DropCard drop={drop} />
              {drop.drop_replies?.map((reply) => <ReplyRow key={reply.id} reply={reply} />)}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  tagline: {
    fontFamily: fontFamily.displayItalic,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  fieldRow: {
    gap: 2,
  },
  fieldLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.raspberry,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  dishCard: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dishName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  dishRating: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: colors.mustard,
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
