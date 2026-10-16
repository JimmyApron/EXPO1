import { Pressable, View } from 'react-native';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_KINDS, WRITING_KINDS, type ProjectSettings } from '@/lib/topic-workspace';
import type { ProjectTemplate } from '@/types/project';

export function ProjectSettingsFields({ template, value, onChange, disabled }: { template: ProjectTemplate; value: ProjectSettings; onChange: (settings: ProjectSettings) => void; disabled?: boolean }) {
  const theme = useTheme();
  if (template === 'service_app') return null;
  const set = <K extends keyof ProjectSettings>(key: K, v: ProjectSettings[K]) => onChange({ ...value, [key]: v });
  const choices = (label: string, options: { id: string; label: string }[], selected: string, action: (id: string) => void) => <View style={{ gap: 8 }}>
    <ThemedText type="smallBold">{label}</ThemedText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => <Pressable key={o.id} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: selected === o.id, disabled }} disabled={disabled} onPress={() => action(o.id)}
        style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: selected === o.id ? theme.primary : theme.border, backgroundColor: selected === o.id ? theme.primarySoft : theme.surface, borderRadius: 10, paddingHorizontal: 12 }}><ThemedText type="small">{o.label}</ThemedText></Pressable>)}
    </View></View>;
  const field = (label: string, key: keyof ProjectSettings) => <View key={key} style={{ gap: 6 }}><ThemedText type="smallBold">{label}</ThemedText>
    <TextInput accessibilityLabel={label} editable={!disabled} multiline value={String(value[key] ?? '')} onChangeText={v => set(key, v as never)}
      style={{ minHeight: 60, padding: 12, borderWidth: 1, borderRadius: 10, borderColor: theme.border, color: theme.text, textAlignVertical: 'top' }} /></View>;
  return <View style={{ gap: 16 }}>
    {template === 'report_research' ? choices('보고서 유형', REPORT_KINDS.map(id => ({ id, label: id })), value.reportKind, v => set('reportKind', v))
      : choices('글 종류', [...WRITING_KINDS], value.writingKind, v => set('writingKind', v as ProjectSettings['writingKind']))}
    <View style={{ gap: 6 }}><ThemedText type="smallBold">목표 분량 (선택)</ThemedText>
      <TextInput accessibilityLabel="목표 분량" keyboardType="number-pad" editable={!disabled} value={value.targetLength?.toString() ?? ''}
        onChangeText={v => set('targetLength', /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null)}
        placeholder="미입력 가능" placeholderTextColor={theme.textSecondary} style={{ minHeight: 44, padding: 12, borderWidth: 1, borderRadius: 10, borderColor: theme.border, color: theme.text }} />
    </View>
    {template === 'report_research' ? <>
      {choices('분량 단위', [{ id: 'characters', label: '글자 수' }, { id: 'pages', label: '페이지 수' }], value.lengthUnit, v => set('lengthUnit', v as 'characters' | 'pages'))}
      {choices('참고문헌 형식', ['APA', 'MLA', 'IEEE', '직접 설정', '지정 없음'].map(id => ({ id, label: id })), value.citationStyle, v => set('citationStyle', v))}
      {value.citationStyle === '직접 설정' ? field('참고문헌 작성 규칙', 'customCitation') : null}
    </> : <>{field('예상 독자', 'audience')}{field('글의 목적', 'purpose')}{field('원하는 분위기·문체', 'tone')}{field('반드시 포함할 요소', 'requiredElements')}</>}
    {field('과제 수행 조건', 'requirements')}
  </View>;
}
