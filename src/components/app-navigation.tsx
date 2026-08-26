import { router, Slot, useGlobalSearchParams, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { BrandIcon } from '@/components/brand-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjects } from '@/hooks/use-projects';
import { resolveProjectWorkspaceLocation, type ProjectSection } from '@/lib/project-workspace';

// 🎨 네비게이션 테마 팔레트
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지 (선택 탭 아이콘/텍스트)
  primaryDark: '#D97706',    // 딥 오렌지
  activeBg: '#FEF3C7',       // 활성 탭 배경 연노랑
  sidebarBg: '#FAF7F2',      // 사이드바/하단탭 크림색
  border: '#EFE6D8',         // 테두리 구분선
  text: '#1E293B',           // 짙은 네이비
  textInactive: '#94A3B8',   // 비활성 텍스트
  badgeBg: '#EF4444',        // 알림 배지 레드
  contentBg: '#FAF7F2',      // 본문 배경
};

type NavigationItem = {
  label: string;
  href: Href;
  icon: AppIconName;
  matches: (pathname: string) => boolean;
};

const projectSections: { id: ProjectSection; label: string; icon: AppIconName }[] = [
  { id: 'home', label: '과제 홈', icon: 'home' },
  { id: 'ideas', label: '아이디어 목록', icon: 'projects' },
  { id: 'mindmap', label: '마인드맵', icon: 'idea' },
];

const items: NavigationItem[] = [
  { label: '홈', href: '/', icon: 'home', matches: (path) => path === '/' },
  {
    label: '과제',
    href: '/projects' as Href,
    icon: 'projects',
    matches: (path) =>
      path.startsWith('/projects') ||
      ['/coach', '/mvp-generator', '/presentation'].some((route) => path.startsWith(route)),
  },
  { label: '방', href: '/rooms' as Href, icon: 'rooms', matches: (path) => path.startsWith('/rooms') },
  { label: '알림', href: '/notifications', icon: 'notifications', matches: (path) => path.startsWith('/notifications') },
  { label: '내 정보', href: '/profile' as Href, icon: 'profile', matches: (path) => path.startsWith('/profile') },
];

export function AppNavigation() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    id?: string;
    ideaTab?: string;
    projectView?: string;
    flowStep?: string;
  }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { projects } = useProjects();
  const { unreadCount } = useNotifications(projects);
  const isProjectDetail = /^\/projects\/[^/]+$/.test(pathname);
  const routeProjectId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fallbackProjectId = isProjectDetail ? pathname.slice('/projects/'.length) : '';
  const projectId = routeProjectId || fallbackProjectId;
  const projectLocation = resolveProjectWorkspaceLocation(params);

  const navigationItems: NavigationItem[] = isProjectDetail && projectId
    ? projectSections.map((section) => ({
        label: section.label,
        icon: section.icon,
        href: `/projects/${encodeURIComponent(projectId)}?projectView=${section.id}&flowStep=${projectLocation.step}` as Href,
        matches: () => projectLocation.section === section.id,
      }))
    : items;

  const navigation = (
    <SafeAreaView
      edges={isWide ? ['top', 'bottom', 'left'] : ['bottom']}
      style={[
        isWide ? styles.sidebar : styles.bottomBar,
        { backgroundColor: PALETTE.sidebarBg, borderColor: PALETTE.border },
      ]}>
      {isWide ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Watt 홈"
          onPress={() => router.replace('/')}
          style={styles.brand}>
          <BrandIcon size={36} />
          <ThemedText style={styles.brandTitle}>Watt</ThemedText>
        </Pressable>
      ) : null}

      <View style={isWide ? styles.sideItems : styles.bottomItems}>
        {navigationItems.map((item) => {
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
                selected && { backgroundColor: PALETTE.activeBg },
                pressed && styles.pressed,
              ]}>
              <View style={styles.iconWrap}>
                <AppIcon
                  name={item.icon}
                  color={selected ? PALETTE.primaryDark : PALETTE.textInactive}
                  size={isWide ? 22 : 24}
                />
                {badge > 0 ? (
                  <View style={[styles.badge, { backgroundColor: PALETTE.badgeBg }]}>
                    <ThemedText style={styles.badgeText}>
                      {badge > 99 ? '99+' : badge}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText
                numberOfLines={1}
                style={[
                  isWide ? styles.sideLabel : styles.bottomLabel,
                  { color: selected ? PALETTE.primaryDark : PALETTE.textInactive },
                  selected && styles.selectedLabel,
                ]}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {isWide ? (
        <ThemedText style={styles.sideFooter}>
          {isProjectDetail ? '⚡ 과제 작업 공간' : '아이디어에서 결과물까지'}
        </ThemedText>
      ) : null}
    </SafeAreaView>
  );

  return (
    <View style={[styles.root, isWide && styles.wideRoot, { backgroundColor: PALETTE.contentBg }]}>
      {isWide ? navigation : null}
      <View style={styles.content}>
        <Slot />
      </View>
      {!isWide ? navigation : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wideRoot: { flexDirection: 'row' },
  content: { flex: 1, minWidth: 0 },
  sidebar: {
    width: 220,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  brand: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: PALETTE.text,
    letterSpacing: -0.5,
  },
  sideItems: { flex: 1, gap: 6 },
  sideItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  sideLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedLabel: {
    fontWeight: '800',
  },
  sideFooter: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    fontSize: 12,
    color: PALETTE.textInactive,
  },
  bottomBar: {
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  bottomItems: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: Spacing.one,
    paddingTop: 4,
  },
  bottomItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: Radius.small,
  },
  bottomLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  pressed: { opacity: 0.72 },
});