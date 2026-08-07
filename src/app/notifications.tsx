import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { NotificationCard } from '@/components/notification/notification-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ControlHeight, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';

const notificationSettingOptions = [
  ['deadline', '마감 일정'],
  ['ideareview', '검토 필요'],
  ['finalselection', '최종 선정'],
  ['stalledidea', '진행 정체'],
  ['feedback', '피드백'],
  ['likesurge', '공감'],
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
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="screenTitle">알림</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                마감과 피드백처럼 확인이 필요한 소식을 모았어요.
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              {unreadCount > 0 ? (
                <Pressable
                  onPress={markAllAsRead}
                  style={({ pressed }) => [
                    styles.readAllButton,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={[styles.readAllText, { color: theme.primary }]}>
                    모두 읽음
                  </ThemedText>
                </Pressable>
              ) : null}
              {notifications.length > 0 ? (
                <Pressable
                  onPress={() => setIsDeleteConfirmOpen(true)}
                  style={({ pressed }) => [
                    styles.deleteAllButton,
                    { borderColor: theme.danger },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={[styles.deleteAllText, { color: theme.danger }]}>
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

          <ThemedView
            type="backgroundElement"
            style={[styles.settingsPanel, { borderColor: theme.border }, Shadows.card]}>
            <View style={styles.settingsHeader}>
              <View style={styles.settingsTitleBlock}>
                <ThemedText type="smallBold" style={styles.settingsTitle}>알림 설정</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  받고 싶은 알림 유형과 마감 알림 시점을 관리하세요.
                </ThemedText>
              </View>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.settingsGrid}>
              {notificationSettingOptions.map(([key, label]) => {
                const settingKey = key as keyof typeof notificationSettings;
                const isEnabled = Boolean(notificationSettings[settingKey]);

                return (
                  <Pressable
                    key={key}
                    onPress={() => updateNotificationSettings({ [settingKey]: !isEnabled })}
                    style={({ pressed }) => [
                      styles.settingToggle,
                      { borderColor: theme.border },
                      isEnabled && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: isEnabled ? theme.primary : theme.textSecondary }}>
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
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
            <LoadingSkeleton rows={4} />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon="notifications"
              title="새로운 알림이 없어요"
              description="마감이나 피드백이 생기면 이곳에서 알려드릴게요."
              actionLabel="과제 보기"
              onAction={() => router.push('/projects' as Href)}
            />
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
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.confirmPanel, { borderColor: theme.danger }, Shadows.floating]}>
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
    gap: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  backButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
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
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  readAllText: {
    fontWeight: '700',
  },
  deleteAllButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  deleteAllText: {
    fontWeight: '700',
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
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  settingsHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  settingsTitleBlock: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
  },
  settingsTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  bulkFilterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  bulkFilterButton: {
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderColor: '#B9C2FF',
    borderRadius: Radius.medium,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  bulkFilterText: {
    color: '#4050D0',
  },
  settingsGrid: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  settingToggle: {
    flexShrink: 0,
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Radius.pill,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  settingText: {
    color: '#475569',
  },
  activeSettingText: {
    color: '#3442B8',
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
    width: ControlHeight.touch,
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Radius.large,
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
    padding: Spacing.three,
  },
  confirmPanel: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
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
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  confirmDeleteButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    borderRadius: Radius.medium,
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
