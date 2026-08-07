import { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { OtpInput } from '@/features/auth/components/OtpInput';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { supabase } from '@/shared/supabase/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    if (code.length !== 6) return;

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setLoading(false);

    if (error) {
      Alert.alert('That code didn\'t work', error.message);
      setCode('');
      return;
    }
    // Session is now set — root layout's Stack.Protected routes onward.
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {phone}.</Text>

        <OtpInput value={code} onChange={setCode} />

        <Button label="Verify" onPress={onVerify} loading={loading} disabled={code.length !== 6} />
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
});
