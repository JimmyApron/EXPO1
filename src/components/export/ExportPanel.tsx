import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExportButton } from './ExportButton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExportData } from '@/types/export';
import { downloadAsDocx } from '@/utils/fileExport';
import { formatForNotion } from '@/utils/export/exportFormats';
import { copyForKakao } from '@/utils/export/copyForKakao';
import { copyForNotion } from '@/utils/export/copyForNotion';
import { exportToPdf } from '@/utils/export/exportToPdf';
import { exportToPptx } from '@/utils/export/exportToPptx';

export function ExportPanel({ data }: { data: ExportData }) {
  const theme = useTheme();
  const lock = useRef(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const fileMessage = Platform.OS === 'web' ? '파일 다운로드를 시작했습니다.' : '공유 창을 닫았습니다. 선택한 앱에서 저장 여부를 확인해 주세요.';
  const docx = (content: string, kind: string) => downloadAsDocx(content, `${data.idea.title.slice(0, 70)}_${kind}.docx`, { documentType: kind, projectTitle: data.projectTitle });
  const actions = [
    { label: '사업계획서 DOCX 다운로드', run: () => docx(data.presentation?.businessPlanDraft || formatForNotion(data), '사업계획서'), message: fileMessage },
    { label: '최종보고서 DOCX 다운로드', run: () => docx(data.presentation?.finalReport || formatForNotion(data), '최종보고서'), message: fileMessage },
    { label: 'PPTX 다운로드', run: () => exportToPptx(data), message: fileMessage },
    { label: 'PDF 다운로드', run: () => exportToPdf(data), message: Platform.OS === 'web' ? '인쇄 창에서 “PDF로 저장”을 선택해 주세요.' : fileMessage },
    { label: '카톡용 복사', run: () => copyForKakao(data), message: '카톡 공유용 텍스트가 복사되었습니다.' },
    { label: '노션 마크다운 복사', run: () => copyForNotion(data), message: '노션 마크다운이 복사되었습니다.' },
    { label: '전체 결과 복사', run: async () => { if (!await Clipboard.setStringAsync(JSON.stringify(data.presentation ?? data, null, 2))) throw new Error('클립보드에 접근할 수 없습니다.'); }, message: '전체 결과가 복사되었습니다.' },
  ];
  const run = async (action: typeof actions[number]) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(action.label);
    setMessage('');
    setFailed(false);
    try {
      await action.run();
      setMessage(action.message);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : '내보내기에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      lock.current = false;
      setBusy('');
    }
  };
  return (
    <ThemedView type="backgroundElement" style={[styles.panel, { borderColor: theme.border }]}>
      <ThemedText type="subtitle">내보내기 / 공유</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">선정 아이디어와 MVP 결과를 문서와 공유용 텍스트로 저장합니다.</ThemedText>
      {Platform.OS === 'web' ? <ThemedText type="small" themeColor="textSecondary">PDF는 새 인쇄 창에서 ‘PDF로 저장’을 선택하세요.</ThemedText> : null}
      <View style={styles.actions}>{actions.map((action) => <ExportButton key={action.label} label={action.label} disabled={Boolean(busy)} busy={busy === action.label} onPress={() => void run(action)} />)}</View>
      {message ? <ThemedText accessibilityLiveRegion="polite" type="small" style={{ color: failed ? theme.danger : theme.text }}>{message}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({ panel: { padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two } });
