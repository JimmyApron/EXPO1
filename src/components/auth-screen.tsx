import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandIcon } from '@/components/brand-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { issupabaseconfigured } from '@/lib/supabase';

export function AuthScreen() {
  const { signin, signup, autherror } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [formerror, setFormerror] = useState('');
  const [isbusy, setIsbusy] = useState(false);

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.backgroundSelected,
      color: theme.text,
      backgroundColor: theme.background,
    },
  ];

  const handleSubmit = async () => {
    setMessage('');
    setFormerror('');

    if (!email.trim() || !password) {
      setFormerror('이메일과 비밀번호를 입력하세요.');
      return;
    }

    if (password.length < 6) {
      setFormerror('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setIsbusy(true);

    try {
      if (mode === 'signin') {
        await signin(email, password);
      } else {
        setMessage(await signup(email, password));
      }
    } catch (error) {
      setFormerror(error instanceof Error ? error.message : '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsbusy(false);
    }
  };

  if (!issupabaseconfigured) {
    return (
      <ThemedView style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ThemedText type="subtitle">Supabase 설정 필요</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정한 뒤 앱을 다시
          시작하세요.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={[styles.container, isWide && styles.containerWide]}>
          <View style={[styles.brandPanel, isWide && styles.brandPanelWide]}>
            <BrandIcon size={isWide ? 112 : 82} />
            <View style={styles.header}>
              <ThemedText type="title" style={styles.wordmark}>Watt</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.brandCopy}>
                아이디어를 모아 실행 가능한 과제로 발전시켜 보세요.
              </ThemedText>
            </View>
            {isWide ? (
              <View style={[styles.brandNote, { borderColor: theme.divider }]}>
                <ThemedText type="smallBold">아이디어에서 결과물까지</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  팀의 생각을 정리하고, 검토하고, 실제 발표와 MVP 계획으로 연결합니다.
                </ThemedText>
              </View>
            ) : null}
          </View>

          <ThemedView
            type="surfaceElevated"
            style={[styles.form, { borderColor: theme.border }, Shadows.floating]}>
            <View style={styles.formHeader}>
              <ThemedText type="subtitle" style={styles.formTitle}>
                {mode === 'signin' ? '다시 만나 반가워요' : 'Watt 시작하기'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {mode === 'signin' ? '계정으로 로그인해 작업을 이어가세요.' : '새 계정을 만들고 첫 과제를 시작하세요.'}
              </ThemedText>
            </View>
            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'signin' }}
                onPress={() => setMode('signin')}
                style={({ pressed }) => [
                  styles.modeButton,
                  { borderColor: theme.border },
                  mode === 'signin' && { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={mode === 'signin' && styles.activeModeText}>
                  로그인
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'signup' }}
                onPress={() => setMode('signup')}
                style={({ pressed }) => [
                  styles.modeButton,
                  { borderColor: theme.border },
                  mode === 'signup' && { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={mode === 'signup' && styles.activeModeText}>
                  회원가입
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">이메일</ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">비밀번호</ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                secureTextEntry
                placeholder="6자 이상"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
              />
            </View>

            {message ? (
              <ThemedText type="small" style={[styles.messageText, { color: theme.success }]}>
                {message}
              </ThemedText>
            ) : null}
            {formerror || autherror ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                {formerror || autherror}
              </ThemedText>
            ) : null}

            <Pressable
              disabled={isbusy}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                (pressed || isbusy) && styles.pressed,
              ]}>
              {isbusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  {mode === 'signin' ? '로그인' : '회원가입'}
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 1040,
    gap: Spacing.four,
  },
  containerWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.six,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  centerText: {
    maxWidth: 560,
    textAlign: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  brandPanel: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  brandPanelWide: {
    minHeight: 520,
    paddingHorizontal: Spacing.four,
  },
  wordmark: {
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.6,
  },
  brandCopy: {
    maxWidth: 460,
    fontSize: 18,
    lineHeight: 28,
  },
  brandNote: {
    maxWidth: 440,
    gap: Spacing.one,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  form: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  formHeader: {
    gap: Spacing.one,
  },
  formTitle: {
    fontSize: 22,
    lineHeight: 30,
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: Radius.medium,
    gap: Spacing.one,
  },
  modeButton: {
    minHeight: ControlHeight.touch,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.small,
  },
  activeModeText: {
    color: '#ffffff',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: ControlHeight.input,
    borderWidth: 1,
    borderRadius: Radius.medium,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    minHeight: ControlHeight.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  messageText: {
    fontWeight: '600',
  },
  errorText: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
