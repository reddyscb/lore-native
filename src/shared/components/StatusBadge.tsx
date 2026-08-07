import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/shared/theme/theme';

type Props = {
  status: string;
  reopenDate?: string | null;
};

const LABELS: Record<string, string> = {
  open: 'Open',
  'temp-closed': 'Temporarily closed',
  'perm-closed': 'Closed for good',
};

export function StatusBadge({ status, reopenDate }: Props) {
  const isOpen = status === 'open';
  const label = LABELS[status] ?? status;

  return (
    <View style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
      <Text style={[styles.label, isOpen ? styles.labelOpen : styles.labelClosed]}>
        {label}
        {status === 'temp-closed' && reopenDate ? ` · back ${reopenDate}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
  },
  badgeOpen: {
    backgroundColor: colors.paper,
    borderColor: colors.teal,
  },
  badgeClosed: {
    backgroundColor: colors.paper,
    borderColor: colors.danger,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  labelOpen: {
    color: colors.teal,
  },
  labelClosed: {
    color: colors.danger,
  },
});
