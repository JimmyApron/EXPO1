import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 기존 링크 호환용 경로. 과제 홈의 MVP 기획 단계로 연결한다. */
export default function MvpGeneratorRedirectScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const theme = useTheme();

  useEffect(() => {
    if (projectId) router.replace(`/projects/${projectId}?projectView=home&flowStep=mvp` as Href);
  }, [projectId]);

  if (!projectId) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText type="smallBold">과제 홈에서 MVP 기획을 진행해 주세요.</ThemedText>
        <Pressable onPress={() => router.replace('/projects' as Href)} style={[styles.button, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={styles.whiteText}>과제 목록</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator />
      <ThemedText type="small" themeColor="textSecondary">MVP 기획 단계로 이동하는 중…</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.three },
  button: { minHeight: ControlHeight.button, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
  whiteText: { color: '#fff' },
});
