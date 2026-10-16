import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { AuthEmailLinkFlow } from '@/components/auth-otp-flow';
import { BrandIcon } from '@/components/brand-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { issupabaseconfigured } from '@/lib/supabase';

const PALETTE = {
  primary: '#F59E0B',
  background: '#FAF7F2',
  card: '#FFFFFF',
  cardBorder: '#F3E8D6',
  inputBorder: '#DCE3EC',
  text: '#1E293B',
  secondary: '#64748B',
  tertiary: '#94A3B8',
  success: '#10B981',
  danger: '#EF4444',
};

type AuthMode = 'signin' | 'signup' | 'reset';

export function AuthScreen() {
  const { signin, sendSignupLink, resetpassword, autherror, authflow } = useAuth();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage('');
    setFormError('');
  };

  const handleSubmit = async () => {
    setMessage('');
    setFormError('');
    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    if (mode === 'signin' && !password) {
      setFormError('비밀번호를 입력해 주세요.');
      return;
    }
    if (mode === 'signin' && password.length < 6) {
      setFormError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setIsBusy(true);
    try {
      if (mode === 'signin') {
        await signin(normalizedEmail, password);
      } else if (mode === 'signup') {
        await sendSignupLink(normalizedEmail);
      } else {
        await resetpassword(normalizedEmail);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!issupabaseconfigured) {
    return (
      <ThemedView style={[styles.centerContainer, { backgroundColor: PALETTE.background }]}>
        <ThemedText type="subtitle" style={{ color: PALETTE.text }}>Supabase 설정 필요</ThemedText>
        <ThemedText style={[styles.centerText, { color: PALETTE.secondary }]}>
          EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정한 뒤 앱을 다시 시작하세요.
        </ThemedText>
      </ThemedView>
    );
  }

  if (authflow) {
    return (
      <ScrollView style={[styles.scrollView, { backgroundColor: PALETTE.background }]} contentContainerStyle={[styles.scrollContent, { paddingHorizontal: width < 420 ? 20 : 24 }]} keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.brand}><BrandIcon size={48} /><ThemedText style={styles.wordmark}>Watt</ThemedText></View>
            <ThemedText style={styles.brandCopy}>아이디어에서 결과물까지, Watt</ThemedText>
            <AuthEmailLinkFlow onCancel={() => { setEmail(authflow.email); changeMode(authflow.mode === 'signup' ? 'signup' : 'reset'); }} />
          </View>
        </SafeAreaView>
      </ScrollView>
    );
  }

  const isReset = mode === 'reset';
  const title = isReset ? '비밀번호 재설정' : mode === 'signin' ? '다시 시작해 볼까요?' : 'Watt 시작하기';
  const description = isReset
    ? '가입한 이메일 주소로 비밀번호 재설정 링크를 보내드릴게요.'
    : mode === 'signin' ? '로그인하고 진행 중인 과제를 이어가세요.' : '이메일 링크를 확인한 뒤 비밀번호를 설정합니다.';

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: PALETTE.background }]}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: width < 420 ? 20 : 24 }]}
      keyboardShouldPersistTaps="handled">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <BrandIcon size={48} />
            <ThemedText style={styles.wordmark}>Watt</ThemedText>
          </View>
          <ThemedText style={styles.brandCopy}>아이디어에서 결과물까지, Watt</ThemedText>

          <View style={styles.form}>
            {mode !== 'reset' ? (
              <View style={styles.tabs} accessibilityRole="tablist">
                {(['signin', 'signup'] as const).map((tab) => {
                  const selected = mode === tab;
                  return (
                    <Pressable
                      key={tab}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => changeMode(tab)}
                      style={styles.tab}>
                      <ThemedText style={[styles.tabText, selected ? styles.tabSelected : styles.tabUnselected]}>
                        {tab === 'signin' ? '로그인' : '회원가입'}
                      </ThemedText>
                      {selected ? <View style={styles.tabIndicator} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.formHeader}>
              <ThemedText style={styles.formTitle}>{title}</ThemedText>
              <ThemedText style={styles.formDescription}>{description}</ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>이메일</ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={PALETTE.tertiary}
                returnKeyType={isReset ? 'send' : 'next'}
                style={[styles.input, focusedField === 'email' && styles.inputFocused]}
              />
            </View>

            {mode === 'signin' ? (
              <View style={styles.field}>
                <ThemedText style={styles.label}>비밀번호</ThemedText>
                <View style={[styles.passwordInputWrap, focusedField === 'password' && styles.inputFocused]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                    secureTextEntry={!showPassword}
                    placeholder={mode === 'signin' ? '비밀번호를 입력하세요' : '6자 이상 입력하세요'}
                    placeholderTextColor={PALETTE.tertiary}
                    returnKeyType="done"
                    style={styles.passwordInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                    onPress={() => setShowPassword((visible) => !visible)}
                    hitSlop={8}
                    style={styles.visibilityButton}>
                    <AppIcon name={showPassword ? 'eyeOff' : 'eye'} color={PALETTE.tertiary} size={20} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {mode === 'signin' ? (
              <Pressable onPress={() => changeMode('reset')} style={styles.forgotLink}>
                <ThemedText style={styles.linkText}>비밀번호를 잊으셨나요?</ThemedText>
              </Pressable>
            ) : null}

            {message ? <ThemedText style={[styles.feedbackText, { color: PALETTE.success }]}>{message}</ThemedText> : null}
            {formError || autherror ? (
              <ThemedText style={[styles.feedbackText, { color: PALETTE.danger }]}>{formError || autherror}</ThemedText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={handleSubmit}
              style={({ pressed }) => [styles.primaryButton, pressed && !isBusy && styles.pressed]}>
              {isBusy ? <ActivityIndicator color={PALETTE.text} /> : (
                <ThemedText style={styles.primaryButtonText}>
                  {isReset ? '재설정 링크 받기' : mode === 'signin' ? '로그인' : '가입 링크 받기'}
                </ThemedText>
              )}
            </Pressable>

            {isReset ? (
              <Pressable onPress={() => changeMode('signin')} style={styles.backLink}>
                <ThemedText style={styles.linkText}>로그인으로 돌아가기</ThemedText>
              </Pressable>
            ) : null}
          </View>
          <ThemedText style={styles.footer}>Watt · 아이디어에서 결과물까지</ThemedText>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: 440, alignItems: 'center' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.three },
  centerText: { maxWidth: 560, textAlign: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordmark: { color: PALETTE.text, fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.6 },
  brandCopy: { marginTop: 16, marginBottom: 24, color: PALETTE.secondary, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  form: {
    width: '100%', gap: 20, padding: 24, backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder, borderWidth: 1, borderRadius: Radius.large,
  },
  tabs: { flexDirection: 'row', marginBottom: 2, borderBottomWidth: 1, borderBottomColor: PALETTE.cardBorder },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { fontSize: 17, lineHeight: 24 },
  tabSelected: { color: PALETTE.text, fontWeight: '700' },
  tabUnselected: { color: PALETTE.tertiary, fontWeight: '500' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: PALETTE.primary },
  formHeader: { gap: 4 },
  formTitle: { color: PALETTE.text, fontSize: 22, lineHeight: 30, fontWeight: '700' },
  formDescription: { color: PALETTE.secondary, fontSize: 15, lineHeight: 22 },
  field: { gap: 8 },
  label: { color: PALETTE.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  input: {
    minHeight: 52, borderWidth: 1, borderColor: PALETTE.inputBorder, borderRadius: Radius.medium,
    backgroundColor: PALETTE.card, color: PALETTE.text, fontSize: 16, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12,
  },
  passwordInputWrap: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: PALETTE.inputBorder, borderRadius: Radius.medium, backgroundColor: PALETTE.card,
  },
  passwordInput: { flex: 1, minHeight: 50, color: PALETTE.text, fontSize: 16, lineHeight: 22, paddingHorizontal: 14, paddingVertical: 12 },
  inputFocused: { borderColor: PALETTE.primary, borderWidth: 1.5 },
  visibilityButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, paddingVertical: 2 },
  linkText: { color: PALETTE.secondary, fontSize: 14, lineHeight: 20 },
  feedbackText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, backgroundColor: PALETTE.primary, paddingHorizontal: 16 },
  primaryButtonText: { color: PALETTE.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  backLink: { alignSelf: 'center', marginTop: -8, paddingVertical: 4 },
  footer: { marginTop: 20, color: PALETTE.tertiary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.76 },
});
