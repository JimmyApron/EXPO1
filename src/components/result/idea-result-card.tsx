import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IdeaResult } from '@/types/result';

type IdeaResultCardProps = {
  idea: IdeaResult;
  canSelect: boolean;
  isSelected: boolean;
  isSelecting: boolean;
  isDisabled: boolean;
  selectionHint: string;
  onSelect: () => void;
  onGoToMvp: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onAddFeedback: (content: string) => Promise<{ error?: string }>;
};

export function IdeaResultCard({
  idea,
  canSelect,
  isSelected,
  isSelecting,
  isDisabled,
  selectionHint,
  onSelect,
  onGoToMvp,
  onEdit,
  onRegenerate,
  onAddFeedback,
}: IdeaResultCardProps) {
  const theme = useTheme();
  const isSelectionDisabled = isSelecting || isDisabled || (!isSelected && !canSelect);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const submitFeedback = async () => {
    if (!feedbackDraft.trim() || feedbackBusy) return;
    setFeedbackBusy(true); setFeedbackError(''); setFeedbackNotice('');
    try {
      const result = await onAddFeedback(feedbackDraft);
      if (result.error) throw new Error(result.error);
      setFeedbackDraft(''); setFeedbackOpen(false); setFeedbackNotice('팀 의견을 저장했습니다.');
    } catch (cause) { setFeedbackError(cause instanceof Error ? cause.message : '팀 의견을 저장하지 못했습니다.'); }
    finally { setFeedbackBusy(false); }
  };

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        { borderColor: isSelected ? theme.success : theme.border },
        isSelected && { backgroundColor: theme.successSoft },
        Shadows.card,
      ]}>
      <View style={styles.header}>
        <View style={styles.grow}>
          {idea.number ? <ThemedText type="smallBold" style={{ color: theme.primary }}>아이디어 {idea.number}</ThemedText> : null}
          <ThemedText type="cardTitle">{idea.label}</ThemedText>
          {idea.summary ? <ThemedText type="small" themeColor="textSecondary">{idea.summary}</ThemedText> : null}
          <ThemedText type="small" themeColor="textSecondary">
            팀 통과율 {idea.passRate}% ({idea.passCount}명/{idea.participantCount}명)
          </ThemedText>
        </View>
        {idea.aiRank ? (
          <View style={[styles.rank, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              AI 추천 {idea.aiRank}위
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.analysis}>
        <ThemedView type="primarySoft" style={[styles.insightCard, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">추천 이유</ThemedText>
          <ThemedText type="small">{idea.aiAdvantages.filter(Boolean).join(' · ') || '추천 근거가 아직 없습니다.'}</ThemedText>
          <ThemedText type="smallBold">사용한 입력·판단 기준</ThemedText>
          <ThemedText type="small">아이디어 설명, 팀 평가 {idea.passCount}/{idea.participantCount}명 통과, 구현 난이도 {idea.difficulty || '정보 없음'}</ThemedText>
          <ThemedText type="smallBold">주의할 점·한계</ThemedText>
          <ThemedText type="small">{idea.aiRisk || 'AI 분석은 참고용입니다. 팀에서 실제 구현 범위와 일정을 확인해 주세요.'}</ThemedText>
        </ThemedView>
        <View style={styles.analysisBlock}>
          <ThemedText type="smallBold">AI 장점</ThemedText>
          {idea.aiAdvantages.map((advantage, index) => (
            <ThemedText key={`${advantage}:${index}`} type="small" themeColor="textSecondary">
              • {advantage}
            </ThemedText>
          ))}
        </View>
        <ThemedText type="small">
          <ThemedText type="smallBold">AI 리스크: </ThemedText>
          {idea.aiRisk}
        </ThemedText>
        <ThemedText type="small">
          <ThemedText type="smallBold">구현 난이도: </ThemedText>
          {idea.difficulty}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${idea.label} 수정`} onPress={onEdit} style={[styles.actionButton, { borderColor: theme.border }]}><ThemedText type="smallBold">수정</ThemedText></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${idea.label} 팀 의견 남기기`} onPress={() => setFeedbackOpen((open) => !open)} style={[styles.actionButton, { borderColor: theme.border }]}><ThemedText type="smallBold">팀 의견 남기기</ThemedText></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${idea.label} AI 추천 재생성 요청`} disabled={isDisabled} onPress={onRegenerate} style={[styles.actionButton, { borderColor: theme.border }, isDisabled && styles.disabled]}><ThemedText type="smallBold">재생성 요청</ThemedText></Pressable>
      </View>
      {feedbackOpen ? <View style={styles.feedbackBox}><TextInput accessibilityLabel={`${idea.label} 팀 의견 입력`} value={feedbackDraft} onChangeText={setFeedbackDraft} editable={!feedbackBusy} multiline maxLength={1000} placeholder="아이디어에 대한 의견을 입력해 주세요" placeholderTextColor={theme.textSecondary} style={[styles.feedbackInput, { color: theme.text, borderColor: theme.border }]} /><Pressable accessibilityRole="button" accessibilityLabel="팀 의견 저장" accessibilityState={{ disabled: feedbackBusy || !feedbackDraft.trim() }} disabled={feedbackBusy || !feedbackDraft.trim()} onPress={() => void submitFeedback()} style={[styles.actionButton, { borderColor: theme.primary }]}><ThemedText type="smallBold" style={{ color: theme.primary }}>{feedbackBusy ? '저장 중' : '의견 저장'}</ThemedText></Pressable></View> : null}
      {feedbackError ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{feedbackError}</ThemedText> : null}
      {feedbackNotice ? <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.success }}>{feedbackNotice}</ThemedText> : null}

      {isSelected ? (
        <ThemedText accessibilityLiveRegion="polite" type="smallBold" style={{ color: theme.success }}>
          ✓ 최종 선정된 아이디어
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSelectionDisabled }}
        disabled={isSelectionDisabled}
        onPress={isSelected ? onGoToMvp : onSelect}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: isSelected ? theme.success : theme.primary },
          (pressed || isSelectionDisabled) && styles.disabled,
        ]}>
        {isSelecting && !isSelected ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText type="button" style={styles.whiteText}>
            {isSelected ? 'MVP 기획으로 이동' : '최종 아이디어로 선정'}
          </ThemedText>
        )}
      </Pressable>
      {!canSelect && !isSelected ? (
        <ThemedText type="caption" themeColor="textSecondary">{selectionHint}</ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.large, borderWidth: 1 },
  header: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 220, gap: Spacing.one },
  rank: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  analysis: { gap: Spacing.two },
  insightCard: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actionButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  feedbackBox: { gap: Spacing.two },
  feedbackInput: { minHeight: 72, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.two, textAlignVertical: 'top' },
  analysisBlock: { gap: Spacing.one },
  button: {
    minHeight: ControlHeight.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  disabled: { opacity: 0.5 },
  whiteText: { color: '#FFFFFF' },
});
