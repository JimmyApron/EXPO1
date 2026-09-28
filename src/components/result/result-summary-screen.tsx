import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { IdeaResultCard } from '@/components/result/idea-result-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortIdeaResults, type IdeaResultSortMode } from '@/lib/idea-evaluation';
import type { IdeaResultData } from '@/types/result';

type ResultSummaryScreenProps = {
  data: IdeaResultData;
  selectedIdeaId?: string | null;
  canSelect: boolean;
  selectionHint: string;
  isRanking: boolean;
  rankingError: string;
  onRetryRanking: () => void;
  onSelectIdea: (ideaId: string) => Promise<void>;
  onGoToMvp: () => void;
};

export function ResultSummaryScreen({
  data,
  selectedIdeaId,
  canSelect,
  selectionHint,
  isRanking,
  rankingError,
  onRetryRanking,
  onSelectIdea,
  onGoToMvp,
}: ResultSummaryScreenProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<IdeaResultSortMode>('ai');
  const theme = useTheme();
  const sortedIdeas = useMemo(() => sortIdeaResults(data.ideas, sortMode), [data.ideas, sortMode]);

  const select = async (ideaId: string) => {
    if (selectingId) return;
    setSelectingId(ideaId);
    try {
      await onSelectIdea(ideaId);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <ThemedText type="sectionTitle">중간 결과</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            다른 팀원이 평가하면 참여 인원과 통과율이 실시간으로 갱신돼요.
          </ThemedText>
        </View>
        <View style={[styles.participants, { backgroundColor: theme.primarySoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            현재 {data.currentParticipantCount}명 참여
          </ThemedText>
        </View>
      </View>

      {isRanking ? (
        <ThemedView type="backgroundElement" style={[styles.rankingNotice, { borderColor: theme.border }]}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary">평가가 끝나 AI 추천 순위를 계산하고 있어요.</ThemedText>
        </ThemedView>
      ) : null}
      {rankingError ? (
        <ThemedView type="dangerSoft" style={styles.rankingNotice}>
          <ThemedText type="small" style={{ color: theme.danger }}>{rankingError}</ThemedText>
          <Pressable accessibilityRole="button" onPress={onRetryRanking} style={[styles.retryButton, { borderColor: theme.danger }]}>
            <ThemedText type="smallBold">AI 순위 다시 분석</ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      <View style={styles.sortSection}>
        <ThemedText type="smallBold">정렬 기준</ThemedText>
        <View style={styles.sortControls}>
          {([
            ['ai', 'AI 추천 순으로 보기'],
            ['team', '팀 통과율 순으로 보기'],
          ] as const).map(([mode, label]) => {
            const selected = sortMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSortMode(mode)}
                style={({ pressed }) => [
                  styles.sortButton,
                  {
                    backgroundColor: selected ? theme.primary : theme.background,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={selected ? styles.selectedSortText : undefined}>
                  {selected ? `✓ ${label}` : label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {data.aiRecommendationReason ? (
        <ThemedView type="primarySoft" style={[styles.recommendationReason, { borderColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>AI 추천 이유</ThemedText>
          <ThemedText type="small">{data.aiRecommendationReason}</ThemedText>
        </ThemedView>
      ) : null}

      <View style={styles.list}>
        {sortedIdeas.map((idea) => (
          <IdeaResultCard
            key={idea.id}
            idea={idea}
            canSelect={canSelect}
            isSelected={selectedIdeaId === idea.id}
            isSelecting={selectingId === idea.id}
            isDisabled={isRanking || Boolean(selectingId)}
            selectionHint={selectionHint}
            onSelect={() => void select(idea.id)}
            onGoToMvp={onGoToMvp}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headingCopy: { flex: 1, minWidth: 220, gap: Spacing.one },
  participants: {
    minWidth: 140,
    alignItems: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rankingNotice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  retryButton: {
    minHeight: ControlHeight.touch,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  sortSection: { gap: Spacing.two },
  sortControls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  sortButton: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: ControlHeight.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
  },
  selectedSortText: { color: '#FFFFFF' },
  recommendationReason: {
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  list: { gap: Spacing.three },
  pressed: { opacity: 0.65 },
});
