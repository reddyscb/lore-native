import { memo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/shared/components/Card';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Avatar } from '@/shared/components/Avatar';
import { MediaStrip } from '@/shared/components/MediaStrip';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { formatRelativeTime } from '@/shared/utils/format';
import type { Drop } from '@/features/drops/api/drops';

type Props = {
  drop: Drop;
  /** When provided, shows a tappable place header above the drop fields
   *  (feed context). Omit when the place is already shown above (detail
   *  page context). */
  place?: { id: string; name: string; area: string | null; status: string };
};

const FIELDS: { key: keyof Drop; label: string }[] = [
  { key: 'must_order', label: 'Must order' },
  { key: 'skip_note', label: 'Skip' },
  { key: 'sweet_spot', label: 'Sweet spot' },
  { key: 'vibe_check', label: 'Vibe check' },
  { key: 'plot_twist', label: 'Plot twist' },
  { key: 'secret_lore', label: 'Secret lore' },
];

export const DropCard = memo(function DropCard({ drop, place }: Props) {
  const router = useRouter();

  return (
    <Card style={styles.card}>
      {place && (
        <Pressable
          onPress={() => router.push(`/place/${place.id}`)}
          style={styles.placeHeader}
        >
          <View style={styles.placeText}>
            <Text style={styles.placeName}>{place.name}</Text>
            {place.area && <Text style={styles.placeArea}>{place.area}</Text>}
          </View>
          <StatusBadge status={place.status} />
          <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
        </Pressable>
      )}

      <View style={styles.authorRow}>
        <View style={styles.authorIdentity}>
          <Avatar uri={drop.profiles?.avatar_url} name={drop.profiles?.display_name} size={28} />
          <Text style={styles.author}>{drop.profiles?.display_name ?? 'Someone'}</Text>
        </View>
        <Text style={styles.timestamp}>{formatRelativeTime(drop.created_at)}</Text>
      </View>

      {drop.drop_tags && drop.drop_tags.length > 0 && (
        <Text style={styles.tagged}>
          with {drop.drop_tags.map((t) => t.profiles?.display_name ?? 'someone').join(', ')}
        </Text>
      )}

      {drop.drop_media && drop.drop_media.length > 0 && <MediaStrip media={drop.drop_media} />}

      {FIELDS.map(({ key, label }) => {
        const value = drop[key];
        if (!value || typeof value !== 'string') return null;
        return (
          <View key={key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldValue}>{value}</Text>
          </View>
        );
      })}

      {drop.damage != null && (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Damage</Text>
          <Text style={styles.fieldValue}>₹{drop.damage}</Text>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  placeText: {
    flex: 1,
  },
  placeName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  placeArea: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  author: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  timestamp: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  tagged: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: -spacing.xs,
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
});
