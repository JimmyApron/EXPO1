import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationCard } from '@/components/notification/notification-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';

const notificationSettingOptions = [
  ['deadline', 'Deadline'],
  ['ideareview', 'Review'],
  ['finalselection', 'Final'],
  ['stalledidea', 'Stalled'],
  ['feedback', 'Feedback'],
  ['likesurge', 'Likes'],
] as const;

export default function NotificationsScreen() {
  const { projects, isloadingprojects, projecterror } = useProjects();
  const {
    notifications,
    unreadCount,
    isLoadingNotifications,
    notificationError,
    notificationSettings,
    updateNotificationSettings,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications(projects);
  const theme = useTheme();
  const isLoading = isloadingprojects || isLoadingNotifications;
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const setAllNotificationFilters = (isEnabled: boolean) => {
    updateNotificationSettings(
      Object.fromEntries(notificationSettingOptions.map(([key]) => [key, isEnabled])),
    );
  };

  const handleConfirmDeleteAll = () => {
    deleteAllNotifications();
    setIsDeleteConfirmOpen(false);
  };

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
            <View style={styles.headerActions}>
              {unreadCount > 0 ? (
                <Pressable onPress={markAllAsRead} style={({ pressed }) => [styles.readAllButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.readAllText}>
                    모두 읽음
                  </ThemedText>
                </Pressable>
              ) : null}
              {notifications.length > 0 ? (
                <Pressable onPress={() => setIsDeleteConfirmOpen(true)} style={({ pressed }) => [styles.deleteAllButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.deleteAllText}>
                    모두 삭제
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.summary}>
            <ThemedText type="smallBold">전체 {notifications.length}개</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              읽지 않음 {unreadCount}개
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.settingsPanel}>
            <View style={styles.settingsHeader}>
              <ThemedText type="smallBold">Notification settings</ThemedText>
              <View style={styles.bulkFilterActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="알림 필터 전체 선택"
                  onPress={() => setAllNotificationFilters(true)}
                  style={({ pressed }) => [styles.bulkFilterButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.bulkFilterText}>
                    전체 선택
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="알림 필터 전체 해제"
                  onPress={() => setAllNotificationFilters(false)}
                  style={({ pressed }) => [styles.bulkFilterButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.bulkFilterText}>
                    전체 해제
                  </ThemedText>
                </Pressable>
              </View>
            </View>
            <View style={styles.settingsGrid}>
              {notificationSettingOptions.map(([key, label]) => {
                const settingKey = key as keyof typeof notificationSettings;
                const isEnabled = Boolean(notificationSettings[settingKey]);

                return (
                  <Pressable
                    key={key}
                    onPress={() => updateNotificationSettings({ [settingKey]: !isEnabled })}
                    style={({ pressed }) => [
                      styles.settingToggle,
                      isEnabled && styles.activeSettingToggle,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={isEnabled ? styles.activeSettingText : styles.settingText}>
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.settingStepperRow}>
              <ThemedText type="small" themeColor="textSecondary">
                마감 {notificationSettings.deadlinedays}일 전부터 알림
              </ThemedText>
              <View style={styles.stepperButtons}>
                <Pressable
                  onPress={() =>
                    updateNotificationSettings({ deadlinedays: Math.max(1, notificationSettings.deadlinedays - 1) })
                  }
                  style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">-</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    updateNotificationSettings({ deadlinedays: Math.min(14, notificationSettings.deadlinedays + 1) })
                  }
                  style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">+</ThemedText>
                </Pressable>
              </View>
            </View>
          </ThemedView>

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
                  onOpenProject={() => router.push(`/projects/${notification.projectid}` as Href)}
                />
              ))}
            </View>
          )}
        </ThemedView>
      </SafeAreaView>

      <Modal visible={isDeleteConfirmOpen} transparent animationType="fade" onRequestClose={() => setIsDeleteConfirmOpen(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.confirmPanel, { backgroundColor: theme.background }]}>
            <View style={styles.confirmCopy}>
              <ThemedText type="smallBold" style={styles.confirmTitle}>
                알림을 모두 삭제할까요?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                현재 보이는 알림 {notifications.length}개가 목록에서 사라집니다.
              </ThemedText>
            </View>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setIsDeleteConfirmOpen(false)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold">취소</ThemedText>
              </Pressable>
              <Pressable onPress={handleConfirmDeleteAll} style={({ pressed }) => [styles.confirmDeleteButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.confirmDeleteText}>
                  삭제
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
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
  deleteAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  deleteAllText: {
    color: '#dc2626',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.three,
  },
  settingsPanel: {
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  settingsHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  bulkFilterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  bulkFilterButton: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  bulkFilterText: {
    color: '#2563eb',
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  settingToggle: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  activeSettingToggle: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  settingText: {
    color: '#475569',
  },
  activeSettingText: {
    color: '#1d4ed8',
  },
  settingStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  stepperButton: {
    width: 36,
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    padding: Spacing.three,
  },
  confirmPanel: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  confirmCopy: {
    gap: Spacing.one,
  },
  confirmTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  cancelButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  confirmDeleteButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#dc2626',
    paddingHorizontal: Spacing.three,
  },
  confirmDeleteText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.72,
  },
});
