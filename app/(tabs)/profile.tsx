import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Avatar } from '@/shared/components/Avatar';
import { MessagesIcon } from '@/features/messages/components/MessagesIcon';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { useUpdateAvatar } from '@/features/auth/hooks/use-update-avatar';
import { supabase } from '@/shared/supabase/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuthContext();
  const updateAvatarMutation = useUpdateAvatar();
  const uploadingAvatar = updateAvatarMutation.isPending;

  async function onChangeAvatar() {
    const userId = profile?.id ?? session?.user?.id;
    if (!userId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access in Settings to set a profile photo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    try {
      await updateAvatarMutation.mutateAsync({
        userId,
        media: {
          uri: asset.uri,
          mediaType: 'image',
          mimeType: asset.mimeType ?? 'image/jpeg',
        },
      });
      await refreshProfile();
    } catch (error) {
      Alert.alert(
        'Could not update photo',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    // Session clears -> root layout's Stack.Protected sends us to (auth).
  }

  return (
    <ScreenContainer>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Profile</Text>
        <MessagesIcon />
      </View>

      <Pressable style={styles.avatarRow} onPress={onChangeAvatar} disabled={uploadingAvatar}>
        <Avatar uri={profile?.avatar_url} name={profile?.display_name} size={72} />
        <Text style={styles.avatarLabel}>{uploadingAvatar ? 'Uploading…' : 'Change photo'}</Text>
      </Pressable>

      <Card style={styles.card}>
        <Text style={styles.label}>Display name</Text>
        <Text style={styles.value}>{profile?.display_name ?? '—'}</Text>

        <Text style={[styles.label, styles.spaced]}>Role</Text>
        <Text style={styles.value}>{profile?.role ?? '—'}</Text>

        <Text style={[styles.label, styles.spaced]}>Signed in as</Text>
        <Text style={styles.valueSmall}>{session?.user?.email ?? session?.user?.phone}</Text>
      </Card>

      <View style={styles.links}>
        <Button
          label="Collections"
          variant="secondary"
          inline
          onPress={() => router.push('/collections')}
        />
        <Button label="Events" variant="secondary" inline onPress={() => router.push('/events')} />
        <Button
          label={profile?.role === 'owner' ? 'Owner dashboard' : 'Claim a place'}
          variant="secondary"
          inline
          onPress={() => router.push(profile?.role === 'owner' ? '/owner' : '/owner/claim')}
        />
      </View>
      <Button label="my diary" variant="ghost" onPress={() => router.push('/diary')} />

      <View style={styles.footer}>
        <Button label="Sign out" variant="ghost" onPress={onSignOut} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xxl,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.raspberry,
  },
  card: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
  spaced: {
    marginTop: spacing.md,
  },
  value: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  valueSmall: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
