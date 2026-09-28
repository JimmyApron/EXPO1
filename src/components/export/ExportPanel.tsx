import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExportData } from '@/types/export';
import { downloadAsDocx } from '@/utils/fileExport';
import { formatForNotion, presentationMarkdown, presentationOutline, presentationScript } from '@/utils/export/exportFormats';
import { copyForKakao } from '@/utils/export/copyForKakao';
import { copyForNotion } from '@/utils/export/copyForNotion';
import { exportToPdf } from '@/utils/export/exportToPdf';
import { exportToPptx } from '@/utils/export/exportToPptx';
import { saveFile } from '@/utils/export/saveFile';

type Action = { label: string; run: () => Promise<unknown>; message: string };
type Card = { icon: string; title: string; description: string; unavailable?: string; actions: Action[] };

export function ExportPanel({ data }: { data: ExportData }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const lock = useRef(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
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
      { icon: '📊', title: 'PPTX', description: '생성된 슬라이드를 발표 파일로 저장', actions: [
        { label: 'PPTX 저장', run: () => exportToPptx(data), message: fileMessage },
      ] },
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
      { icon: '📎', title: '전체 복사', description: '발표자료 또는 현재 결과 전체 데이터', actions: [
        { label: '전체 결과 복사', run: () => copy(JSON.stringify(data.presentation ?? data, null, 2)), message: '전체 결과가 복사되었습니다.' },
      ] },
    ] },
  ];

  const run = async (action: Action, actionId: string) => {
    if (lock.current) return;
    lock.current = true;
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
      lock.current = false;
      setBusy('');
    }
  };

  return (
    <ThemedView type="backgroundElement" style={[styles.panel, { borderColor: theme.border }]}>
      <ThemedText type="subtitle">내보내기 / 공유</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">발표자료 내보내기는 생성된 발표 슬라이드 기반입니다. 마인드맵 내보내기는 마인드맵 화면에서 아이디어 구조와 노드를 기반으로 제공합니다.</ThemedText>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <ThemedText type="smallBold">{group.title}</ThemedText>
          <View style={styles.grid}>
            {group.cards.map((card) => (
              <View key={card.title} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement, width: width < 650 ? '100%' : '31.5%' }]}>
                <ThemedText style={styles.icon}>{card.icon}</ThemedText>
                <ThemedText type="smallBold">{card.title}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">{card.description}</ThemedText>
                <ThemedText type="caption" style={{ color: card.unavailable ? theme.danger : theme.primary }}>
                  {card.unavailable ? '준비 필요' : '현재 지원'}
                </ThemedText>
                {card.unavailable ? <ThemedText type="caption" themeColor="textSecondary">{card.unavailable}</ThemedText> : null}
                {!card.unavailable ? card.actions.map((action) => (
                  <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`${card.title} ${action.label}`}
                    accessibilityState={{ disabled: Boolean(busy), busy: busy === `${group.title}:${card.title}:${action.label}` }} disabled={Boolean(busy)} onPress={() => void run(action, `${group.title}:${card.title}:${action.label}`)}
                    style={({ pressed }) => [styles.action, { borderColor: theme.border }, (pressed || Boolean(busy)) && styles.pressed]}>
                    {busy === `${group.title}:${card.title}:${action.label}` ? <ActivityIndicator color={theme.primary} size="small" /> : null}
                    <ThemedText type="captionStrong">{action.label}</ThemedText>
                  </Pressable>
                )) : null}
              </View>
            ))}
          </View>
        </View>
      ))}
      {message ? <ThemedText accessibilityLiveRegion="polite" type="small" style={{ color: failed ? theme.danger : theme.text }}>{message}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.four, gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large },
  group: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { minWidth: 210, padding: Spacing.three, gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium },
  icon: { fontSize: 22 },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pressed: { opacity: 0.55 },
});
