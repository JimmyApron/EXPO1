import { router, Slot, type Href, usePathname } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { BrandIcon } from '@/components/brand-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';

type NavigationItem = {
  label: string;
  href: Href;
  icon: AppIconName;
  matches: (pathname: string) => boolean;
};

const items: NavigationItem[] = [
  { label: '홈', href: '/', icon: 'home', matches: (path) => path === '/' },
  {
    label: '과제',
    href: '/projects' as Href,
    icon: 'projects',
    matches: (path) => path.startsWith('/projects') || ['/coach', '/mvp-generator', '/presentation'].some((route) => path.startsWith(route)),
  },
  { label: '방', href: '/rooms' as Href, icon: 'rooms', matches: (path) => path.startsWith('/rooms') },
  { label: '알림', href: '/notifications', icon: 'notifications', matches: (path) => path.startsWith('/notifications') },
  { label: '내 정보', href: '/profile' as Href, icon: 'profile', matches: (path) => path.startsWith('/profile') },
];

export function AppNavigation() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const isWide = width >= 900;
  const { projects } = useProjects();
  const { unreadCount } = useNotifications(projects);

  const navigation = (
    <SafeAreaView
      edges={isWide ? ['top', 'bottom', 'left'] : ['bottom']}
      style={[
        isWide ? styles.sidebar : styles.bottomBar,
        { backgroundColor: theme.surface, borderColor: theme.divider },
      ]}>
      {isWide ? (
        <Pressable accessibilityRole="link" accessibilityLabel="Watt 홈" onPress={() => router.replace('/')} style={styles.brand}>
          <BrandIcon size={40} />
          <ThemedText type="sectionTitle">Watt</ThemedText>
        </Pressable>
      ) : null}

      <View style={isWide ? styles.sideItems : styles.bottomItems}>
        {items.map((item) => {
          const selected = item.matches(pathname);
          const badge = item.icon === 'notifications' ? unreadCount : 0;

          return (
            <Pressable
              key={item.label}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [
                isWide ? styles.sideItem : styles.bottomItem,
                selected && { backgroundColor: theme.primarySoft },
                pressed && styles.pressed,
              ]}>
              <View style={styles.iconWrap}>
                <AppIcon name={item.icon} color={selected ? theme.primary : theme.textTertiary} size={23} />
                {badge > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                    <ThemedText style={styles.badgeText}>{badge > 99 ? '99+' : badge}</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText
                type="captionStrong"
                numberOfLines={1}
                style={{ color: selected ? theme.primary : theme.textSecondary }}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {isWide ? (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.sideFooter}>
          아이디어에서 결과물까지
        </ThemedText>
      ) : null}
    </SafeAreaView>
  );

  return (
    <View style={[styles.root, isWide && styles.wideRoot, { backgroundColor: theme.background }]}>
      {isWide ? navigation : null}
      <View style={styles.content}><Slot /></View>
      {!isWide ? navigation : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wideRoot: { flexDirection: 'row' },
  content: { flex: 1, minWidth: 0 },
  sidebar: { width: 228, borderRightWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  brand: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two, marginBottom: Spacing.four },
  sideItems: { flex: 1, gap: Spacing.one },
  sideItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  sideFooter: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.two },
  bottomBar: { borderTopWidth: 1 },
  bottomItems: { minHeight: 62, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: Spacing.one, paddingTop: 5 },
  bottomItem: { flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: Radius.medium },
  iconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -7, right: -12, minWidth: 17, height: 17, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '800' },
  pressed: { opacity: 0.68 },
});
