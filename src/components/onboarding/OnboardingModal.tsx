import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useExperience } from '@/context/ExperienceContext';
import { useTheme } from '@/hooks/use-theme';
import { sampleCandidateIdeas, sampleSimpleMvpPlan } from '@/constants/sample-project';

export function OnboardingModal() {
  const { onboarding, closeOnboarding } = useExperience();
  const [demo, setDemo] = useState(false);
  const theme = useTheme();
  const close = (remember: boolean) => { setDemo(false); closeOnboarding(remember); };
  return <Modal visible={onboarding} transparent animationType="fade" onRequestClose={() => close(false)}>
    <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 }}>
      <View accessibilityViewIsModal style={{ maxHeight: '90%', width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: theme.background, borderRadius: 20 }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <ThemedText type="sectionTitle" accessibilityRole="header">아이디어를 결과물로 만드는 네 단계</ThemedText>
          {['아이디어 입력', 'AI 분석/평가', '아이디어 선정', 'MVP 또는 결과물 제작'].map((label, i) => <ThemedText key={label}>{i + 1}. {label}</ThemedText>)}
          {demo ? <View style={{ gap: 12 }}><ThemedText type="cardTitle">예시 프로젝트 · 읽기 전용</ThemedText>{sampleCandidateIdeas.map((idea) => <View key={idea.id}><ThemedText type="smallBold">{idea.title}</ThemedText><ThemedText>{idea.summary}</ThemedText></View>)}<ThemedText>결과물: {sampleSimpleMvpPlan.essentialFeatures.join(', ')}</ThemedText></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="예시 프로젝트로 둘러보기" onPress={() => setDemo(!demo)} style={{ padding: 12 }}><ThemedText type="button">{demo ? '예시 접기' : '예시 프로젝트로 둘러보기'}</ThemedText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="온보딩 완료하고 시작하기" onPress={() => close(true)} style={{ padding: 12 }}><ThemedText type="button">시작하기</ThemedText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="온보딩 다시 보지 않기" onPress={() => close(true)} style={{ padding: 12 }}><ThemedText type="button">다시 보지 않기</ThemedText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="온보딩 닫고 홈 이용하기" onPress={() => close(false)} style={{ padding: 12 }}><ThemedText type="button">나중에 보기</ThemedText></Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
