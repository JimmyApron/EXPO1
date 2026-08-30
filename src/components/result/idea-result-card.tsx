import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

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
}: IdeaResultCardProps) {
  const theme = useTheme();
  const isSelectionDisabled = isSelecting || isDisabled || (!isSelected && !canSelect);

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
          <ThemedText type="cardTitle">{idea.label}</ThemedText>
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
