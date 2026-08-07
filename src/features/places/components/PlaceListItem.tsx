import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/shared/components/Card';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import type { PlaceSummary } from '@/shared/api/queries';

type Props = {
  place: PlaceSummary;
  onPress: () => void;
};

export const PlaceListItem = memo(function PlaceListItem({ place, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.name}>{place.name}</Text>
            <Text style={styles.meta}>
              {[place.area, place.price_range].filter(Boolean).join(' · ')}
            </Text>
            {place.tagline && (
              <Text style={styles.tagline} numberOfLines={1}>
                {place.tagline}
              </Text>
            )}
          </View>
          <StatusBadge status={place.status} />
        </View>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  tagline: {
    fontFamily: fontFamily.displayItalic,
    fontSize: fontSize.sm,
    color: colors.ink,
    marginTop: 2,
  },
});
