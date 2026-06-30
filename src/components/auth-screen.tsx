import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { issupabaseconfigured } from '@/lib/supabase';

export function AuthScreen() {
  const { signin, signup, autherror } = useAuth();
  const theme = useTheme();
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
        <ThemedView style={styles.container}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">과제 보관함</ThemedText>
            <ThemedText themeColor="textSecondary">Supabase 계정으로 로그인하세요.</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.form}>
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setMode('signin')}
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === 'signin' && styles.activeModeButton,
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={mode === 'signin' && styles.activeModeText}>
                  로그인
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setMode('signup')}
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === 'signup' && styles.activeModeButton,
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
              <ThemedText type="small" style={styles.messageText}>
                {message}
              </ThemedText>
            ) : null}
            {formerror || autherror ? (
              <ThemedText type="small" style={styles.errorText}>
                {formerror || autherror}
              </ThemedText>
            ) : null}

            <Pressable
              disabled={isbusy}
              onPress={handleSubmit}
              style={({ pressed }) => [styles.primaryButton, (pressed || isbusy) && styles.pressed]}>
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
    padding: Spacing.three,
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
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
  form: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modeButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  activeModeButton: {
    backgroundColor: '#2868d8',
  },
  activeModeText: {
    color: '#ffffff',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2868d8',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  messageText: {
    color: '#157f3b',
  },
  errorText: {
    color: '#d92d20',
  },
  pressed: {
    opacity: 0.72,
  },
});
