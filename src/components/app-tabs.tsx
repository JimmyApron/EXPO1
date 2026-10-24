import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AppNavigation } from '@/components/app-navigation';

export default function AppTabs() {
  useEffect(() => {
    if (Platform.OS === 'web' || (Platform.OS === 'android' && Constants.appOwnership === 'expo')) return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    let lastId = '';
    const open = (data?: Record<string, unknown>) => {
      if (!data) return false;
      const id = data.notificationId;
      const target = data.target;
      if (typeof id !== 'string' || id === lastId || typeof target !== 'string') return false;
      if (!(target === '/rooms' || /^\/projects\/[0-9a-f-]{36}(\?.*)?$/i.test(target))) return false;
      lastId = id;
      router.push('/notifications' as Href);
      router.push(target as Href);
      return true;
    };
    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      const last = Notifications.getLastNotificationResponse();
      if (last && open(last.notification.request.content.data)) Notifications.clearLastNotificationResponse();
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        if (open(response.notification.request.content.data)) Notifications.clearLastNotificationResponse();
      });
    });
    return () => { active = false; subscription?.remove(); };
  }, []);
  return <AppNavigation />;
}
