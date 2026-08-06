import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { supabase } from '@/lib/supabase';
import { updateAvatar } from '@/lib/queries';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuthContext();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

    setUploadingAvatar(true);
    try {
      await updateAvatar(userId, {
        uri: asset.uri,
        mediaType: 'image',
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      await refreshProfile();
    } catch (error) {
      Alert.alert(
        'Could not update photo',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    // Session clears -> root layout's Stack.Protected sends us to (auth).
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Profile</Text>

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
      </View>
      <Button label="my diary" variant="ghost" onPress={() => router.push('/diary')} />

      <View style={styles.footer}>
        <Button label="Sign out" variant="ghost" onPress={onSignOut} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
