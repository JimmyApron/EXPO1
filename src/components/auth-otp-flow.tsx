import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

const COLORS = {
  primary: '#F59E0B',
  background: '#FAF7F2',
  card: '#FFFFFF',
  border: '#F3E8D6',
  inputBorder: '#DCE3EC',
  text: '#1E293B',
  secondary: '#64748B',
  tertiary: '#94A3B8',
  danger: '#EF4444',
  success: '#10B981',
};

type Props = { onCancel: () => void };

export function AuthEmailLinkFlow({ onCancel }: Props) {
  const {
    authflow,
    autherror,
    resendSignupLink,
    resendResetLink,
    completeSignup,
    completePasswordReset,
    cancelAuthFlow,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedSeconds = authflow?.sentAt && now > 0 ? Math.max(0, Math.floor((now - authflow.sentAt) / 1000)) : 0;
  const resendWait = Math.max(0, 60 - elapsedSeconds);
  const isSignup = authflow?.mode === 'signup';
  const isLinkSent = authflow?.stage === 'sent';

  const handleResend = async () => {
    setError('');
    setIsBusy(true);
    try {
      if (isSignup) await resendSignupLink();
      else await resendResetLink();
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '이메일을 다시 보내지 못했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleComplete = async () => {
    setError('');
    if (!password || !confirmPassword) {
      setError('비밀번호와 비밀번호 확인을 모두 입력해 주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setIsBusy(true);
    try {
      if (isSignup) await completeSignup(password);
      else await completePasswordReset(password);
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '비밀번호를 저장하지 못했습니다.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    await cancelAuthFlow();
    onCancel();
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>
          {isLinkSent ? '이메일을 확인해 주세요' : isSignup ? '비밀번호 설정' : '새 비밀번호 설정'}
        </ThemedText>
        <ThemedText style={styles.description}>
          {isLinkSent
            ? `${authflow?.email ?? ''} 주소로 보낸 링크를 눌러 ${isSignup ? '이메일 인증' : '비밀번호 재설정'}을 계속해 주세요.`
            : isSignup ? 'Watt에서 사용할 비밀번호를 설정해 주세요.' : '새 비밀번호를 설정해 주세요.'}
        </ThemedText>
      </View>

      {isLinkSent ? (
        <>
          <Pressable disabled={isBusy || resendWait > 0} onPress={handleResend} style={styles.resendButton}>
            <ThemedText style={[styles.link, (isBusy || resendWait > 0) && styles.disabledLink]}>
              {resendWait > 0 ? `이메일 다시 보내기 (${resendWait}초)` : '이메일 다시 보내기'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleCancel} style={styles.editEmailButton}>
            <ThemedText style={styles.link}>이메일 변경</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <PasswordField
            label="비밀번호"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
          />
          <PasswordField
            label="비밀번호 확인"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
          />
        </>
      )}

      {error || autherror ? <ThemedText style={styles.error}>{error || autherror}</ThemedText> : null}
      {!isLinkSent ? (
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={handleComplete}
          style={({ pressed }) => [styles.primaryButton, pressed && !isBusy && styles.pressed]}>
          {isBusy ? <ActivityIndicator color={COLORS.text} /> : (
            <ThemedText style={styles.primaryButtonText}>
              {isSignup ? '회원가입 완료' : '비밀번호 변경 완료'}
            </ThemedText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.passwordWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          secureTextEntry={!visible}
          placeholder="6자 이상"
          placeholderTextColor={COLORS.tertiary}
          style={styles.passwordInput}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={visible ? `${label} 숨기기` : `${label} 표시`} onPress={onToggle} hitSlop={8} style={styles.visibilityButton}>
          <AppIcon name={visible ? 'eyeOff' : 'eye'} color={COLORS.tertiary} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', gap: 18, padding: 24, backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: Radius.large },
  header: { gap: 4 },
  title: { color: COLORS.text, fontSize: 22, lineHeight: 30, fontWeight: '700' },
  description: { color: COLORS.secondary, fontSize: 15, lineHeight: 22 },
  field: { gap: 8 },
  label: { color: COLORS.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  input: { minHeight: 52, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: Radius.medium, color: COLORS.text, fontSize: 18, letterSpacing: 4, paddingHorizontal: 14, textAlign: 'center' },
  passwordWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: Radius.medium },
  passwordInput: { flex: 1, minHeight: 50, color: COLORS.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  visibilityButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  timer: { color: COLORS.secondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  expired: { color: COLORS.danger },
  resendButton: { alignSelf: 'center', marginTop: -8, paddingVertical: 4 },
  editEmailButton: { alignSelf: 'center', marginTop: -16, paddingVertical: 4 },
  link: { color: COLORS.secondary, fontSize: 14, lineHeight: 20 },
  disabledLink: { color: COLORS.tertiary },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, backgroundColor: COLORS.primary, paddingHorizontal: 16 },
  primaryButtonText: { color: COLORS.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  pressed: { opacity: 0.76 },
});
