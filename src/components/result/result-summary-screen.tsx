import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IdeaResultCard } from '@/components/result/idea-result-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IdeaResultData } from '@/types/result';

type Props = { data: IdeaResultData; selectedIdeaId?: string | null; onGoToEvaluation: () => void; onSelectIdea: (ideaId: string) => Promise<void> };

export function ResultSummaryScreen({ data, selectedIdeaId, onGoToEvaluation, onSelectIdea }: Props) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const theme = useTheme();
  if (!data.currentUserEvaluatedAll) return <ThemedView type="backgroundElement" style={[styles.locked, { borderColor: theme.border }]}><ThemedText type="cardTitle">모든 아이디어를 평가하면 현재 결과를 볼 수 있어요</ThemedText><ThemedText type="small" themeColor="textSecondary">평가 전에는 AI 추천 순위와 다른 팀원의 결과를 공개하지 않아요.</ThemedText><Pressable accessibilityRole="button" onPress={onGoToEvaluation} style={[styles.evaluateButton, { borderColor: theme.primary }]}><ThemedText type="button" style={{ color: theme.primary }}>아이디어 평가하러 가기</ThemedText></Pressable></ThemedView>;
  const canSelect = data.currentUserRole === 'leader' || data.currentParticipantCount >= Math.ceil(data.teamSize / 2);
  const select = async (ideaId: string) => { setSelectingId(ideaId); try { await onSelectIdea(ideaId); } finally { setSelectingId(null); } };
  return <View style={styles.container}><View style={styles.heading}><View><ThemedText type="sectionTitle">중간 결과</ThemedText><ThemedText type="small" themeColor="textSecondary">다른 팀원이 평가하면 참여 인원과 통과율이 갱신될 수 있어요.</ThemedText></View><View style={[styles.participants, { backgroundColor: theme.primarySoft }]}><ThemedText type="smallBold" style={{ color: theme.primary }}>현재 {data.currentParticipantCount}명 참여</ThemedText><ThemedText type="caption" style={{ color: theme.primary }}>팀 {data.teamSize}명</ThemedText></View></View><View style={styles.list}>{[...data.ideas].sort((a, b) => a.aiRank - b.aiRank).map((idea) => <IdeaResultCard key={idea.id} idea={idea} canSelect={canSelect} isSelected={selectedIdeaId === idea.id} isSelecting={selectingId === idea.id} onSelect={() => void select(idea.id)} />)}</View></View>;
}

const styles = StyleSheet.create({ container: { gap: Spacing.three }, heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three }, participants: { minWidth: 116, alignItems: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, list: { gap: Spacing.three }, locked: { alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four }, evaluateButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, marginTop: Spacing.one } });
