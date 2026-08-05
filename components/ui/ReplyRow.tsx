import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { formatRelativeTime } from '@/lib/format';
import type { DropReply } from '@/lib/queries';

type Props = {
  reply: DropReply;
};

export function ReplyRow({ reply }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.body}>
        <Text style={styles.author}>{reply.profiles?.display_name ?? 'Someone'} </Text>
        {reply.body}
      </Text>
      <Text style={styles.timestamp}>{formatRelativeTime(reply.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  author: {
    fontFamily: fontFamily.bodyMedium,
  },
  timestamp: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
