import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationCard } from '@/components/notification/notification-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';

export default function NotificationsScreen() {
  const { projects, isloadingprojects, projecterror } = useProjects();
  const {
    notifications,
    unreadCount,
    isLoadingNotifications,
    notificationError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(projects);
  const theme = useTheme();
  const isLoading = isloadingprojects || isLoadingNotifications;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary">
              ← 홈으로
            </ThemedText>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="subtitle">알림</ThemedText>
              <ThemedText themeColor="textSecondary">
                마감 일정과 확인이 필요한 아이디어를 모아 보여드립니다.
              </ThemedText>
            </View>
            {unreadCount > 0 ? (
              <Pressable onPress={markAllAsRead} style={({ pressed }) => [styles.readAllButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.readAllText}>
                  모두 읽음
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.summary}>
            <ThemedText type="smallBold">전체 {notifications.length}개</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              읽지 않음 {unreadCount}개
            </ThemedText>
          </View>

          {projecterror || notificationError ? (
            <ThemedText type="small" style={styles.errorText}>
              {projecterror || notificationError}
            </ThemedText>
          ) : null}

          {isLoading ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ActivityIndicator />
            </ThemedView>
          ) : notifications.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="smallBold">새로운 알림이 없습니다.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                확인이 필요한 일정이나 아이디어가 생기면 이곳에 표시됩니다.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.list}>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                  onOpenProject={() => router.push(`/projects/${notification.projectId}` as Href)}
                />
              ))}
            </View>
          )}
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: BottomTabInset + Spacing.four,
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    minWidth: 240,
    gap: Spacing.two,
  },
  readAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  readAllText: {
    color: '#2563eb',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.72,
  },
});
