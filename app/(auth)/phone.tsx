import { useState } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { router } from 'expo-router';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, fontFamily, fontSize, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function PhoneScreen() {
  const [phone, setPhone] = useState(''); // E.164, e.g. +919876543210
  const [loading, setLoading] = useState(false);

  async function onSendCode() {
    if (!phone.startsWith('+') || phone.length < 8) {
      Alert.alert('Check the number', 'Enter your phone number in international format, e.g. +91 98765 43210.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);

    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { phone } });
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>What&apos;s your number?</Text>
        <Text style={styles.subtitle}>We&apos;ll text you a code to confirm it&apos;s you.</Text>

        <TextField
          label="Phone number"
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          autoFocus
          value={phone}
          onChangeText={setPhone}
        />

        <Button label="Send code" onPress={onSendCode} loading={loading} />
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
