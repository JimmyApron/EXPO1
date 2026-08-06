import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

export type AppIconName =
  | 'home'
  | 'projects'
  | 'rooms'
  | 'notifications'
  | 'profile'
  | 'add'
  | 'arrowRight'
  | 'chevronRight'
  | 'more'
  | 'like'
  | 'favorite'
  | 'filter'
  | 'search'
  | 'logout'
  | 'camera'
  | 'edit'
  | 'lock'
  | 'delete'
  | 'info'
  | 'feedback'
  | 'schedule'
  | 'idea'
  | 'close';

const names: Record<AppIconName, SymbolViewProps['name']> = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  projects: { ios: 'checklist', android: 'assignment', web: 'assignment' },
  rooms: { ios: 'person.3.fill', android: 'group', web: 'group' },
  notifications: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  profile: { ios: 'person.crop.circle.fill', android: 'person', web: 'person' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  like: { ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' },
  favorite: { ios: 'star.fill', android: 'star', web: 'star' },
  filter: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  delete: { ios: 'trash.fill', android: 'delete', web: 'delete' },
  info: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  feedback: { ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' },
  schedule: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  idea: { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
};

const fallbacks: Record<AppIconName, string> = {
  home: '⌂',
  projects: '✓',
  rooms: '●',
  notifications: '●',
  profile: '●',
  add: '+',
  arrowRight: '→',
  chevronRight: '›',
  more: '⋯',
  like: '♥',
  favorite: '★',
  filter: '≡',
  search: '⌕',
  logout: '↗',
  camera: '●',
  edit: '✎',
  lock: '●',
  delete: '×',
  info: 'i',
  feedback: '●',
  schedule: '◷',
  idea: '●',
  close: '×',
};

type AppIconProps = {
  name: AppIconName;
  color: string;
  size?: number;
};

export function AppIcon({ name, color, size = 24 }: AppIconProps) {
  return (
    <View pointerEvents="none" style={[styles.container, { width: size, height: size }]}>
      <SymbolView
        name={names[name]}
        size={size}
        tintColor={color}
        fallback={<Text style={[styles.fallback, { color, fontSize: size * 0.78 }]}>{fallbacks[name]}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
});
