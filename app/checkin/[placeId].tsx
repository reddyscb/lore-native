import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { TextField } from '@/shared/components/TextField';
import { Button } from '@/shared/components/Button';
import { colors, fontFamily, fontSize, spacing } from '@/shared/theme/theme';
import { useAuthContext } from '@/features/auth/hooks/use-auth-context';
import { usePlace } from '@/features/places/hooks/use-place';
import { useCreateDiaryEntry } from '@/features/passport/hooks/use-create-diary-entry';

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/RouteErrorBoundary';

export default function CheckInScreen() {
  const router = useRouter();
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { profile, session } = useAuthContext();
  const ownerId = profile?.id ?? session?.user?.id ?? '';

  const { data: place, isLoading: loading } = usePlace(placeId);
  const createDiaryEntryMutation = useCreateDiaryEntry();

  const [dish, setDish] = useState('');
  const [whoWith, setWhoWith] = useState('');
  const [spend, setSpend] = useState('');
  const [note, setNote] = useState('');

  async function onSubmit() {
    if (!ownerId || !placeId) return;
    try {
      // Match the web's parsing: strip everything non-numeric, and treat an
      // empty or unparseable value as "didn't say" rather than zero.
      const spendDigits = spend.replace(/[^0-9]/g, '');
      await createDiaryEntryMutation.mutateAsync({
        owner_id: ownerId,
        place_id: placeId,
        dish: dish.trim() || undefined,
        who_with: whoWith.trim() || undefined,
        spend: spendDigits ? Number(spendDigits) : undefined,
        note: note.trim() || undefined,
      });
      router.replace({ pathname: '/(tabs)/passport', params: { stamped: '1' } });
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    }
  }

  const submitting = createDiaryEntryMutation.isPending;

  if (loading) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <ActivityIndicator color={colors.raspberry} />
      </ScreenContainer>
    );
  }

  if (!place) {
    return (
      <ScreenContainer hasHeader style={styles.centered}>
        <Text style={styles.empty}>Couldn&apos;t find this café.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasHeader padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PageHeader
            eyebrow="Private — only you can see this"
            title={`Remember ${place.name}`}
            subtitle="This also unlocks a passport stamp for this place."
          />

          <TextField
            label="What did you order"
            value={dish}
            onChangeText={setDish}
            style={styles.field}
          />
          <TextField
            label="Who were you with"
            value={whoWith}
            onChangeText={setWhoWith}
            style={styles.field}
          />
          <TextField
            label="You spent"
            placeholder="₹"
            keyboardType="numeric"
            value={spend}
            onChangeText={setSpend}
            style={styles.field}
          />
          <TextField
            label="A little memory"
            placeholder="What made it worth remembering…"
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
            style={[styles.field, styles.multiline]}
          />

          <Button
            label={submitting ? 'Saving…' : 'Save to my diary'}
            onPress={onSubmit}
            loading={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  empty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
