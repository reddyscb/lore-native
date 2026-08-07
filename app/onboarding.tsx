import { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';

import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { TextField } from '@/shared/components/TextField';
import { Chip } from '@/shared/components/Chip';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { supabase } from '@/shared/supabase/supabase';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

type Role = 'seeker' | 'owner';

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuthContext();
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('seeker');
  const [loading, setLoading] = useState(false);

  async function onSave() {
    if (!session?.user || displayName.trim().length < 2) {
      Alert.alert('Almost there', 'Enter a name with at least 2 characters.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        display_name: displayName.trim(),
        role,
        onboarded: true,
      });
    if (error) {
      setLoading(false);
      Alert.alert('Could not save', error.message);
      return;
    }

    // Pull the fresh profile (onboarded: true) into the auth context —
    // that flips the guard in app/_layout.tsx over to (tabs) automatically.
    await refreshProfile();
    setLoading(false);
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>One last thing</Text>
        <Text style={styles.subtitle}>What should we call you?</Text>

        <TextField
          label="Display name"
          placeholder="e.g. Nymisha"
          autoFocus
          value={displayName}
          onChangeText={setDisplayName}
        />

        <View style={styles.roleRow}>
          <Chip label="I'm exploring" selected={role === 'seeker'} onPress={() => setRole('seeker')} />
          <Chip label="I own a place" selected={role === 'owner'} onPress={() => setRole('owner')} />
        </View>

        <Button label="Let's go" onPress={onSave} loading={loading} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    marginTop: -spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
