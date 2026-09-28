import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  ControlHeight,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DialogProps = {
  visible: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
};

type SettingRowProps = {
  icon: AppIconName;
  title: string;
  description: string;
  onPress?: () => void;
  danger?: boolean;
};

function ProfileDialog({ visible, title, description, children, onClose }: DialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <ThemedView
          type="surfaceElevated"
          style={[styles.dialog, { borderColor: theme.border }, Shadows.floating]}>
          <View style={styles.dialogHeader}>
            <View style={styles.dialogCopy}>
              <ThemedText type="sectionTitle">{title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {description}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <AppIcon name="close" color={theme.textSecondary} size={22} />
            </Pressable>
          </View>
          {children}
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SettingRow({ icon, title, description, onPress, danger = false }: SettingRowProps) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.primary;
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: danger ? theme.dangerSoft : theme.primarySoft }]}>
        <AppIcon name={icon} color={color} size={21} />
      </View>
      <View style={styles.rowCopy}>
        <ThemedText type="smallBold" style={danger ? { color: theme.danger } : undefined}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      {onPress ? <AppIcon name="chevronRight" color={theme.textTertiary} size={20} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.settingRow}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, autherror, signout, updateaccount, changepassword, deleteaccount } = useAuth();
  const email = user?.email ?? '이메일 정보 없음';
  const fallbackName = email.includes('@') ? email.split('@')[0] : email;
  const [nickname, setNickname] = useState(() => String(user?.user_metadata?.nickname ?? fallbackName));
  const [avatarurl, setAvatarurl] = useState<string | null>(() => user?.user_metadata?.avatarurl ?? null);
  const [draftNickname, setDraftNickname] = useState(nickname);
  const [draftEmail, setDraftEmail] = useState(email);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [openDialog, setOpenDialog] = useState<'profile' | 'password' | 'delete' | null>(null);
  const [busyAction, setBusyAction] = useState<'profile' | 'password' | 'avatar' | 'delete' | 'signout' | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    supabase
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const savedNickname = String(data?.nickname ?? '').trim();
        if (active && savedNickname) setNickname(savedNickname);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const closeDialog = () => {
    if (busyAction) return;
    setOpenDialog(null);
    setDeleteConfirm('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const showError = (error: unknown, fallback: string) => {
    setStatus({ tone: 'error', message: error instanceof Error ? error.message : fallback });
  };

  const openProfileEditor = () => {
    setDraftNickname(nickname);
    setDraftEmail(email);
    setStatus(null);
    setOpenDialog('profile');
  };

  const saveProfile = async () => {
    if (!user) return;
    const nextNickname = draftNickname.trim();
    const nextEmail = draftEmail.trim().toLowerCase();

    if (!nextNickname) {
      setStatus({ tone: 'error', message: '사용할 이름을 입력해 주세요.' });
      return;
    }
    if (nextNickname.length > 20) {
      setStatus({ tone: 'error', message: '이름은 20자 이하로 입력해 주세요.' });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setStatus({ tone: 'error', message: '올바른 이메일 주소를 입력해 주세요.' });
      return;
    }

    setBusyAction('profile');
    setStatus(null);
    try {
      await updateaccount({
        nickname: nextNickname,
        ...(nextEmail !== email.toLowerCase() ? { email: nextEmail } : {}),
      });
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        email,
        nickname: nextNickname,
        updatedat: new Date().toISOString(),
      });
      if (error) throw error;

      setNickname(nextNickname);
      setOpenDialog(null);
      setStatus({
        tone: 'success',
        message:
          nextEmail !== email.toLowerCase()
            ? '프로필을 저장했어요. 새 이메일로 전송된 확인 링크를 눌러 변경을 완료해 주세요.'
            : '프로필 정보를 저장했어요.',
      });
    } catch (error) {
      showError(error, '프로필을 저장하지 못했습니다.');
    } finally {
      setBusyAction(null);
    }
  };

  const pickAvatar = async () => {
    if (!user || busyAction) return;
    setStatus(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        setStatus({ tone: 'error', message: '프로필 사진은 5MB 이하로 선택해 주세요.' });
        return;
      }

      setBusyAction('avatar');
      const fileBody = asset.file ?? (await (await fetch(asset.uri)).arrayBuffer());
      const avatarPath = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(avatarPath, fileBody, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
      const nextAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      await updateaccount({ avatarurl: nextAvatarUrl, avatarpath: avatarPath });
      setAvatarurl(nextAvatarUrl);
      setStatus({ tone: 'success', message: '프로필 사진을 변경했어요.' });
    } catch (error) {
      showError(error, '프로필 사진을 변경하지 못했습니다.');
    } finally {
      setBusyAction(null);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setStatus({ tone: 'error', message: '새 비밀번호는 8자 이상 입력해 주세요.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ tone: 'error', message: '비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    setBusyAction('password');
    setStatus(null);
    try {
      await changepassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setOpenDialog(null);
      setStatus({ tone: 'success', message: '비밀번호를 변경했어요.' });
    } catch (error) {
      showError(error, '비밀번호를 변경하지 못했습니다.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignout = async () => {
    setBusyAction('signout');
    setStatus(null);
    try {
      await signout();
    } catch (error) {
      showError(error, '로그아웃하지 못했습니다.');
      setBusyAction(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== '탈퇴') return;
    setBusyAction('delete');
    setStatus(null);
    try {
      await deleteaccount();
    } catch (error) {
      showError(error, '회원 탈퇴를 처리하지 못했습니다.');
      setBusyAction(null);
    }
  };

  const joinedAt = user?.created_at
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(
        new Date(user.created_at),
      )
    : '-';
  const initial = (nickname || email).slice(0, 1).toUpperCase();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled">
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="screenTitle">내 정보</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              프로필과 계정 설정을 한곳에서 관리하세요.
            </ThemedText>
          </View>

          <ThemedView
            type="backgroundElement"
            style={[styles.profileCard, { borderColor: theme.border }, Shadows.card]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 변경"
              disabled={busyAction === 'avatar'}
              onPress={pickAvatar}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
              <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                {avatarurl ? (
                  <Image source={{ uri: avatarurl }} style={styles.avatarImage} contentFit="cover" transition={150} />
                ) : (
                  <ThemedText type="sectionTitle" style={{ color: theme.primary }}>
                    {initial}
                  </ThemedText>
                )}
                {busyAction === 'avatar' ? (
                  <View style={[styles.avatarLoading, { backgroundColor: theme.overlay }]}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                <AppIcon name="camera" color={theme.primaryText} size={16} />
              </View>
            </Pressable>

            <View style={styles.profileCopy}>
              <ThemedText type="sectionTitle" numberOfLines={1}>
                {nickname}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" numberOfLines={1}>
                {email}
              </ThemedText>
            </View>

          </ThemedView>

          {status || autherror ? (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: status?.tone === 'success' ? theme.successSoft : theme.dangerSoft,
                  borderColor: status?.tone === 'success' ? theme.success : theme.danger,
                },
              ]}>
              <ThemedText
                type="small"
                style={{ color: status?.tone === 'success' ? theme.success : theme.danger }}>
                {status?.message || autherror}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="sectionTitle">개인 정보</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.settingsCard, { borderColor: theme.border }]}>
              <SettingRow
                icon="edit"
                title="이름과 이메일"
                description="서비스에 표시되는 이름과 로그인 이메일을 관리해요."
                onPress={openProfileEditor}
              />
              <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
              <SettingRow
                icon="lock"
                title="비밀번호 변경"
                description="다른 곳에서 사용하지 않는 비밀번호를 권장해요."
                onPress={() => {
                  setStatus(null);
                  setOpenDialog('password');
                }}
              />
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">앱 설정</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.settingsCard, { borderColor: theme.border }]}>
              <SettingRow
                icon="notifications"
                title="알림 설정"
                description="마감, 피드백 등 받고 싶은 알림을 선택해요."
                onPress={() => router.push('/notifications' as Href)}
              />
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">계정 정보</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.accountInfoCard, { borderColor: theme.border }]}>
              <View style={styles.accountInfoRow}>
                <ThemedText type="small" themeColor="textSecondary">가입일</ThemedText>
                <ThemedText type="smallBold">{joinedAt}</ThemedText>
              </View>
              <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.accountInfoRow}>
                <ThemedText type="small" themeColor="textSecondary">이메일 인증</ThemedText>
                <ThemedText type="smallBold" style={{ color: user?.email_confirmed_at ? theme.success : theme.warning }}>
                  {user?.email_confirmed_at ? '완료' : '확인 필요'}
                </ThemedText>
              </View>
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="sectionTitle">계정 관리</ThemedText>
            <ThemedView type="backgroundElement" style={[styles.settingsCard, { borderColor: theme.border }]}>
              <SettingRow
                icon="logout"
                title={busyAction === 'signout' ? '로그아웃 중…' : '로그아웃'}
                description="이 기기에서 현재 계정의 연결을 해제해요."
                onPress={busyAction ? undefined : handleSignout}
              />
              <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
              <SettingRow
                icon="delete"
                title="회원 탈퇴"
                description="계정과 저장된 데이터를 영구적으로 삭제해요."
                danger
                onPress={() => {
                  setStatus(null);
                  setOpenDialog('delete');
                }}
              />
            </ThemedView>
          </View>

          <View style={styles.appInfo}>
            <ThemedText type="caption" themeColor="textTertiary">Watt {appVersion}</ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">아이디어에서 결과물까지</ThemedText>
          </View>
        </ThemedView>
      </SafeAreaView>

      <ProfileDialog
        visible={openDialog === 'profile'}
        title="이름과 이메일"
        description="팀원에게 보이는 이름과 로그인 이메일을 수정할 수 있어요."
        onClose={closeDialog}>
        <View style={styles.form}>
          {status?.tone === 'error' ? (
            <View style={[styles.statusBanner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
              <ThemedText type="small" style={{ color: theme.danger }}>{status.message}</ThemedText>
            </View>
          ) : null}
          <View style={styles.field}>
            <ThemedText type="smallBold">이름</ThemedText>
            <TextInput
              value={draftNickname}
              onChangeText={setDraftNickname}
              maxLength={20}
              placeholder="사용할 이름"
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="smallBold">이메일</ThemedText>
            <TextInput
              value={draftEmail}
              onChangeText={setDraftEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="email@example.com"
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <ThemedText type="caption" themeColor="textTertiary">
              이메일 변경 시 새 주소로 전송된 링크에서 확인이 필요해요.
            </ThemedText>
          </View>
          <View style={styles.dialogActions}>
            <Pressable onPress={closeDialog} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
              <ThemedText type="button">취소</ThemedText>
            </Pressable>
            <Pressable disabled={busyAction === 'profile'} onPress={saveProfile} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              {busyAction === 'profile' ? <ActivityIndicator color={theme.primaryText} /> : <ThemedText type="button" style={{ color: theme.primaryText }}>저장</ThemedText>}
            </Pressable>
          </View>
        </View>
      </ProfileDialog>

      <ProfileDialog
        visible={openDialog === 'password'}
        title="비밀번호 변경"
        description="8자 이상의 새로운 비밀번호를 입력해 주세요."
        onClose={closeDialog}>
        <View style={styles.form}>
          {status?.tone === 'error' ? (
            <View style={[styles.statusBanner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
              <ThemedText type="small" style={{ color: theme.danger }}>{status.message}</ThemedText>
            </View>
          ) : null}
          <View style={styles.field}>
            <ThemedText type="smallBold">새 비밀번호</ThemedText>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="8자 이상 입력"
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
          </View>
          <View style={styles.field}>
            <ThemedText type="smallBold">비밀번호 확인</ThemedText>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="한 번 더 입력"
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
          </View>
          <View style={styles.dialogActions}>
            <Pressable onPress={closeDialog} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
              <ThemedText type="button">취소</ThemedText>
            </Pressable>
            <Pressable disabled={busyAction === 'password'} onPress={savePassword} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              {busyAction === 'password' ? <ActivityIndicator color={theme.primaryText} /> : <ThemedText type="button" style={{ color: theme.primaryText }}>변경</ThemedText>}
            </Pressable>
          </View>
        </View>
      </ProfileDialog>

      <ProfileDialog
        visible={openDialog === 'delete'}
        title="정말 탈퇴할까요?"
        description="참여 중인 프로젝트와 아이디어를 포함한 계정 데이터가 삭제되며 되돌릴 수 없습니다."
        onClose={closeDialog}>
        <View style={styles.form}>
          {status?.tone === 'error' ? (
            <View style={[styles.statusBanner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
              <ThemedText type="small" style={{ color: theme.danger }}>{status.message}</ThemedText>
            </View>
          ) : null}
          <View style={[styles.dangerNotice, { backgroundColor: theme.dangerSoft }]}>
            <AppIcon name="info" color={theme.danger} size={20} />
            <ThemedText type="small" style={[styles.dangerNoticeText, { color: theme.danger }]}>
              계속하려면 아래 입력란에 ‘탈퇴’를 입력해 주세요.
            </ThemedText>
          </View>
          <TextInput
            value={deleteConfirm}
            onChangeText={setDeleteConfirm}
            autoCapitalize="none"
            placeholder="탈퇴"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text, borderColor: theme.danger, backgroundColor: theme.background }]}
          />
          <View style={styles.dialogActions}>
            <Pressable onPress={closeDialog} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
              <ThemedText type="button">취소</ThemedText>
            </Pressable>
            <Pressable
              disabled={deleteConfirm !== '탈퇴' || busyAction === 'delete'}
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.danger },
                deleteConfirm !== '탈퇴' && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {busyAction === 'delete' ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText type="button" style={styles.dangerButtonText}>영구 탈퇴</ThemedText>}
            </Pressable>
          </View>
        </View>
      </ProfileDialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: BottomTabInset + Spacing.five },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.five },
  header: { gap: Spacing.one, paddingTop: Spacing.two },
  profileCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.xlarge, padding: Spacing.four },
  avatarButton: { position: 'relative' },
  avatar: { width: 84, height: 84, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: Radius.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1, minWidth: 180, gap: Spacing.one },
  statusBanner: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  section: { gap: Spacing.three },
  settingsCard: { borderWidth: 1, borderRadius: Radius.large, overflow: 'hidden' },
  settingRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  rowPressed: { opacity: 0.72 },
  rowIcon: { width: 40, height: 40, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 2 },
  rowDivider: { height: 1, marginHorizontal: Spacing.three },
  accountInfoCard: { borderWidth: 1, borderRadius: Radius.large, paddingVertical: Spacing.one },
  accountInfoRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingHorizontal: Spacing.three },
  appInfo: { alignItems: 'center', gap: 2, paddingTop: Spacing.two },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '92%', gap: Spacing.four, borderWidth: 1, borderRadius: Radius.xlarge, padding: Spacing.four },
  dialogHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  dialogCopy: { flex: 1, gap: Spacing.one },
  closeButton: { width: ControlHeight.touch, height: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', marginTop: -Spacing.two, marginRight: -Spacing.two },
  form: { gap: Spacing.three },
  field: { gap: Spacing.two },
  input: { minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, fontSize: 15 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, paddingTop: Spacing.one },
  secondaryButton: { minWidth: 76, minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  primaryButton: { minWidth: 88, minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  dangerNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, borderRadius: Radius.medium, padding: Spacing.three },
  dangerNoticeText: { flex: 1 },
  dangerButtonText: { color: '#FFFFFF' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7 },
});
