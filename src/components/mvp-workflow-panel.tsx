import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useMvpPlan } from '@/hooks/use-mvp-plan';
import type { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import type { Idea } from '@/types/idea';
import type { MvpIdea } from '@/types/mvp-plan';

type MvpWorkflowPanelProps = {
  idea: Idea;
  flowController: ReturnType<typeof useProjectFlow>;
  onGoToPresentation: () => void;
};

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <ThemedText key={`${item}-${index}`} type="small" themeColor="textSecondary">• {item}</ThemedText>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }, Shadows.card]}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

export function MvpWorkflowPanel({ idea, flowController, onGoToPresentation }: MvpWorkflowPanelProps) {
  const theme = useTheme();
  const { flow, conditions, saveMvpPlan } = flowController;
  const mvpIdea: MvpIdea = useMemo(() => ({
    id: idea.id,
    title: idea.title,
    description: idea.summary || idea.content,
    targetUsers: idea.targetusers.join(', ') || '과제 대상 사용자',
  }), [idea]);
  const { plan, isGenerating, error, generatePlan } = useMvpPlan(
    mvpIdea,
    conditions,
    flow?.mvpplan,
    saveMvpPlan,
  );
  const hasPreviousPlan = Boolean(flow?.mvpplan && flow.mvpplan.ideaId !== idea.id);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <ThemedText type="subtitle">MVP 기획</ThemedText>
        <ThemedText themeColor="textSecondary">
          선정한 아이디어를 구현 가능한 화면, 일정, 역할과 API 계획으로 정리합니다.
        </ThemedText>
      </View>

      {hasPreviousPlan ? (
        <ThemedView type="backgroundElement" style={[styles.noticeCard, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
          <ThemedText type="smallBold" style={{ color: theme.warning }}>이전 아이디어의 MVP·발표자료를 보존하고 있어요.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">현재 선정 아이디어 기준으로 새 MVP를 만들면 다음 단계를 이어갈 수 있습니다.</ThemedText>
        </ThemedView>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isGenerating }}
        disabled={isGenerating}
        onPress={() => void generatePlan()}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.primary },
          (pressed || isGenerating) && styles.pressed,
        ]}>
        {isGenerating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="smallBold" style={styles.whiteText}>
            {plan ? 'AI로 MVP 계획 다시 만들기' : 'AI로 MVP 계획 만들기'}
          </ThemedText>
        )}
      </Pressable>
      {error ? <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText> : null}

      {plan ? (
        <>
          <ThemedView type="primarySoft" style={[styles.summaryCard, { borderColor: theme.primary }]}>
            <ThemedText type="smallBold">{plan.ideaTitle}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{plan.summary}</ThemedText>
          </ThemedView>
          <Section title="화면 구조와 와이어프레임 초안">
            {plan.screens.map((screen) => (
              <View key={screen.name} style={styles.wireframe}>
                <ThemedText type="smallBold">{screen.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{screen.purpose}</ThemedText>
                <View style={[styles.wireframeBox, { borderColor: theme.primary }]}>
                  {screen.wireframe.map((block) => (
                    <View key={block} style={[styles.wireframeBlock, { backgroundColor: theme.primarySoft }]}>
                      <ThemedText type="small">{block}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Section>
          <Section title="전체 개발 일정">
            {plan.schedule.map((step) => (
              <View key={step.period} style={styles.timeline}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>{step.period}</ThemedText>
                <View style={styles.grow}>
                  <ThemedText type="smallBold">{step.goal}</ThemedText>
                  <BulletList items={step.tasks} />
                </View>
              </View>
            ))}
          </Section>
          <Section title="팀원 역할 분담">
            <View style={styles.grid}>
              {plan.teamRoles.map((role) => (
                <View key={role.role} style={[styles.innerCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold">{role.role}</ThemedText>
                  <BulletList items={role.responsibilities} />
                </View>
              ))}
            </View>
          </Section>
          <Section title="필요 API 목록">
            {plan.apis.map((api) => (
              <View key={api.name} style={styles.apiRow}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>{api.method}</ThemedText>
                <View style={styles.grow}>
                  <ThemedText type="smallBold">{api.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{api.purpose}</ThemedText>
                </View>
              </View>
            ))}
          </Section>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="발표자료 단계로 이동"
            onPress={onGoToPresentation}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.whiteText}>발표자료로 이동</ThemedText>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four, paddingTop: Spacing.two },
  heading: { gap: Spacing.one },
  primaryButton: { minHeight: ControlHeight.button, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: Spacing.four, borderRadius: Radius.medium },
  whiteText: { color: '#fff' },
  pressed: { opacity: 0.7 },
  summaryCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  noticeCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  card: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  sectionTitle: { fontSize: 18, lineHeight: 26 },
  list: { gap: Spacing.one },
  wireframe: { gap: Spacing.two },
  wireframeBox: { gap: Spacing.two, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.medium, padding: Spacing.two },
  wireframeBlock: { padding: Spacing.two, borderRadius: Radius.small },
  timeline: { flexDirection: 'row', gap: Spacing.three },
  grow: { flex: 1, gap: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  innerCard: { minWidth: 220, flex: 1, gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  apiRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
