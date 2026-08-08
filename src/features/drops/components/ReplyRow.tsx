import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/shared/components/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { formatRelativeTime } from '@/shared/utils/format';
import type { DropReply } from '@/features/drops/api/drops';

type Props = {
  reply: DropReply;
};

export const ReplyRow = memo(function ReplyRow({ reply }: Props) {
  return (
    <View style={styles.row}>
      <Avatar uri={reply.profiles?.avatar_url} name={reply.profiles?.display_name} size={22} />
      <View style={styles.content}>
        <Text style={styles.body}>
          <Text style={styles.author}>{reply.profiles?.display_name ?? 'Someone'} </Text>
          {reply.body}
        </Text>
        <Text style={styles.timestamp}>{formatRelativeTime(reply.created_at)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  content: {
    flex: 1,
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
