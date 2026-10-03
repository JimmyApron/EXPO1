import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { sampleCandidateIdeas, sampleSimpleMvpPlan } from '@/constants/sample-project';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useExperience } from '@/context/ExperienceContext';
import { useTheme } from '@/hooks/use-theme';

const steps = [
  { title: '아이디어 입력', detail: '떠오른 생각을 자유롭게 모아요' },
  { title: 'AI 분석/평가', detail: '가능성과 강점을 살펴봐요' },
  { title: '아이디어 선정', detail: '가장 좋은 방향을 선택해요' },
  { title: 'MVP 또는 결과물 제작', detail: '실행할 수 있는 계획으로 만들어요' },
];

export function OnboardingModal() {
  const { onboarding, closeOnboarding } = useExperience();
  const [demo, setDemo] = useState(false);
  const theme = useTheme();
  const close = (remember: boolean) => {
    setDemo(false);
    closeOnboarding(remember);
  };

  return (
    <Modal visible={onboarding} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={demo}>
            <View style={[styles.hero, { backgroundColor: theme.primarySoft }]}>
              <View style={[styles.heroIcon, { backgroundColor: theme.surface }]}>
                <AppIcon name="idea" size={28} color={theme.primaryHover} />
              </View>
              <ThemedText type="captionStrong" style={[styles.eyebrow, { color: theme.primaryHover }]}>WATT 시작 가이드</ThemedText>
              <ThemedText type="sectionTitle" accessibilityRole="header" style={styles.title}>
                아이디어를 결과물로 만드는 네 단계
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.subtitle}>
                생각을 모으고, 함께 고르고, 실행 가능한 결과물까지 만들어 보세요.
              </ThemedText>
            </View>

            <View style={styles.body}>
              <View style={styles.stepList}>
                {steps.map((step, index) => (
                  <View key={step.title} style={[styles.step, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <View style={[styles.stepNumber, { backgroundColor: index === steps.length - 1 ? theme.primary : theme.primarySoft }]}>
                      <ThemedText type="smallBold" style={{ color: index === steps.length - 1 ? theme.primaryText : theme.primaryHover }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <View style={styles.stepCopy}>
                      <ThemedText type="smallBold">{step.title}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">{step.detail}</ThemedText>
                    </View>
                    {index < steps.length - 1 ? <AppIcon name="chevronRight" size={16} color={theme.textTertiary} /> : null}
                  </View>
                ))}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={demo ? '예시 프로젝트 접기' : '예시 프로젝트로 둘러보기'}
                accessibilityState={{ expanded: demo }}
                onPress={() => setDemo(!demo)}
                style={({ pressed }) => [styles.demoButton, { backgroundColor: theme.background, borderColor: theme.border }, pressed && styles.pressed]}>
                <View style={[styles.demoIcon, { backgroundColor: theme.surface }]}>
                  <AppIcon name="projects" size={19} color={theme.primaryHover} />
                </View>
                <View style={styles.demoCopy}>
                  <ThemedText type="smallBold">예시 프로젝트로 둘러보기</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">실제 사용 흐름을 미리 확인해요</ThemedText>
                </View>
                <AppIcon name="chevronRight" size={18} color={theme.textSecondary} />
              </Pressable>

              {demo ? (
                <View style={[styles.demoPanel, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.demoHeading}>
                    <ThemedText type="smallBold">예시 프로젝트</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.primaryHover }}>읽기 전용</ThemedText>
                  </View>
                  {sampleCandidateIdeas.map((idea, index) => (
                    <View key={idea.id} style={[styles.ideaRow, index > 0 && { borderTopColor: theme.divider, borderTopWidth: 1 }]}>
                      <ThemedText type="smallBold">{idea.title}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">{idea.summary}</ThemedText>
                    </View>
                  ))}
                  <View style={[styles.result, { backgroundColor: theme.primarySoft }]}>
                    <ThemedText type="captionStrong" style={{ color: theme.primaryHover }}>결과물 미리보기</ThemedText>
                    <ThemedText type="caption">{sampleSimpleMvpPlan.essentialFeatures.join(' · ')}</ThemedText>
                  </View>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.divider, backgroundColor: theme.surfaceElevated }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="온보딩 완료하고 시작하기"
              onPress={() => close(true)}
              style={({ pressed }) => [styles.startButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              <ThemedText type="button" style={{ color: theme.text }}>시작하기</ThemedText>
              <AppIcon name="arrowRight" size={18} color={theme.text} />
            </Pressable>
            <View style={styles.footerLinks}>
              <Pressable accessibilityRole="button" accessibilityLabel="온보딩 다시 보지 않기" onPress={() => close(true)} style={styles.textButton}>
                <ThemedText type="small" themeColor="textSecondary">다시 보지 않기</ThemedText>
              </Pressable>
              <View style={[styles.linkDivider, { backgroundColor: theme.divider }]} />
              <Pressable accessibilityRole="button" accessibilityLabel="온보딩 닫고 홈 이용하기" onPress={() => close(false)} style={styles.textButton}>
                <ThemedText type="small" themeColor="textSecondary">나중에 보기</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: 520, maxHeight: '92%', alignSelf: 'center', borderRadius: Radius.xlarge, borderWidth: 1, overflow: 'hidden', ...Shadows.floating },
  scrollContent: { paddingBottom: Spacing.four },
  hero: { alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.four },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  eyebrow: { letterSpacing: 1.1, marginBottom: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: Spacing.two, maxWidth: 360 },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
  stepList: { gap: Spacing.two },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 66, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  stepNumber: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1, gap: 2 },
  demoButton: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  demoIcon: { width: 36, height: 36, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  demoCopy: { flex: 1, gap: 2 },
  demoPanel: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  demoHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  ideaRow: { gap: 4, paddingVertical: Spacing.two },
  result: { gap: 4, borderRadius: Radius.small, padding: Spacing.three, marginTop: Spacing.two },
  footer: { borderTopWidth: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  startButton: { minHeight: 48, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  footerLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.two },
  textButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.two },
  linkDivider: { width: 1, height: 14 },
  pressed: { opacity: 0.78 },
});
