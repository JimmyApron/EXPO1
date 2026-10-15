import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AppNavigation } from '@/components/app-navigation';

export default function AppTabs() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    let lastId = '';
    const open = (data?: Record<string, unknown>) => {
      if (!data) return;
      const id = data.notificationId;
      const target = data.target;
      if (typeof id !== 'string' || id === lastId || typeof target !== 'string') return;
      if (!(target === '/rooms' || /^\/projects\/[0-9a-f-]{36}(\?.*)?$/i.test(target))) return;
      lastId = id;
      router.push('/notifications' as Href);
      router.push(target as Href);
    };
    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      const last = Notifications.getLastNotificationResponse();
      if (last) open(last.notification.request.content.data);
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        open(response.notification.request.content.data);
      });
    });
    return () => { active = false; subscription?.remove(); };
  }, []);
  return <AppNavigation />;
}
