import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
export function RoomBreadcrumb({ roomName, title }: { roomName?: string; title: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
    <Pressable accessibilityRole="link" accessibilityLabel={`${roomName ?? '방'} 목록으로 이동`} onPress={() => router.push('/rooms')} style={{ flexShrink: 1, minWidth: 0, paddingVertical: 12 }}><ThemedText numberOfLines={2}>{roomName ?? '방'}</ThemedText></Pressable>
    <ThemedText>/</ThemedText><ThemedText numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>{title}</ThemedText>
  </View>;
}
