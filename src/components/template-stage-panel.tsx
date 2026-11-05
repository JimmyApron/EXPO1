import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ProjectStage } from '@/lib/project-stages';
import type { ProjectStageRecord } from '@/hooks/use-project-stage-progress';

export function TemplateStagePanel({ stage, record, isTeamProject, onSave }: {
  stage: ProjectStage;
  record?: ProjectStageRecord;
  isTeamProject: boolean;
  onSave: (content: string, isCompleted: boolean) => Promise<{ error?: string }>;
}) {
  const theme = useTheme();
  const [content, setContent] = useState(record?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const timeout = globalThis.setTimeout(() => setContent(record?.content ?? ''), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [record?.content, stage.id]);

  const save = async (isCompleted: boolean) => {
    if (busy) return;
    if (isCompleted && !content.trim()) { setError('단계 내용을 입력해 주세요.'); return; }
    setBusy(true); setError(''); setNotice('');
    const result = await onSave(content, isCompleted);
    if (result.error) setError(result.error);
    else setNotice(isCompleted ? '단계를 완료했습니다.' : '단계 내용을 저장했습니다.');
    setBusy(false);
  };

  return <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
    <ThemedText type="sectionTitle">{stage.label}</ThemedText>
    {isTeamProject ? <ThemedText type="small" themeColor="textSecondary">이 단계에서 정리한 내용을 팀과 공유하세요. 저장한 내용은 방의 다른 팀원도 볼 수 있습니다.</ThemedText> : null}
    <TextInput accessibilityLabel={`${stage.label} 단계 내용`} value={content} onChangeText={setContent} multiline editable={!busy}
      placeholder={`${stage.label} 내용을 입력해 주세요`} placeholderTextColor={theme.textSecondary}
      style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${stage.label} 내용 저장`} disabled={busy} onPress={() => void save(Boolean(record?.iscompleted))} style={[styles.button, { borderColor: theme.border }]}><ThemedText type="smallBold">저장</ThemedText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${stage.label} ${record?.iscompleted ? '완료 취소' : '완료'}`} disabled={busy} onPress={() => void save(!record?.iscompleted)} style={[styles.button, { backgroundColor: theme.primary }]}><ThemedText type="smallBold">{record?.iscompleted ? '완료 취소' : '단계 완료'}</ThemedText></Pressable>
      {busy ? <ActivityIndicator /> : null}
    </View>
    {error ? <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>{error}</ThemedText> : null}
    {notice ? <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.success }}>{notice}</ThemedText> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 18, gap: 12 },
  input: { minHeight: 180, borderWidth: 1, borderRadius: 10, padding: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  button: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 16 },
});
