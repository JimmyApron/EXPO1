import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

function storedTokenKey(userId: string) {
  return `notification-device-token:${userId}`;
}

export async function enableDevicePush(userId: string): Promise<string> {
  if (Platform.OS === 'web') return '웹에서는 앱 안 알림을 사용할 수 있어요.';
  const Notifications = await import('expo-notifications');
  await Notifications.setNotificationChannelAsync('personal', {
    name: '개인 과제', importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('team', {
    name: '팀 활동', importance: Notifications.AndroidImportance.DEFAULT,
  });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return '기기 알림 권한이 꺼져 있어요. 기기 설정에서 허용해 주세요.';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return '푸시용 Expo 프로젝트 ID가 아직 설정되지 않았어요.';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const previous = await AsyncStorage.getItem(storedTokenKey(userId));
  if (previous && previous !== token) {
    await supabase.from('notification_devices').delete().eq('token', previous).eq('userid', userId);
  }
  const { error } = await supabase.from('notification_devices').upsert({
    token, userid: userId, platform: Platform.OS, updatedat: new Date().toISOString(),
  }, { onConflict: 'token' });
  if (error) throw error;
  await AsyncStorage.setItem(storedTokenKey(userId), token);
  return '';
}

export async function disableDevicePush(userId: string) {
  const token = await AsyncStorage.getItem(storedTokenKey(userId));
  if (!token) return;
  const { error } = await supabase.from('notification_devices').delete().eq('token', token).eq('userid', userId);
  if (error) throw error;
  await AsyncStorage.removeItem(storedTokenKey(userId));
}
