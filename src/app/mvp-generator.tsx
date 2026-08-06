import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { selectedIdea } from '@/constants/mvp';
import { useMvpPlan } from '@/hooks/use-mvp-plan';
import { useTheme } from '@/hooks/use-theme';

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bulletRow}>
          <ThemedText style={styles.bullet}>•</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.bulletText}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

export default function MvpGeneratorScreen() {
  const { plan, isGenerating, error, generatePlan } = useMvpPlan();
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary">‹ 이전 화면</ThemedText>
          </Pressable>

          <View style={styles.hero}>
            <View style={styles.badge}><ThemedText type="smallBold" style={styles.badgeText}>AI MVP GENERATOR</ThemedText></View>
            <ThemedText type="subtitle">{plan.ideaTitle}</ThemedText>
            <ThemedText themeColor="textSecondary">{plan.summary}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">선정 아이디어: {selectedIdea.id} · {selectedIdea.targetUsers}</ThemedText>
            <Pressable disabled={isGenerating} onPress={generatePlan} style={({ pressed }) => [styles.generateButton, (pressed || isGenerating) && styles.pressed]}>
              {isGenerating ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.buttonText}>AI로 MVP 계획 생성</ThemedText>}
            </Pressable>
            {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          </View>

          <View style={styles.twoColumn}>
            <Section title="MVP 필수 기능">
              {plan.mustHaveFeatures.map((feature) => <View key={feature.name} style={styles.item}><ThemedText type="smallBold">{feature.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{feature.description}</ThemedText></View>)}
            </Section>
            <Section title="추후 기능">
              {plan.laterFeatures.map((feature) => <View key={feature.name} style={styles.item}><ThemedText type="smallBold">{feature.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{feature.description}</ThemedText></View>)}
            </Section>
          </View>

          <Section title="화면 구조와 와이어프레임 초안">
            {plan.screens.map((screen) => <View key={screen.name} style={styles.wireframe}><ThemedText type="smallBold">{screen.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{screen.purpose}</ThemedText><View style={styles.wireframeBox}>{screen.wireframe.map((block) => <View key={block} style={styles.wireframeBlock}><ThemedText type="small">{block}</ThemedText></View>)}</View></View>)}
          </Section>

          <Section title="전체 개발 일정">
            {plan.schedule.map((step) => <View key={step.period} style={styles.timeline}><View style={styles.period}><ThemedText type="smallBold" style={styles.periodText}>{step.period}</ThemedText></View><View style={styles.grow}><ThemedText type="smallBold">{step.goal}</ThemedText><BulletList items={step.tasks} /></View></View>)}
          </Section>

          <Section title="팀원 역할 분담">
            <View style={styles.cardGrid}>{plan.teamRoles.map((role) => <View key={role.role} style={styles.card}><ThemedText type="smallBold">{role.role}</ThemedText><BulletList items={role.responsibilities} /></View>)}</View>
          </Section>

          <Section title="필요 API 목록">
            {plan.apis.map((api) => <View key={api.name} style={styles.apiRow}><View style={styles.method}><ThemedText type="smallBold" style={styles.methodText}>{api.method}</ThemedText></View><View style={styles.grow}><ThemedText type="smallBold">{api.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{api.purpose}</ThemedText></View></View>)}
          </Section>

          <Section title="발표 순서">
            {plan.presentationOrder.map((item, index) => <View key={item} style={styles.presentationRow}><View style={styles.number}><ThemedText type="smallBold" style={styles.numberText}>{index + 1}</ThemedText></View><ThemedText type="small" style={styles.grow}>{item}</ThemedText></View>)}
          </Section>
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: BottomTabInset + Spacing.four },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.three },
  backButton: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  hero: { gap: Spacing.three, paddingVertical: Spacing.three },
  badge: { alignSelf: 'flex-start', backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  badgeText: { color: '#6d28d9', letterSpacing: 1 },
  generateButton: { alignSelf: 'flex-start', backgroundColor: '#6d28d9', paddingHorizontal: Spacing.four, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: '#fff' }, error: { color: '#dc2626' }, pressed: { opacity: 0.65 },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  section: { flex: 1, minWidth: 280, gap: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, borderColor: '#e2e8f0', padding: Spacing.three },
  sectionTitle: { fontSize: 18, lineHeight: 26 }, item: { gap: Spacing.one },
  list: { gap: Spacing.one }, bulletRow: { flexDirection: 'row', gap: Spacing.two }, bullet: { color: '#7c3aed' }, bulletText: { flex: 1 },
  wireframe: { gap: Spacing.two }, wireframeBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#a78bfa', borderRadius: 12, padding: Spacing.two, gap: Spacing.two },
  wireframeBlock: { backgroundColor: '#ede9fe', padding: Spacing.two, borderRadius: 8 },
  timeline: { flexDirection: 'row', gap: Spacing.three }, period: { backgroundColor: '#6d28d9', borderRadius: 8, padding: Spacing.two, alignSelf: 'flex-start' }, periodText: { color: '#fff' }, grow: { flex: 1 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, card: { minWidth: 220, flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  apiRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }, method: { minWidth: 52, backgroundColor: '#ddd6fe', borderRadius: 6, padding: 6, alignItems: 'center' }, methodText: { color: '#5b21b6', fontSize: 11 },
  presentationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three }, number: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }, numberText: { color: '#fff' },
});
