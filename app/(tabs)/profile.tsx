import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/use-auth-context';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile, session } = useAuthContext();

  async function onSignOut() {
    await supabase.auth.signOut();
    // Session clears -> root layout's Stack.Protected sends us to (auth).
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Profile</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>Display name</Text>
        <Text style={styles.value}>{profile?.display_name ?? '—'}</Text>

        <Text style={[styles.label, styles.spaced]}>Role</Text>
        <Text style={styles.value}>{profile?.role ?? '—'}</Text>

        <Text style={[styles.label, styles.spaced]}>Signed in as</Text>
        <Text style={styles.valueSmall}>{session?.user?.email ?? session?.user?.phone}</Text>
      </Card>

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
  footer: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
