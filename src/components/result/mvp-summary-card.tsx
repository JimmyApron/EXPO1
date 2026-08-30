import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MvpSummary } from '@/types/result';

function DetailList({ title, items }: { title: string; items: string[] }) {
  return <View style={styles.list}><ThemedText type="smallBold">{title}</ThemedText>{items.map((item) => <ThemedText key={item} type="small" themeColor="textSecondary">• {item}</ThemedText>)}</View>;
}

export function MvpSummaryCard({ summary }: { summary: MvpSummary }) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  return (
    <ThemedView type="background" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="cardTitle">MVP 요약</ThemedText>
      <ThemedText type="small" themeColor="textSecondary"><ThemedText type="smallBold">핵심: </ThemedText>{summary.core}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.toggle}>
        <ThemedText type="button" style={{ color: theme.primary }}>{expanded ? 'MVP 상세 접기 ▲' : 'MVP 상세 보기 ▼'}</ThemedText>
      </Pressable>
      {expanded ? <View style={styles.details}><DetailList title="필수 기능" items={summary.essentialFeatures} /><DetailList title="추후 기능" items={summary.laterFeatures} /><DetailList title="개발 일정" items={summary.schedule} /><DetailList title="필요 API" items={summary.requiredApis} /></View> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({ card: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three }, toggle: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' }, details: { gap: Spacing.three }, list: { gap: Spacing.one } });
