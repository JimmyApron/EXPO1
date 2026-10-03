import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const metrics = [
  { label: '기획 속도', value: '3x', description: '기존보다 빠른 MVP 설계' },
  { label: '핵심 기능', value: '8개', description: '우선순위 기반 추천' },
  { label: '팀 협업', value: '1팀', description: '의견 반영과 검토 흐름' },
];

const features = [
  {
    title: 'MVP 기획',
    body: '프로젝트 목적과 팀 수준을 바탕으로 적합한 MVP 범위를 빠르게 정리합니다.',
  },
  {
    title: 'AI 추천 근거',
    body: '왜 이 기능이 우선인지, 어떤 기준으로 선택됐는지 명확하게 제공합니다.',
  },
  {
    title: '팀 의견 반영',
    body: '수정 요청, 피드백, 재생성까지 팀 협업 흐름을 그대로 이어갑니다.',
  },
  {
    title: '검토용 요약',
    body: '결과를 간단하게 정리하고 손쉽게 다음 단계로 넘길 수 있습니다.',
  },
];

const workflow = [
  '프로젝트 정보 입력',
  '팀의 개발 경험과 범위 선택',
  'AI 추천 결과 확인',
  '팀 의견 반영',
  '다음 단계 이동',
];

export default function PresentationScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <ThemedText type="small" themeColor="textSecondary">
            AI 기반 프로젝트 기획
          </ThemedText>

          <ThemedText type="title" style={styles.title}>
            MVP를 더 빠르게, 더 명확하게 설계하세요
          </ThemedText>

          <ThemedText type="body" themeColor="textSecondary" style={styles.subtitle}>
            팀의 개발 경험, 목표, 기능 우선순위를 반영해 AI가 실현 가능한 MVP를 추천합니다.
          </ThemedText>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="MVP 기획 시작하기"
              onPress={() => router.push('/mvp-generator')}
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                시작하기
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="프로젝트 목록 보기"
              onPress={() => router.push('/projects')}
              style={[
                styles.secondaryButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
            >
              <ThemedText type="smallBold">프로젝트 보기</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsRow}>
          {metrics.map((item) => (
            <View
              key={item.label}
              style={[
                styles.metricCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedText type="small" themeColor="textSecondary">
                {item.label}
              </ThemedText>
              <ThemedText type="title" style={styles.metricValue}>
                {item.value}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.description}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="sectionTitle">핵심 기능</ThemedText>
        </View>

        <View style={styles.featureGrid}>
          {features.map((feature) => (
            <View
              key={feature.title}
              style={[
                styles.featureCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedText type="smallBold">{feature.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.featureBody}>
                {feature.body}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="sectionTitle">간단한 진행 흐름</ThemedText>
        </View>

        <View
          style={[
            styles.workflowCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          {workflow.map((step, index) => (
            <View key={step} style={styles.workflowRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.primarySoft || '#EAF1FF' },
                ]}
              >
                <ThemedText type="smallBold" style={styles.badgeText}>
                  {index + 1}
                </ThemedText>
              </View>

              <ThemedText type="smallBold" style={styles.workflowText}>
                {step}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={[styles.ctaCard, { backgroundColor: theme.primarySoft || '#EAF1FF' }]}>
          <ThemedText type="sectionTitle">지금 바로 MVP를 시작해 보세요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.ctaText}>
            팀에 맞는 기능 범위와 AI 추천 결과를 한 번에 정리할 수 있습니다.
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="MVP 생성 시작"
            onPress={() => router.push('/mvp-generator')}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              MVP 생성 시작
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  hero: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  title: {
    maxWidth: 420,
  },
  subtitle: {
    maxWidth: 560,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
  primaryButton: {
    minHeight: ControlHeight.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButton: {
    minHeight: ControlHeight.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.two,
    gap: 6,
  },
  metricValue: {
    fontSize: 28,
    lineHeight: 32,
  },
  sectionHeader: {
    paddingTop: Spacing.one,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  featureCard: {
    flexBasis: '48%',
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.two,
    gap: 8,
  },
  featureBody: {
    lineHeight: 20,
  },
  workflowCard: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  workflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#1A3FA9',
  },
  workflowText: {
    flex: 1,
  },
  ctaCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  ctaText: {
    lineHeight: 20,
  },
});
