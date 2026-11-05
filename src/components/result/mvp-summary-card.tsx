import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MvpSummary } from '@/types/result';

function DetailList({ title, items }: { title: string; items: string[] }) {
  return <View style={styles.list}><ThemedText type="smallBold">{title}</ThemedText>{items.map((item, index) => <ThemedText key={`${item}:${index}`} type="small" themeColor="textSecondary">• {item}</ThemedText>)}</View>;
}

export function MvpSummaryCard({ summary, children, featureDetails, apiDetails }: { summary: MvpSummary; children?: ReactNode; featureDetails?: ReactNode; apiDetails?: ReactNode }) {
  const theme = useTheme();
  return (
    <>
      <ThemedView type="background" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="cardTitle">MVP 요약</ThemedText>
        <ThemedText type="small" themeColor="textSecondary"><ThemedText type="smallBold">핵심: </ThemedText>{summary.core}</ThemedText>
      </ThemedView>
      <ThemedView type="background" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="cardTitle">MVP 상세</ThemedText>
        <View style={styles.details}>
          {featureDetails ?? <DetailList title="필수 기능" items={summary.essentialFeatures} />}
          <DetailList title="추후 기능" items={summary.laterFeatures} />
          <DetailList title="개발 일정" items={summary.schedule} />
          {apiDetails ?? <DetailList title="필요 API" items={summary.requiredApis} />}
          {children}
        </View>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({ card: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three }, details: { gap: Spacing.three }, list: { gap: Spacing.one } });
