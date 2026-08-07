import { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '@/lib/queries';

// expo-notifications itself (not just our own catch below) calls
// console.warn with this on every launch on the iOS Simulator — that's
// what was surfacing React Native's "Open debugger to view warnings"
// banner over the tab bar. The underlying limitation is real and
// unavoidable pre-physical-device, so the warning is expected noise, not
// something actionable.
LogBox.ignoreLogs(['obtaining a push token may not work on iOS simulators']);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests notification permission and registers this device's Expo push
 * token once `userId` is set (call with `undefined` while logged out or
 * mid-onboarding), then listens for taps on delivered notifications and
 * deep-links into the relevant café.
 */
export function usePushNotifications(userId: string | undefined) {
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || registeredFor.current === userId) return;
    registeredFor.current = userId;

    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let status = existingStatus;
      if (status !== 'granted') {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      if (status !== 'granted') return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(userId, token);
    })().catch((error) => {
      // console.warn (not .log) surfaces React Native's "Open debugger to
      // view warnings" banner, which renders on top of the tab bar and
      // doesn't auto-dismiss — a real problem on the iOS Simulator, where
      // this call always fails ("no valid aps-environment entitlement")
      // and would otherwise cover the tab bar on every single launch.
      console.log('Push notification registration failed:', error);
    });
  }, [userId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { placeId?: string; conversationId?: string }
        | undefined;
      if (data?.conversationId) {
        router.push(`/messages/${data.conversationId}`);
      } else if (data?.placeId) {
        router.push(`/place/${data.placeId}`);
      }
    });
    return () => subscription.remove();
  }, [router]);
}
