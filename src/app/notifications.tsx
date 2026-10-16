import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { NotificationCard } from '@/components/notification/notification-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, ControlHeight, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAppNotifications } from '@/hooks/use-app-notifications';
import { useTheme } from '@/hooks/use-theme';
import { notificationCategoryKeys, type NotificationCategory } from '@/lib/notification-settings';

type Filter = 'all' | 'personal' | 'team';
type BooleanSetting = { key: NotificationCategory; label: string };

const personalSettings: BooleanSetting[] = [
  { key: 'deadline', label: '마감 일정' },
  { key: 'ideareview', label: '아이디어 검토' },
  { key: 'finalselection', label: '최종 선정' },
  { key: 'stalledidea', label: '진행 정체' },
  { key: 'feedback', label: '내 아이디어 피드백' },
  { key: 'likesurge', label: '공감 증가' },
];
const teamSettings: BooleanSetting[] = [
  { key: 'team_evaluation', label: '평가 시작·완료' },
  { key: 'team_reminder', label: '익명 콕 찌르기' },
  { key: 'team_feedback', label: '내 아이디어 피드백' },
  { key: 'team_changes', label: '팀 과제 변경' },
  { key: 'team_room', label: '방·역할 소식' },
];

export default function NotificationsScreen() {
  const theme = useTheme();
  const {
    notifications, unreadCount, isLoading, error, preferences, updatePreferences,
    notificationsEnabled, notificationsEnabledReady, setNotificationsEnabled,
    enablePush, disablePush, markAsRead, markAllAsRead, deleteNotification,
    deleteAllNotifications,
  } = useAppNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const visible = useMemo(() => notifications.filter((item) => filter === 'all' || item.scope === filter), [filter, notifications]);

  const toggle = async (key: NotificationCategory) => {
    if (notificationBusy || !notificationsEnabledReady) return;
    setNotificationBusy(true);
    setLocalError('');
    const enabled = !preferences[key];
    const anyEnabled = notificationCategoryKeys.some((item) => item === key ? enabled : preferences[item]);
    try {
      if (enabled && !notificationsEnabled) {
        const pushMessage = Platform.OS === 'web' ? '' : await enablePush();
        await updatePreferences({ [key]: true, push_enabled: !pushMessage });
        setLocalError(pushMessage);
      } else if (!anyEnabled) {
        if (Platform.OS !== 'web') await disablePush();
        await updatePreferences({ [key]: false, push_enabled: false });
      } else {
        await updatePreferences({ [key]: enabled });
      }
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : '알림 설정을 저장하지 못했어요.');
    } finally { setNotificationBusy(false); }
  };
  const toggleNotifications = async (enabled: boolean) => {
    if (notificationBusy || !notificationsEnabledReady) return;
    setNotificationBusy(true);
    setLocalError('');
    try {
      if (Platform.OS !== 'web') {
        if (enabled) {
          const pushMessage = await enablePush();
          await setNotificationsEnabled(true, !pushMessage);
          setLocalError(pushMessage);
        } else {
          await disablePush();
          await setNotificationsEnabled(false, false);
        }
      } else {
        await setNotificationsEnabled(enabled);
      }
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : '알림 설정을 저장하지 못했어요.');
    } finally { setNotificationBusy(false); }
  };
  const setNumber = (key: 'deadlinedays' | 'stalledideadays' | 'likesurgethreshold' | 'quiet_start' | 'quiet_end', value: number) => {
    const minimum = key === 'quiet_start' || key === 'quiet_end' ? 0 : 1;
    const maximum = key === 'likesurgethreshold' ? 100 : key === 'quiet_start' || key === 'quiet_end' ? 23 : 14;
    void updatePreferences({ [key]: Math.max(minimum, Math.min(maximum, value)) }).catch((cause) => {
      setLocalError(cause instanceof Error ? cause.message : '세부 설정을 저장하지 못했어요.');
    });
  };
  const openNotification = (target?: string) => {
    if (!target || !(target.startsWith('/projects/') || target === '/rooms')) return;
    router.push(target as Href);
  };
  const confirmDeleteAll = async () => {
    await deleteAllNotifications();
    setDeleteConfirmOpen(false);
  };

  const settingRows = (items: BooleanSetting[]) => items.map(({ key, label }) => (
    <View key={key} style={[styles.settingRow, { borderBottomColor: theme.divider }]}>
      <ThemedText style={styles.settingLabel}>{label}</ThemedText>
      <Switch
        accessibilityLabel={`${label} 알림`}
        value={Boolean(preferences[key])}
        disabled={!notificationsEnabledReady || notificationBusy}
        onValueChange={() => void toggle(key)}
        trackColor={{ true: theme.primary }}
      />
    </View>
  ));
  const numberRow = (label: string, key: 'deadlinedays' | 'stalledideadays' | 'likesurgethreshold' | 'quiet_start' | 'quiet_end', unit: string) => (
    <View style={[styles.numberRow, { borderColor: theme.divider }]}>
      <ThemedText type="smallBold" style={styles.numberLabel}>{label}</ThemedText>
      <View style={styles.numberActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 줄이기`} hitSlop={4} onPress={() => setNumber(key, preferences[key] - 1)}
          style={[styles.numberButton, { borderColor: theme.border }]}><ThemedText type="smallBold">−</ThemedText></Pressable>
        <View style={[styles.numberValue, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.numberValueText, { color: theme.text }]}>{preferences[key]}{unit}</ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 늘리기`} hitSlop={4} onPress={() => setNumber(key, preferences[key] + 1)}
          style={[styles.numberButton, { borderColor: theme.border }]}><ThemedText type="smallBold">+</ThemedText></Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="screenTitle">알림</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">개인 과제와 팀 활동에서 필요한 소식을 모았어요.</ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="알림 설정 열기" accessibilityState={{ expanded: settingsOpen }}
              onPress={() => setSettingsOpen(true)} style={[styles.headerButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">알림 설정</ThemedText>
            </Pressable>
          </View>

          {error || localError ? <ThemedText style={{ color: theme.danger }} accessibilityLiveRegion="polite">{localError || error}</ThemedText> : null}

          <View style={styles.filterRow}>
            {([['all', '전체'], ['personal', '개인 과제'], ['team', '팀']] as const).map(([value, label]) => (
              <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }}
                onPress={() => setFilter(value)} style={[styles.filterButton, { borderColor: filter === value ? theme.primary : theme.border,
                  backgroundColor: filter === value ? theme.primarySoft : theme.background }]}>
                <ThemedText type="smallBold" style={{ color: filter === value ? theme.primary : theme.textSecondary }}>{label}</ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.summary}>
            <ThemedText type="smallBold">{visible.length}개</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">읽지 않음 {unreadCount}개</ThemedText>
          </View>
          {notifications.length > 0 ? <View style={styles.bulkActions}>
            {unreadCount > 0 ? <Pressable accessibilityRole="button" onPress={() => void markAllAsRead()} style={styles.textAction}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>모두 읽음</ThemedText>
            </Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => setDeleteConfirmOpen(true)} style={styles.textAction}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>모두 삭제</ThemedText>
            </Pressable>
          </View> : null}

          {isLoading || !notificationsEnabledReady ? <LoadingSkeleton rows={4} /> : visible.length === 0 ? (
            <EmptyState icon="notifications" title="새로운 알림이 없어요"
              description={filter === 'team' ? '팀에서 확인할 일이 생기면 여기에 표시돼요.' : '확인할 소식이 생기면 여기에 표시돼요.'}
              actionLabel="과제 보기" onAction={() => router.push('/projects' as Href)} />
          ) : <View style={styles.list}>{visible.map((notification) => (
            <NotificationCard key={notification.id} notification={notification}
              onRead={() => void markAsRead(notification.id)} onDelete={() => void deleteNotification(notification.id)}
              onOpenProject={() => openNotification(notification.target)} />
          ))}</View>}
        </View>
      </SafeAreaView>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView type="surfaceElevated" style={[styles.settingsPanel, { borderColor: theme.border }]}>
            <View style={styles.settingsHeader}>
              <ThemedText type="sectionTitle">알림 설정</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="알림 설정 닫기"
                onPress={() => setSettingsOpen(false)} style={styles.closeButton}>
                <ThemedText type="smallBold">닫기</ThemedText>
              </Pressable>
            </View>
            <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsContent} nestedScrollEnabled>
              <View style={[styles.settingRow, styles.masterSettingRow, { borderBottomColor: theme.divider }]}>
                <ThemedText style={[styles.settingLabel, styles.masterSettingLabel]}>알림 받기</ThemedText>
                <Switch accessibilityLabel="알림 받기" value={notificationsEnabled}
                  disabled={!notificationsEnabledReady || notificationBusy}
                  onValueChange={(enabled) => void toggleNotifications(enabled)}
                  trackColor={{ true: theme.primary }} style={styles.masterSwitch} />
              </View>
              <ThemedText type="sectionTitle">개인 과제</ThemedText>
              {settingRows(personalSettings)}
              <ThemedText type="sectionTitle" style={styles.teamHeading}>팀 활동</ThemedText>
              {settingRows(teamSettings)}
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }}
                onPress={() => setDetailsOpen((value) => !value)} style={styles.detailsButton}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>세부 시간 설정 {detailsOpen ? '접기' : '보기'}</ThemedText>
              </Pressable>
              {detailsOpen ? <View style={styles.details}>
                {numberRow('마감 첫 알림', 'deadlinedays', '일 전')}
                {numberRow('진행 정체 기준', 'stalledideadays', '일')}
                {numberRow('공감 기준', 'likesurgethreshold', '개')}
                {numberRow('방해 금지 시작', 'quiet_start', '시')}
                {numberRow('방해 금지 끝', 'quiet_end', '시')}
                <ThemedText type="small" themeColor="textSecondary">시간은 한국 시간 기준이에요. 방해 금지 중에도 앱 안 알림은 기록돼요.</ThemedText>
              </View> : null}
            </ScrollView>
            {error || localError ? <ThemedText style={{ color: theme.danger }} accessibilityLiveRegion="polite">{localError || error}</ThemedText> : null}
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={deleteConfirmOpen} transparent animationType="fade" onRequestClose={() => setDeleteConfirmOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView type="surfaceElevated" style={[styles.confirmPanel, { borderColor: theme.border }]}>
            <ThemedText type="sectionTitle">알림을 모두 삭제할까요?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">알림 {notifications.length}개가 목록에서 사라집니다.</ThemedText>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setDeleteConfirmOpen(false)} style={styles.textAction}><ThemedText>취소</ThemedText></Pressable>
              <Pressable onPress={() => void confirmDeleteAll()} style={styles.textAction}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>삭제</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: BottomTabInset + Spacing.four },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.three },
  headerCopy: { flex: 1, minWidth: 220, gap: Spacing.one },
  headerButton: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three, justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  filterButton: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.pill,
    justifyContent: 'center', paddingHorizontal: Spacing.three },
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  bulkActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  textAction: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.two },
  list: { gap: Spacing.three },
  settingsPanel: { width: '100%', maxWidth: 560, maxHeight: '88%', borderWidth: 1,
    borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  settingsScroll: { flexShrink: 1 },
  settingsContent: { gap: Spacing.one, paddingBottom: Spacing.two },
  closeButton: { minHeight: ControlHeight.touch, minWidth: ControlHeight.touch,
    alignItems: 'center', justifyContent: 'center' },
  teamHeading: { marginTop: Spacing.three },
  settingRow: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  settingLabel: { flex: 1 },
  masterSettingRow: { minHeight: 68, paddingVertical: Spacing.two },
  masterSettingLabel: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  masterSwitch: { transform: [{ scale: 1.15 }] },
  detailsButton: { minHeight: ControlHeight.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  details: { gap: Spacing.two },
  numberRow: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.two, gap: Spacing.one },
  numberLabel: { fontSize: 14, lineHeight: 20 },
  numberActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  numberValue: { minWidth: 76, minHeight: 36, borderWidth: 1, borderRadius: Radius.medium,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  numberValueText: { fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  numberButton: { width: 36, minHeight: 36, borderWidth: 1,
    borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  confirmPanel: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: Radius.large,
    padding: Spacing.four, gap: Spacing.two },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
