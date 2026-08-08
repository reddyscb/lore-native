import { useEffect, useRef } from 'react';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { usePostHog } from 'posthog-react-native';

/**
 * Requests App Tracking Transparency permission once `userId` is set (call
 * with `undefined` while logged out or mid-onboarding), then opts the
 * PostHog client in or out to match — analytics stays off (the
 * PostHogProvider is configured with `defaultOptIn: false`) until this
 * resolves to `granted`.
 */
export function useTrackingTransparency(userId: string | undefined) {
  const posthog = usePostHog();
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || requestedFor.current === userId) return;
    requestedFor.current = userId;

    (async () => {
      const { status: existingStatus } = await getTrackingPermissionsAsync();
      let status = existingStatus;
      if (status === 'undetermined') {
        ({ status } = await requestTrackingPermissionsAsync());
      }
      if (status === 'granted') {
        await posthog?.optIn();
      } else {
        await posthog?.optOut();
      }
    })().catch((error) => {
      // console.warn surfaces React Native's "Open debugger to view
      // warnings" banner over the tab bar on mount — see
      // use-push-notifications.ts and CLAUDE.md's Maestro gotchas for the
      // same issue; console.log avoids it.
      console.log('Tracking transparency request failed:', error);
    });
  }, [userId, posthog]);
}
