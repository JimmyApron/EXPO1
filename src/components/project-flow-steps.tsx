import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ProjectWorkflowStep } from '@/lib/project-workspace';

const steps: { id: ProjectWorkflowStep; label: string }[] = [
  { id: 'extraction', label: '아이디어 추출' },
  { id: 'selection', label: 'AI 비교·선정' },
  { id: 'mvp', label: 'MVP 기획' },
  { id: 'presentation', label: '발표자료' },
];

type ProjectFlowStepsProps = {
  current: ProjectWorkflowStep;
  completed?: Partial<Record<ProjectWorkflowStep, boolean>>;
  onStepPress: (step: ProjectWorkflowStep) => void;
};

export function ProjectFlowSteps({ current, completed = {}, onStepPress }: ProjectFlowStepsProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="과제 작업 흐름"
      style={[styles.container, { borderColor: theme.border }]}>
      {steps.map((step, index) => {
        const isCurrent = step.id === current;
        const isComplete = Boolean(completed[step.id]);
        const stateLabel = isCurrent ? '현재 단계' : isComplete ? '완료' : '시작 전';

        return (
          <Pressable
            key={step.id}
            accessibilityRole="tab"
            accessibilityLabel={`${step.label}, ${stateLabel}`}
            accessibilityState={{ selected: isCurrent }}
            onPress={() => onStepPress(step.id)}
            style={({ pressed }) => [
              styles.step,
              index > 0 && { borderLeftWidth: 1, borderLeftColor: theme.border },
              isCurrent && { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              type="smallBold"
              numberOfLines={2}
              style={[styles.stepLabel, { color: isCurrent ? '#FFFFFF' : theme.textSecondary }]}>
              {step.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderRadius: Radius.medium },
  step: {
    minWidth: 0,
    minHeight: Math.max(ControlHeight.touch, 52),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
  },
  stepLabel: { textAlign: 'center' },
  pressed: { opacity: 0.65 },
});
