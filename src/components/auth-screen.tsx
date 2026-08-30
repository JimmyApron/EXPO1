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
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { issupabaseconfigured } from '@/lib/supabase';

// 🎨 디자인 시스템 컬러 팔레트
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지
  primaryLight: '#FEF3C7',   // 연노랑 (배경 하이라이트)
  primaryDark: '#D97706',    // 딥 오렌지
  background: '#FAF7F2',     // 부드러운 크림/오프화이트 배경
  card: '#FFFFFF',           // 깨끗한 흰색 카드
  cardBorder: '#F3E8D6',     // 연한 크림 테두리
  inputBg: '#FFFFFF',        // 입력창 배경
  inputBorder: '#E2E8F0',    // 인풋 테두리
  text: '#1E293B',           // 짙은 네이비 (본문/제목)
  textSecondary: '#64748B',  // 보조 텍스트 그레이
  success: '#10B981',        // 성공 초록
  danger: '#EF4444',         // 리스크/경고 빨강
};

export function AuthScreen() {
  const { signin, signup, autherror } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [formerror, setFormerror] = useState('');
  const [isbusy, setIsbusy] = useState(false);

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
      <ThemedView style={[styles.centerContainer, { backgroundColor: PALETTE.background }]}>
        <ThemedText type="subtitle" style={{ color: PALETTE.text }}>
          Supabase 설정 필요
        </ThemedText>
        <ThemedText style={[styles.centerText, { color: PALETTE.textSecondary }]}>
          EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정한 뒤 앱을 다시 시작하세요.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: PALETTE.background }]}
      contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, isWide && styles.containerWide]}>
          {/* 좌측/상단 브랜딩 영역 */}
          <View style={[styles.brandPanel, isWide && styles.brandPanelWide]}>
            <View style={styles.iconContainer}>
              <BrandIcon size={isWide ? 104 : 72} />
            </View>
            <View style={styles.header}>
              <ThemedText type="title" style={[styles.wordmark, { color: PALETTE.text }]}>
                Watt
              </ThemedText>
              <ThemedText style={[styles.brandCopy, { color: PALETTE.textSecondary }]}>
                아이디어를 모아 실행 가능한 과제로 발전시켜 보세요.
              </ThemedText>
            </View>

            {isWide ? (
              <View
                style={[
                  styles.brandNote,
                  { borderColor: PALETTE.cardBorder, backgroundColor: PALETTE.primaryLight },
                ]}>
                <ThemedText type="smallBold" style={{ color: PALETTE.text }}>
                  💡 아이디어에서 결과물까지
                </ThemedText>
                <ThemedText type="small" style={{ color: PALETTE.textSecondary }}>
                  팀의 생각을 정리하고, 검토하고, 실제 발표와 MVP 계획으로 연결합니다.
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* 우측/하단 로그인 폼 카드 */}
          <View
            style={[
              styles.form,
              { backgroundColor: PALETTE.card, borderColor: PALETTE.cardBorder },
              Shadows.floating,
            ]}>
            <View style={styles.formHeader}>
              <ThemedText type="subtitle" style={[styles.formTitle, { color: PALETTE.text }]}>
                {mode === 'signin' ? '다시 만나 반가워요' : 'Watt 시작하기'}
              </ThemedText>
              <ThemedText type="small" style={{ color: PALETTE.textSecondary }}>
                {mode === 'signin'
                  ? '계정으로 로그인해 작업을 이어가세요.'
                  : '새 계정을 만들고 첫 과제를 시작하세요.'}
              </ThemedText>
            </View>

            {/* 로그인 / 회원가입 탭 토글 */}
            <View
              style={[
                styles.modeRow,
                { backgroundColor: PALETTE.background, borderColor: PALETTE.cardBorder },
              ]}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'signin' }}
                onPress={() => setMode('signin')}
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === 'signin' && styles.activeModeButton,
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.modeText,
                    mode === 'signin'
                      ? styles.activeModeText
                      : { color: PALETTE.textSecondary },
                  ]}>
                  로그인
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'signup' }}
                onPress={() => setMode('signup')}
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === 'signup' && styles.activeModeButton,
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.modeText,
                    mode === 'signup'
                      ? styles.activeModeText
                      : { color: PALETTE.textSecondary },
                  ]}>
                  회원가입
                </ThemedText>
              </Pressable>
            </View>

            {/* 입력 폼 */}
            <View style={styles.field}>
              <ThemedText type="smallBold" style={{ color: PALETTE.text }}>
                이메일
              </ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={PALETTE.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: PALETTE.inputBorder,
                    color: PALETTE.text,
                    backgroundColor: PALETTE.inputBg,
                  },
                ]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold" style={{ color: PALETTE.text }}>
                비밀번호
              </ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                secureTextEntry
                placeholder="6자 이상"
                placeholderTextColor={PALETTE.textSecondary}
                style={[
                  styles.input,
                  {
                    borderColor: PALETTE.inputBorder,
                    color: PALETTE.text,
                    backgroundColor: PALETTE.inputBg,
                  },
                ]}
              />
            </View>

            {/* 피드백 메시지 */}
            {message ? (
              <ThemedText type="small" style={[styles.messageText, { color: PALETTE.success }]}>
                {message}
              </ThemedText>
            ) : null}
            {formerror || autherror ? (
              <ThemedText type="small" style={[styles.errorText, { color: PALETTE.danger }]}>
                {formerror || autherror}
              </ThemedText>
            ) : null}

            {/* 메인 액션 버튼 */}
            <Pressable
              disabled={isbusy}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: PALETTE.primary },
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
          </View>
        </View>
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
    maxWidth: 960,
    gap: Spacing.four,
  },
  containerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  iconContainer: {
    marginBottom: Spacing.one,
  },
  header: {
    gap: Spacing.two,
  },
  brandPanel: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  brandPanelWide: {
    minHeight: 480,
    paddingHorizontal: Spacing.three,
  },
  wordmark: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  brandCopy: {
    maxWidth: 440,
    fontSize: 16,
    lineHeight: 24,
  },
  brandNote: {
    maxWidth: 420,
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  form: {
    width: '100%',
    maxWidth: 440,
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
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: 3,
    gap: 4,
  },
  modeButton: {
    minHeight: 38,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.small,
  },
  activeModeButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  modeText: {
    fontSize: 14,
  },
  activeModeText: {
    color: '#ffffff',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.medium,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
