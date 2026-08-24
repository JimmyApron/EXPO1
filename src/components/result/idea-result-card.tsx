import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { MvpSummaryCard } from '@/components/result/mvp-summary-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IdeaResult } from '@/types/result';

type Props = { idea: IdeaResult; canSelect: boolean; isSelected: boolean; isSelecting: boolean; onSelect: () => void };

export function IdeaResultCard({ idea, canSelect, isSelected, isSelecting, onSelect }: Props) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: isSelected ? theme.success : theme.border }, isSelected && { backgroundColor: theme.successSoft }, Shadows.card]}>
      <View style={styles.header}><View style={styles.grow}><ThemedText type="cardTitle">{idea.title}</ThemedText><ThemedText type="small" themeColor="textSecondary">통과 {idea.passCount}표 · 팀 통과율 {idea.passRate}% · 현재 {idea.participantCount}명 참여</ThemedText></View><View style={[styles.rank, { backgroundColor: theme.primarySoft }]}><ThemedText type="smallBold" style={{ color: theme.primary }}>AI 추천 {idea.aiRank}위</ThemedText></View></View>
      <View style={styles.analysis}><ThemedText type="small"><ThemedText type="smallBold">장점: </ThemedText>{idea.aiStrength}</ThemedText><ThemedText type="small"><ThemedText type="smallBold">리스크: </ThemedText>{idea.aiRisk}</ThemedText><ThemedText type="small"><ThemedText type="smallBold">구현 난이도: </ThemedText>{idea.difficulty}</ThemedText></View>
      <MvpSummaryCard summary={idea.mvpSummary} />
      {isSelected ? <ThemedText accessibilityLiveRegion="polite" type="smallBold" style={{ color: theme.success }}>✓ 최종 선정된 아이디어</ThemedText> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSelect || isSelected }} disabled={!canSelect || isSelected || isSelecting} onPress={onSelect} style={[styles.button, { backgroundColor: theme.primary }, (!canSelect || isSelected || isSelecting) && styles.disabled]}>{isSelecting ? <ActivityIndicator color="#fff" /> : <ThemedText type="button" style={styles.white}>{isSelected ? '최종 선정 완료' : '최종 아이디어로 선정'}</ThemedText>}</Pressable>
      {!canSelect ? <ThemedText type="caption" themeColor="textSecondary">팀장 또는 과반수 참여 후 최종 선정할 수 있어요</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({ card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.large, borderWidth: 1 }, header: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'flex-start' }, grow: { flex: 1, minWidth: 220, gap: Spacing.one }, rank: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }, analysis: { gap: Spacing.one }, button: { minHeight: ControlHeight.button, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three }, disabled: { opacity: 0.45 }, white: { color: '#fff' } });
