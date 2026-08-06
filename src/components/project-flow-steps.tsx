import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ProjectFlowStep = 'final' | 'coach' | 'mvp' | 'presentation';

const steps: { id: ProjectFlowStep; short: string; label: string }[] = [
  { id: 'final', short: '최종안', label: '최종안 확정' },
  { id: 'coach', short: 'A', label: 'AI 코치' },
  { id: 'mvp', short: 'B', label: 'MVP 기획' },
  { id: 'presentation', short: 'C', label: '발표자료' },
];

export function ProjectFlowSteps({ current }: { current: ProjectFlowStep }) {
  const theme = useTheme();
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <View accessibilityLabel="과제 제작 단계" style={styles.container}>
      {steps.map((step, index) => {
        const isCurrent = step.id === current;
        const isComplete = index < currentIndex;

        return (
          <View
            key={step.id}
            style={[
              styles.step,
              { borderColor: theme.border, backgroundColor: theme.background },
              isCurrent && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
            ]}>
            <View
              style={[
                styles.marker,
                { backgroundColor: theme.backgroundSelected },
                isComplete && { backgroundColor: theme.successSoft },
                isCurrent && { backgroundColor: theme.primary },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: isCurrent ? '#FFFFFF' : isComplete ? theme.success : theme.textSecondary }}>
                {isComplete ? '✓' : step.short}
              </ThemedText>
            </View>
            <View style={styles.copy}>
              <ThemedText type="smallBold" style={isCurrent ? { color: theme.primary } : undefined}>
                {step.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textTertiary">
                {isCurrent ? '현재 단계' : isComplete ? '이전 단계' : '다음 단계'}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  step: {
    minHeight: 62,
    flexGrow: 1,
    flexBasis: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  marker: {
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.one,
  },
  copy: {
    flex: 1,
  },
});
