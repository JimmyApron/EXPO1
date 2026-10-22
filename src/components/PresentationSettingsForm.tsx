import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PresentationThemePicker } from '@/components/presentation-theme-picker';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PresentationSettings } from '@/types/presentation';

const presets = [5, 7, 10, 12, 15];

export function PresentationSettingsForm({ value, onChange, regenerating, busy, onSubmit, onApplyTheme, onCancel }: {
  value: PresentationSettings;
  onChange: (value: PresentationSettings) => void;
  regenerating: boolean;
  busy: boolean;
  onSubmit: () => void;
  onApplyTheme?: () => void;
  onCancel?: () => void;
}) {
  const theme = useTheme();
  const set = <K extends keyof PresentationSettings>(key: K, next: PresentationSettings[K]) => onChange({ ...value, [key]: next });
  const choice = (label: string, selected: boolean, action: () => void) => <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }} onPress={action} style={styles.choice}>
    <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : 'transparent' }]}>{selected ? <View style={styles.dot} /> : null}</View>
    <ThemedText>{label}</ThemedText>
  </Pressable>;
  const divider = <View style={[styles.divider, { backgroundColor: theme.border }]} />;
  return <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
    <View style={styles.header}><ThemedText type="cardTitle">AI 발표자료 {regenerating ? '재생성' : '생성'} 설정</ThemedText><ThemedText type="caption" themeColor="textSecondary">설정은 생성 전에 언제든 바꿀 수 있습니다.</ThemedText></View>
    <ThemedText type="smallBold">발표자료 제목</ThemedText>
    <TextInput accessibilityLabel="발표자료 제목" value={value.title} onChangeText={(text) => set('title', text)} editable={!busy} maxLength={200} placeholder="발표자료 제목" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
    {divider}
    <ThemedText type="smallBold">발표자료 페이지 수</ThemedText>
    <View style={styles.counter}>
      <Pressable accessibilityRole="button" accessibilityLabel="페이지 수 감소" disabled={busy || value.pageCount <= 3} onPress={() => set('pageCount', Math.max(3, value.pageCount - 1))} style={[styles.counterButton, { borderColor: theme.border }]}><ThemedText type="subtitle">−</ThemedText></Pressable>
      <View style={styles.counterValue}><TextInput accessibilityLabel="페이지 수 직접 입력" value={String(value.pageCount)} onChangeText={(text) => { if (!/^\d{1,2}$/.test(text)) return; const parsed = Number(text); if (parsed >= 3 && parsed <= 20) set('pageCount', parsed); }} keyboardType="number-pad" editable={!busy} style={[styles.pageInput, { color: theme.text }]} /><ThemedText type="caption" themeColor="textSecondary">페이지 · 표지와 마무리 포함</ThemedText></View>
      <Pressable accessibilityRole="button" accessibilityLabel="페이지 수 증가" disabled={busy || value.pageCount >= 20} onPress={() => set('pageCount', Math.min(20, value.pageCount + 1))} style={[styles.counterButton, { borderColor: theme.border }]}><ThemedText type="subtitle">＋</ThemedText></Pressable>
    </View>
    <View style={styles.row}>{presets.map((count) => <Pressable key={count} accessibilityRole="button" accessibilityState={{ selected: value.pageCount === count }} onPress={() => set('pageCount', count)} style={[styles.preset, { borderColor: value.pageCount === count ? theme.primary : theme.border, backgroundColor: value.pageCount === count ? theme.primary : 'transparent' }]}><ThemedText type="smallBold" style={{ color: value.pageCount === count ? theme.primaryText : theme.text }}>{count}장</ThemedText></Pressable>)}</View>
    {divider}
    <ThemedText type="smallBold">디자인 테마</ThemedText>
    <PresentationThemePicker value={value.theme} onChange={next => set('theme', next)} disabled={busy} />
    {divider}
    <ThemedText type="smallBold">발표 시간 (선택)</ThemedText>
    <View style={styles.row}>{[5, 10, 15].map((minutes) => choice(`${minutes}분`, value.durationMinutes === minutes, () => set('durationMinutes', value.durationMinutes === minutes ? undefined : minutes)))}</View>
    <ThemedText type="smallBold">발표 목적 (선택)</ThemedText>
    <TextInput accessibilityLabel="발표 목적" value={value.purpose ?? ''} onChangeText={(text) => set('purpose', text)} editable={!busy} maxLength={500} placeholder="예: 수업 프로젝트 최종 평가 발표" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
    <ThemedText type="smallBold">추가 요청사항 (선택)</ThemedText>
    <TextInput accessibilityLabel="추가 요청사항" value={value.additionalRequests ?? ''} onChangeText={(text) => set('additionalRequests', text)} editable={!busy} multiline maxLength={1000} placeholder="원하는 구성이나 강조할 내용을 적어주세요." placeholderTextColor={theme.textSecondary} style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]} />
    <ThemedText type="caption" themeColor="textSecondary">AI 사용량 4단위 · 설정을 열거나 수정하는 동안에는 차감되지 않습니다.</ThemedText>
    <Pressable accessibilityRole="button" disabled={busy || !value.title.trim()} onPress={onSubmit} style={[styles.submit, { backgroundColor: '#FBC843' }, (busy || !value.title.trim()) && styles.disabled]}><ThemedText type="button" style={{ color: '#171717' }}>{regenerating ? '발표자료 재생성하기' : `${value.pageCount}페이지 발표자료 생성하기`}</ThemedText></Pressable>
    {onApplyTheme ? <Pressable accessibilityRole="button" disabled={busy} onPress={onApplyTheme} style={[styles.themeApply, { borderColor: theme.primary }]}><ThemedText type="smallBold" style={{ color: theme.primary }}>디자인만 변경 · AI 0단위</ThemedText></Pressable> : null}
    {onCancel ? <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancel}><ThemedText type="smallBold" themeColor="textSecondary">취소</ThemedText></Pressable> : null}
  </ThemedView>;
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  header: { gap: Spacing.one },
  divider: { height: 1, marginVertical: Spacing.one },
  input: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  multiline: { minHeight: 88, paddingVertical: Spacing.two, textAlignVertical: 'top' },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  counterButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  counterValue: { minWidth: 130, alignItems: 'center', gap: 0 },
  pageInput: { fontSize: 32, fontWeight: '700', textAlign: 'center', minWidth: 60, padding: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  preset: { minHeight: 40, borderWidth: 1, borderRadius: 24, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  choice: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginRight: Spacing.three },
  radio: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  submit: { minHeight: 58, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  themeApply: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  cancel: { alignItems: 'center', padding: Spacing.one },
  disabled: { opacity: 0.55 },
});
