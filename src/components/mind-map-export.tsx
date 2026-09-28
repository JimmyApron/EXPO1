import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import {
  createMindMapExportPayload,
  mindMapToMarkdown,
  mindMapToOutline,
  mindMapToScript,
  mindMapToStructuredText,
  saveMindMapMarkdown,
} from '@/lib/mind-map-export';
import type { Idea } from '@/types/idea';
import type { MindMapNode } from '@/types/mind-map';
import { saveFile } from '@/utils/export/saveFile';

type PreviewKind = 'script' | 'outline' | 'markdown' | 'figma';

const labels: Record<PreviewKind, string> = {
  script: '발표 대본 뼈대',
  outline: 'PPT 슬라이드 목차',
  markdown: 'Markdown',
  figma: 'Figma용 구조화 텍스트',
};

export function MindMapExport({ title, nodes, ideas }: { title: string; nodes: MindMapNode[]; ideas: Idea[] }) {
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [saveError, setSaveError] = useState('');
  const payload = useMemo(() => createMindMapExportPayload(title, nodes, ideas), [title, nodes, ideas]);
  const texts = useMemo(() => ({
    script: mindMapToScript(payload),
    outline: mindMapToOutline(payload),
    markdown: mindMapToMarkdown(payload),
    figma: mindMapToStructuredText(payload),
  }), [payload]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const open = (kind: PreviewKind) => {
    setSaveError('');
    setToast('');
    setPreview(kind);
  };
  const copy = async () => {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const copied = await Clipboard.setStringAsync(texts[preview]);
      if (!copied) throw new Error('클립보드에 접근할 수 없습니다.');
      setToast(`${labels[preview]} 복사에 성공했습니다.`);
      setSaveError('');
    } catch (error) {
      setToast(`복사에 실패했습니다: ${error instanceof Error ? error.message : '다시 시도해 주세요.'}`);
    } finally {
      setBusy(false);
    }
  };
  const saveMarkdown = async () => {
    if (busy) return;
    setBusy(true);
    setSaveError('');
    try {
      const result = await saveMindMapMarkdown(payload, saveFile);
      if (result.saved) {
        setToast(Platform.OS === 'web' ? 'Markdown 다운로드를 시작했습니다.' : '공유 창을 닫았습니다. 저장한 앱에서 파일을 확인해 주세요.');
      } else {
        setSaveError(`파일 저장에 실패했습니다: ${result.error} 아래의 “클립보드에 복사”로 내용을 보관할 수 있습니다.`);
        setToast('파일 저장에 실패했습니다. 복사로 대체할 수 있습니다.');
      }
    } catch {
      setSaveError('파일 저장에 실패했습니다. 아래의 “클립보드에 복사”로 내용을 보관할 수 있습니다.');
      setToast('파일 저장에 실패했습니다. 복사로 대체할 수 있습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">마인드맵 내보내기</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">아이디어 구조와 노드, 아이디어 상세 정보를 내보냅니다. 접힌 노드도 포함됩니다.</ThemedText>
      <View style={styles.actions}>
        <ExportAction label="발표 대본 뼈대 복사" onPress={() => open('script')} />
        <ExportAction label="PPT 슬라이드 목차 복사" onPress={() => open('outline')} />
        <ExportAction label="Markdown 내보내기" onPress={() => open('markdown')} />
        <ExportAction label="Figma로 보내기" onPress={() => open('figma')} />
      </View>
      {toast && !preview ? <View style={styles.toast}><ThemedText accessibilityLiveRegion="polite" style={styles.toastText}>{toast}</ThemedText></View> : null}
      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View accessibilityViewIsModal style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="미리보기 닫기" onPress={() => setPreview(null)} />
          <View style={[styles.modal, Shadows.floating]}>
            <ThemedText type="subtitle">{preview ? `${labels[preview]} 미리보기` : ''}</ThemedText>
            {preview === 'figma' ? <ThemedText type="small" themeColor="textSecondary">Figma 자동 생성은 연결 후 사용할 수 있습니다. 아래 텍스트나 Markdown을 복사해 Figma에 붙여넣으세요.</ThemedText> : null}
            <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
              <ThemedText selectable style={styles.previewText}>{preview ? texts[preview] : ''}</ThemedText>
            </ScrollView>
            {saveError ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{saveError}</ThemedText> : null}
            {toast ? <View style={styles.toast}><ThemedText accessibilityLiveRegion="polite" style={styles.toastText}>{toast}</ThemedText></View> : null}
            <View style={styles.modalActions}>
              <ExportAction label="클립보드에 복사" disabled={busy} onPress={() => void copy()} />
              {preview === 'markdown' ? <ExportAction label=".md 파일 저장" disabled={busy} onPress={() => void saveMarkdown()} /> : null}
              {preview === 'figma' ? <ExportAction label="Markdown 미리보기" disabled={busy} onPress={() => open('markdown')} /> : null}
              <ExportAction label="닫기" disabled={busy} onPress={() => setPreview(null)} />
              {busy ? <ActivityIndicator color="#D97706" /> : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ExportAction({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, (pressed || disabled) && styles.pressed]}>
    <ThemedText type="smallBold">{label}</ThemedText>
  </Pressable>;
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderColor: '#F3E8D6', borderRadius: Radius.large, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: Radius.medium, backgroundColor: '#FAF7F2' },
  pressed: { opacity: 0.55 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.55)', padding: Spacing.three },
  modal: { width: '100%', maxWidth: 700, maxHeight: '85%', padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.large, backgroundColor: '#FFFFFF' },
  previewScroll: { flexGrow: 0, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: Radius.medium, backgroundColor: '#FAF7F2' },
  previewContent: { padding: Spacing.three },
  previewText: { color: '#1E293B', fontSize: 13, lineHeight: 21 },
  modalActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  toast: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.medium, backgroundColor: '#1E293B' },
  toastText: { color: '#FFFFFF', fontSize: 13 },
  error: { color: '#B91C1C', fontSize: 13 },
});
