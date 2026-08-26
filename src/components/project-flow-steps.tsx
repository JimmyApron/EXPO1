import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import type { ProjectWorkflowStep } from '@/lib/project-workspace';

// 🎨 디자인 가이드 팔레트
const PALETTE = {
  primary: '#F59E0B',        // 현재 활성 단계 (메인 옐로우)
  activeText: '#FFFFFF',     // 활성 단계 글자색
  containerBg: '#FFFFFF',    // 컨테이너 배경
  border: '#F3E8D6',         // 테두리 크림색
  stepDivider: '#F1EAD9',    // 단계 구분선
  text: '#1E293B',           // 짙은 네이비
  textSecondary: '#64748B',  // 미완료 텍스트
  completeText: '#10B981',   // 완료 표시 초록
  completeBg: '#ECFDF5',     // 완료 단계 배경
};

const steps: { id: ProjectWorkflowStep; label: string; stepNumber: number }[] = [
  { id: 'extraction', label: '아이디어 추출', stepNumber: 1 },
  { id: 'selection', label: 'AI 비교·선정', stepNumber: 2 },
  { id: 'mvp', label: 'MVP 기획', stepNumber: 3 },
  { id: 'presentation', label: '발표자료', stepNumber: 4 },
];

type ProjectFlowStepsProps = {
  current: ProjectWorkflowStep;
  completed?: Partial<Record<ProjectWorkflowStep, boolean>>;
  onStepPress: (step: ProjectWorkflowStep) => void;
};

export function ProjectFlowSteps({ current, completed = {}, onStepPress }: ProjectFlowStepsProps) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="과제 작업 흐름"
      style={[styles.container, Shadows.card]}>
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
              index > 0 && styles.stepBorderLeft,
              isCurrent && styles.currentStep,
              !isCurrent && isComplete && styles.completedStep,
              pressed && styles.pressed,
            ]}>
            <View style={styles.stepContent}>
              {/* 스텝 번호 또는 완료 체크 표시 */}
              <View
                style={[
                  styles.stepBadge,
                  isCurrent && styles.currentStepBadge,
                  !isCurrent && isComplete && styles.completedStepBadge,
                ]}>
                <ThemedText
                  style={[
                    styles.stepBadgeText,
                    isCurrent && styles.currentStepBadgeText,
                    !isCurrent && isComplete && styles.completedStepBadgeText,
                  ]}>
                  {isComplete && !isCurrent ? '✓' : step.stepNumber}
                </ThemedText>
              </View>

              {/* 스텝 이름 */}
              <ThemedText
                numberOfLines={2}
                style={[
                  styles.stepLabel,
                  isCurrent && styles.currentStepLabel,
                  !isCurrent && isComplete && styles.completedStepLabel,
                ]}>
                {step.label}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.containerBg,
    borderRadius: Radius.large,
  },
  step: {
    minWidth: 0,
    minHeight: 56,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: Spacing.two,
  },
  stepBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: PALETTE.stepDivider,
  },
  currentStep: {
    backgroundColor: PALETTE.primary,
  },
  completedStep: {
    backgroundColor: PALETTE.containerBg,
  },
  stepContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  completedStepBadge: {
    backgroundColor: PALETTE.completeBg,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: PALETTE.textSecondary,
    lineHeight: 12,
  },
  currentStepBadgeText: {
    color: '#FFFFFF',
  },
  completedStepBadgeText: {
    color: PALETTE.completeText,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  currentStepLabel: {
    color: PALETTE.activeText,
    fontWeight: '800',
  },
  completedStepLabel: {
    color: PALETTE.text,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
