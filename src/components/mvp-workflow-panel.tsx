import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MvpEffortTags } from '@/components/mvp-effort-tags';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { MvpSummaryCard } from '@/components/result/mvp-summary-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useMvpPlan } from '@/hooks/use-mvp-plan';
import type { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import { extractKeywordsFromText, formatMvpDuration, mergeKeywordLists, normalizeTeamExperience } from '@/lib/mvp';
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
    problem: idea.problem,
    solution: idea.solution,
    coreFeatures: idea.corefeatures,
  }), [idea]);
  const { plan, isGenerating, error, generatePlan } = useMvpPlan(
    mvpIdea,
    conditions,
    flow?.mvpplan,
    saveMvpPlan,
  );
  const hasPreviousPlan = Boolean(flow?.mvpplan && flow.mvpplan.ideaId !== idea.id);
  const teamExperienceLabel = normalizeTeamExperience(conditions.skillLevel);
  const durationLabel = formatMvpDuration(conditions.durationWeeks);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keywordSaving, setKeywordSaving] = useState(false);
  const [keywordError, setKeywordError] = useState('');
  const autoKeywords = plan ? extractKeywordsFromText([
    plan.summary,
    ...plan.mustHaveFeatures.flatMap((feature) => [feature.name, feature.description]),
    ...plan.schedule.flatMap((step) => [step.goal, ...step.tasks]),
  ].join(' ')) : [];
  const keywords = plan ? mergeKeywordLists(
    autoKeywords.filter((keyword) => !(plan.removedKeywords ?? []).includes(keyword)),
    plan.manualKeywords ?? [],
  ) : [];
  const saveKeywords = async (manualKeywords: string[], removedKeywords: string[]) => {
    if (!plan || keywordSaving) return;
    setKeywordSaving(true); setKeywordError('');
    try {
      const result = await saveMvpPlan({ ...plan, manualKeywords, removedKeywords });
      if (result.error) throw new Error(result.error);
      return true;
    } catch (cause) { setKeywordError(cause instanceof Error ? cause.message : '키워드를 저장하지 못했습니다.'); }
    finally { setKeywordSaving(false); }
    return false;
  };
  const addKeyword = async () => {
    const next = keywordDraft.trim();
    if (!next || !plan || keywords.some((keyword) => keyword.toLowerCase() === next.toLowerCase())) return;
    if (await saveKeywords([...(plan.manualKeywords ?? []), next], (plan.removedKeywords ?? []).filter((item) => item.toLowerCase() !== next.toLowerCase()))) setKeywordDraft('');
  };
  const removeKeyword = async (keyword: string) => {
    if (!plan) return;
    await saveKeywords((plan.manualKeywords ?? []).filter((item) => item !== keyword), [...(plan.removedKeywords ?? []), keyword]);
  };

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

      <ThemedView type="backgroundElement" style={[styles.metaCard, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <ThemedText type="smallBold">현재 추천 기준</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          팀의 개발 경험: {teamExperienceLabel}{teamExperienceLabel === '잘 모르겠어요' ? ' (중급 기준 추천)' : ''} · 예상 기간: {durationLabel}
        </ThemedText>
      </ThemedView>

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
          <ThemedText type="smallBold" style={{ color: theme.primary }}>{plan.ideaTitle}</ThemedText>
          <Section title="프로젝트 핵심 키워드">
            <ThemedText type="small" themeColor="textSecondary">MVP 계획에서 추출했습니다. 직접 추가하거나 제거한 내용은 계획을 다시 만들어도 유지됩니다.</ThemedText>
            <View style={styles.grid}>{keywords.length ? keywords.map((keyword) => <Pressable key={keyword} accessibilityRole="button" accessibilityLabel={`${keyword} 키워드 삭제`} disabled={keywordSaving} onPress={() => void removeKeyword(keyword)} style={[styles.keywordChip, { borderColor: theme.border }]}><ThemedText type="smallBold">{keyword} ×</ThemedText></Pressable>) : <ThemedText type="small">키워드가 없습니다. 직접 추가해 주세요.</ThemedText>}</View>
            <View style={styles.grid}><TextInput accessibilityLabel="핵심 키워드 입력" value={keywordDraft} onChangeText={setKeywordDraft} editable={!keywordSaving} placeholder="키워드 추가" placeholderTextColor={theme.textSecondary} style={[styles.keywordInput, { color: theme.text, borderColor: theme.border }]} /><Pressable accessibilityRole="button" accessibilityLabel="핵심 키워드 추가" accessibilityState={{ disabled: !keywordDraft.trim() || keywordSaving }} disabled={!keywordDraft.trim() || keywordSaving} onPress={() => void addKeyword()} style={[styles.primaryButton, { backgroundColor: theme.primary }]}><ThemedText type="smallBold" style={styles.whiteText}>{keywordSaving ? '저장 중' : '추가'}</ThemedText></Pressable></View>
            {keywordError ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{keywordError}</ThemedText> : null}
          </Section>
          <MvpSummaryCard
            featureDetails={(
              <Section title="필수 기능 · 구현 난이도">
                <ThemedText type="small" themeColor="textSecondary">초급 개발자 1명, 주 10시간 기준 AI 추정입니다. 학습·테스트를 포함하며 기능과 API의 중복 작업량은 단순 합산하지 마세요.</ThemedText>
                {plan.mustHaveFeatures.map((feature, index) => (
                  <View key={`${feature.name}:${index}`} style={styles.list}>
                    <ThemedText type="smallBold">{feature.name}</ThemedText>
                    <ThemedText type="small">{feature.description}</ThemedText>
                    <MvpEffortTags effort={feature.effort} />
                  </View>
                ))}
              </Section>
            )}
            apiDetails={(
              <Section title="필요 API · 구현 난이도">
                {plan.apis.length === 0 ? <ThemedText type="small">별도 API 연동 없음</ThemedText> : null}
                {plan.apis.map((api, index) => (
                  <View key={`${api.name}:${index}`} style={styles.list}>
                    <ThemedText type="smallBold">{api.method} {api.name}</ThemedText>
                    <ThemedText type="small">{api.purpose}</ThemedText>
                    <MvpEffortTags effort={api.effort} />
                  </View>
                ))}
              </Section>
            )}
            summary={{
              core: plan.summary,
              essentialFeatures: plan.mustHaveFeatures.map((feature) => `${feature.name} — ${feature.description}`),
              laterFeatures: plan.laterFeatures.map((feature) => `${feature.name} — ${feature.description}`),
              schedule: plan.schedule.map((step) => `${step.period} · ${step.goal} · ${step.tasks.join(', ')}`),
              requiredApis: plan.apis.map((api) => `${api.method} ${api.name} · ${api.purpose}`),
            }}>
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
          </MvpSummaryCard>
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
  noticeCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  metaCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  card: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  sectionTitle: { fontSize: 18, lineHeight: 26 },
  list: { gap: Spacing.one },
  wireframe: { gap: Spacing.two },
  wireframeBox: { gap: Spacing.two, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.medium, padding: Spacing.two },
  wireframeBlock: { padding: Spacing.two, borderRadius: Radius.small },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  innerCard: { minWidth: 220, flex: 1, gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  keywordChip: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  keywordInput: { minWidth: 160, flex: 1, minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
});
