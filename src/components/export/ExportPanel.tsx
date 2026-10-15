import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExportData } from '@/types/export';
import { downloadAsDocx } from '@/utils/fileExport';
import { formatForNotion, fullResultText, presentationMarkdown, presentationOutline, presentationScript } from '@/utils/export/exportFormats';
import { copyForKakao } from '@/utils/export/copyForKakao';
import { copyForNotion } from '@/utils/export/copyForNotion';
import { exportToPdf } from '@/utils/export/exportToPdf';
import { exportToPptx } from '@/utils/export/exportToPptx';
import { saveFile } from '@/utils/export/saveFile';

type Action = { label: string; run: () => Promise<unknown>; message: string };
type Card = { icon: string; title: string; description: string; unavailable?: string; actions: Action[] };

export function ExportPanel({ data }: { data: ExportData }) {
  const theme = useTheme();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const hasSlides = Boolean(data.presentation?.slides?.length);
  const fileMessage = Platform.OS === 'web' ? '파일 다운로드를 시작했습니다.' : '공유 창을 닫았습니다. 선택한 앱에서 저장 여부를 확인해 주세요.';
  const docx = (content: string, kind: string) => downloadAsDocx(content, `${data.idea.title.slice(0, 70)}_${kind}.docx`, { documentType: kind, projectTitle: data.projectTitle });
  const copy = async (value: string) => { if (!await Clipboard.setStringAsync(value)) throw new Error('클립보드에 접근할 수 없습니다.'); };

  const groups: { title: string; cards: Card[] }[] = [
    { title: '문서', cards: [
      { icon: '📄', title: 'DOCX', description: '사업계획서와 최종보고서', actions: [
        { label: '사업계획서 저장', run: () => docx(data.presentation?.businessPlanDraft || formatForNotion(data), '사업계획서'), message: fileMessage },
        { label: '최종보고서 저장', run: () => docx(data.presentation?.finalReport || formatForNotion(data), '최종보고서'), message: fileMessage },
      ] },
      { icon: '📑', title: 'PDF', description: '사업계획서와 최종보고서', actions: [
        { label: '사업계획서 저장', run: () => exportToPdf(data, 'business-plan'), message: Platform.OS === 'web' ? '인쇄 창에서 “PDF로 저장”을 선택해 주세요.' : fileMessage },
        { label: '최종보고서 저장', run: () => exportToPdf(data, 'final-report'), message: Platform.OS === 'web' ? '인쇄 창에서 “PDF로 저장”을 선택해 주세요.' : fileMessage },
      ] },
      { icon: '📝', title: 'Markdown', description: '생성된 발표 슬라이드와 대본을 문서로 저장', unavailable: hasSlides ? undefined : '발표자료를 생성하면 사용할 수 있습니다.', actions: [
        { label: '.md 파일 저장', run: () => saveFile(presentationMarkdown(data), `${data.projectTitle}_발표자료.md`, 'text/markdown'), message: fileMessage },
        { label: 'Markdown 복사', run: () => copy(presentationMarkdown(data)), message: 'Markdown이 복사되었습니다.' },
      ] },
    ] },
    { title: '발표', cards: [
      { icon: '🎙️', title: '발표 대본', description: '생성된 슬라이드별 발표 내용', unavailable: hasSlides ? undefined : '발표자료를 생성하면 사용할 수 있습니다.', actions: [
        { label: '대본 복사', run: () => copy(presentationScript(data)), message: '발표 대본이 복사되었습니다.' },
      ] },
      { icon: '📋', title: 'PPT 목차', description: '생성된 슬라이드 제목과 핵심 bullet', unavailable: hasSlides ? undefined : '발표자료를 생성하면 사용할 수 있습니다.', actions: [
        { label: '목차 복사', run: () => copy(presentationOutline(data)), message: 'PPT 목차가 복사되었습니다.' },
      ] },
    ] },
    { title: '공유', cards: [
      { icon: '💬', title: '카카오톡 공유', description: '카카오톡에 붙여넣을 짧은 텍스트', actions: [
        { label: '카톡용 복사', run: () => copyForKakao(data), message: '카톡 공유용 텍스트가 복사되었습니다.' },
      ] },
      { icon: '📚', title: 'Notion 복사', description: '선정 아이디어와 MVP 결과 Markdown', actions: [
        { label: '노션 마크다운 복사', run: () => copyForNotion(data), message: '노션 마크다운이 복사되었습니다.' },
      ] },
      { icon: '📎', title: '전체 복사', description: data.presentation ? '슬라이드·대본·예상 질문·문서를 한 번에 복사' : '현재 아이디어와 MVP 결과를 한 번에 복사', actions: [
        { label: '전체 결과 복사', run: () => copy(fullResultText(data)), message: '읽기 쉬운 전체 결과가 복사되었습니다.' },
      ] },
    ] },
  ];

  const run = async (action: Action, actionId: string) => {
    if (busy) return;
    setBusy(actionId);
    setMessage('');
    setFailed(false);
    try {
      await action.run();
      setMessage(action.message);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : '내보내기에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy('');
    }
  };

  return (
    <ThemedView type="backgroundElement" style={[styles.panel, { borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.itemCopy}>
          <ThemedText type="subtitle">결과물 저장·공유</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">현재 저장된 버전을 발표 파일로 저장하거나 문서·복사 형식을 선택하세요.</ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="PPTX 저장" accessibilityState={{ disabled: Boolean(busy), busy: busy === 'quick:pptx' }} disabled={Boolean(busy)} onPress={() => void run({ label: 'PPTX 저장', run: () => exportToPptx(data), message: fileMessage }, 'quick:pptx')} style={[styles.quickAction, { backgroundColor: theme.primary }, Boolean(busy) && styles.pressed]}>
          {busy === 'quick:pptx' ? <ActivityIndicator color={theme.primaryText} size="small" /> : <ThemedText type="smallBold" style={{ color: theme.primaryText }}>PPTX 저장</ThemedText>}
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFormats }} onPress={() => setShowFormats((open) => !open)} style={[styles.action, { borderColor: theme.border }]}>
        <ThemedText type="smallBold">{showFormats ? '다른 형식 접기' : 'PDF·DOCX·복사 등 다른 형식 보기'}</ThemedText>
      </Pressable>
      {showFormats ? groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <ThemedText type="smallBold">{group.title}</ThemedText>
          <View style={styles.list}>
            {group.cards.map((card) => (
              <View key={card.title} style={[styles.item, { borderColor: theme.border }]}>
                <View style={styles.itemCopy}>
                  <ThemedText type="smallBold">{card.title}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">{card.unavailable ?? card.description}</ThemedText>
                </View>
                {!card.unavailable ? <View style={styles.actions}>{card.actions.map((action) => (
                  <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`${card.title} ${action.label}`}
                    accessibilityState={{ disabled: Boolean(busy), busy: busy === `${group.title}:${card.title}:${action.label}` }} disabled={Boolean(busy)} onPress={() => void run(action, `${group.title}:${card.title}:${action.label}`)}
                    style={({ pressed }) => [styles.action, { borderColor: theme.border }, (pressed || Boolean(busy)) && styles.pressed]}>
                    {busy === `${group.title}:${card.title}:${action.label}` ? <ActivityIndicator color={theme.primary} size="small" /> : null}
                    <ThemedText type="captionStrong">{action.label}</ThemedText>
                  </Pressable>
                ))}</View> : null}
              </View>
            ))}
          </View>
        </View>
      )) : null}
      {message ? <ThemedText accessibilityLiveRegion="polite" type="small" style={{ color: failed ? theme.danger : theme.text }}>{message}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  quickAction: { minHeight: 44, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: Spacing.one, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  group: { gap: Spacing.one },
  list: { gap: Spacing.one },
  item: { borderTopWidth: 1, paddingVertical: Spacing.two, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  itemCopy: { flexGrow: 1, flexBasis: 180, gap: Spacing.one },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pressed: { opacity: 0.55 },
});
