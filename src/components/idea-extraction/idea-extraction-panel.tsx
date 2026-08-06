import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CandidateIdeaCard } from '@/components/idea-extraction/candidate-idea-card';
import {
  ExtractionSourceInput,
  type ExtractionSourceMode,
} from '@/components/idea-extraction/extraction-source-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useCandidateIdeaExtraction } from '@/hooks/use-candidate-idea-extraction';
import { useTheme } from '@/hooks/use-theme';
import { normalizeCandidateIdeas, toCandidateIdeasPayload, validateCandidateIdea } from '@/lib/candidate-idea';
import type { CandidateIdea, CandidateIdeaSaveResult, CandidateIdeasPayload } from '@/types/candidate-idea';

type IdeaExtractionPanelProps = {
  projectId: string;
  onSave: (candidates: CandidateIdea[], extractionRunId: string) => Promise<CandidateIdeaSaveResult>;
  onPayloadChange?: (payload: CandidateIdeasPayload) => void;
};

function createRunId() {
  return `extraction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function IdeaExtractionPanel({ projectId, onSave, onPayloadChange }: IdeaExtractionPanelProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<ExtractionSourceMode>('text');
  const [sourceText, setSourceText] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [candidates, setCandidates] = useState<CandidateIdea[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [extractionRunId, setExtractionRunId] = useState('');
  const [hasExtractionResult, setHasExtractionResult] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const {
    images,
    isPickingImages,
    isExtracting,
    permissionError,
    extractionError,
    pickImages,
    clearImages,
    clearExtractionError,
    extract,
  } = useCandidateIdeaExtraction(projectId);
  const isBusy = isPickingImages || isExtracting || isSaving;
  const unsavedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.id) && !savedIds.has(candidate.id)),
    [candidates, savedIds, selectedIds],
  );

  const replaceCandidates = (nextCandidates: CandidateIdea[]) => {
    const normalized = normalizeCandidateIdeas(nextCandidates);
    setCandidates(normalized);
    setSelectedIds(new Set(normalized.map((candidate) => candidate.id)));
    setSavedIds(new Set());
    const payload = toCandidateIdeasPayload(normalized);
    onPayloadChange?.(payload);
  };

  const runExtraction = async (useEditedOcrText = false) => {
    setSaveError('');
    setSaveNotice('');
    clearExtractionError();

    const response = await extract(
      useEditedOcrText || mode === 'text'
        ? { type: 'text', text: useEditedOcrText ? extractedText : sourceText }
        : { type: 'image' },
    );
    if (!response) {
      return;
    }

    setExtractedText(response.extractedText);
    replaceCandidates(response.candidateIdeas);
    setExtractionRunId(createRunId());
    setHasExtractionResult(true);
  };

  const updateCandidate = (candidate: CandidateIdea) => {
    const nextCandidates = candidates.map((item) => (item.id === candidate.id ? candidate : item));
    setCandidates(nextCandidates);
    onPayloadChange?.(toCandidateIdeasPayload(nextCandidates));
    setSaveError('');
  };

  const toggleCandidate = (candidateId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (isSaving || unsavedCandidates.length === 0) {
      return;
    }

    const normalized = normalizeCandidateIdeas(unsavedCandidates);
    const validationError = normalized.map(validateCandidateIdea).find(Boolean);
    if (validationError || normalized.length !== unsavedCandidates.length) {
      setSaveError(validationError || '제목이 비어 있는 후보는 저장할 수 없습니다.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveNotice('');
    try {
      const result = await onSave(normalized, extractionRunId || createRunId());
      if (result.savedCandidateIds.length > 0) {
        setSavedIds((current) => new Set([...current, ...result.savedCandidateIds]));
      }
      if (result.failures.length > 0) {
        setSaveError(
          `${result.savedCandidateIds.length}개 저장, ${result.failures.length}개 실패: ${result.failures
            .map((failure) => `${failure.title} (${failure.message})`)
            .join(', ')}`,
        );
      } else {
        setSaveNotice(`${result.savedCandidateIds.length}개 아이디어를 저장하고 마인드맵에 배치했습니다.`);
      }
    } catch {
      setSaveError('저장 중 예기치 못한 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectAll = () => setSelectedIds(new Set(candidates.filter((item) => !savedIds.has(item.id)).map((item) => item.id)));
  const clearSelection = () => setSelectedIds(new Set());

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView
        type="backgroundElement"
        style={[styles.panel, { borderColor: theme.border }, Shadows.card]}>
        <View style={styles.heading}>
          <ThemedText type="subtitle">아이디어 추출</ThemedText>
          <ThemedText themeColor="textSecondary">
            회의록이나 카카오톡 캡처에서 후보를 찾고, 검토한 항목만 아이디어 보드와 마인드맵에 저장합니다.
          </ThemedText>
        </View>

        <View style={styles.flowRow} accessibilityLabel="아이디어 추출 단계">
          {['1  자료 입력', '2  AI 추출', '3  후보 검토', '4  선택 저장'].map((step, index) => (
            <View
              key={step}
              style={[
                styles.flowStep,
                { backgroundColor: index === 0 ? theme.primarySoft : theme.background, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold" style={{ color: index === 0 ? theme.primary : theme.textSecondary }}>
                {step}
              </ThemedText>
            </View>
          ))}
        </View>

        <ExtractionSourceInput
          mode={mode}
          text={sourceText}
          images={images}
          isBusy={isBusy}
          permissionError={permissionError}
          onChangeMode={(nextMode) => {
            setMode(nextMode);
            setSaveError('');
            clearExtractionError();
          }}
          onChangeText={setSourceText}
          onPickImages={() => void pickImages()}
          onClearImages={clearImages}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="아이디어 추출하기"
          disabled={isBusy || (mode === 'text' ? !sourceText.trim() : images.length === 0)}
          onPress={() => void runExtraction()}
          style={({ pressed }) => [
            styles.extractButton,
            { backgroundColor: theme.primary },
            (pressed || isBusy || (mode === 'text' ? !sourceText.trim() : images.length === 0)) && styles.pressed,
          ]}>
          {isPickingImages || isExtracting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" />
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {isPickingImages ? '이미지 처리 중…' : mode === 'image' ? 'OCR 및 아이디어 추출 중…' : '아이디어 추출 중…'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="smallBold" style={styles.primaryButtonText}>아이디어 추출하기</ThemedText>
          )}
        </Pressable>

        {extractionError ? (
          <ThemedView type="dangerSoft" style={styles.alertBox}>
            <ThemedText accessibilityRole="alert" type="small" style={[styles.errorText, { color: theme.danger }]}>{extractionError}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="아이디어 추출 다시 시도"
              disabled={isBusy}
              onPress={() => void runExtraction()}
              style={({ pressed }) => [styles.retryButton, (pressed || isBusy) && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.retryText}>다시 시도</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {extractedText ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">{mode === 'image' ? 'OCR로 읽은 원문' : 'AI가 정리한 원문'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              아래 내용은 사용자가 제공한 원문입니다. AI가 만든 후보 아이디어와 구분해서 확인해 주세요.
            </ThemedText>
            <TextInput
              accessibilityLabel="추출된 원문 수정"
              value={extractedText}
              editable={!isBusy}
              multiline
              maxLength={30_000}
              onChangeText={setExtractedText}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.ocrInput,
                { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="수정한 원문으로 아이디어 다시 추출"
              disabled={isBusy || !extractedText.trim()}
              onPress={() => void runExtraction(true)}
              style={({ pressed }) => [styles.secondaryButton, (pressed || isBusy || !extractedText.trim()) && styles.pressed]}>
              <ThemedText type="smallBold">수정한 원문으로 다시 추출</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {candidates.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.candidateToolbar}>
              <View>
                <ThemedText type="smallBold">AI가 추론한 후보 아이디어</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {selectedIds.size}개 선택 · {savedIds.size}개 저장됨
                </ThemedText>
              </View>
              <View style={styles.toolbarActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="후보 전체 선택" disabled={isBusy} onPress={selectAll} style={({ pressed }) => [styles.textButton, (pressed || isBusy) && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.textButtonLabel}>전체 선택</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="후보 전체 선택 해제" disabled={isBusy} onPress={clearSelection} style={({ pressed }) => [styles.textButton, (pressed || isBusy) && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.textButtonLabel}>전체 해제</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.candidateList}>
              {candidates.map((candidate) => (
                <CandidateIdeaCard
                  key={candidate.id}
                  candidate={candidate}
                  isSelected={selectedIds.has(candidate.id)}
                  isSaved={savedIds.has(candidate.id)}
                  isBusy={isBusy}
                  onToggle={() => toggleCandidate(candidate.id)}
                  onChange={updateCandidate}
                />
              ))}
            </View>

            {saveError ? <ThemedText accessibilityRole="alert" type="small" style={styles.errorText}>{saveError}</ThemedText> : null}
            {saveNotice ? <ThemedText accessibilityRole="alert" type="small" style={styles.successText}>{saveNotice}</ThemedText> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="선택한 아이디어 저장 및 마인드맵 생성"
              disabled={isBusy || unsavedCandidates.length === 0}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.success },
                (pressed || isBusy || unsavedCandidates.length === 0) && styles.pressed,
              ]}>
              {isSaving ? <ActivityIndicator color="#ffffff" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>선택한 {unsavedCandidates.length}개 저장하고 마인드맵 만들기</ThemedText>}
            </Pressable>
          </View>
        ) : hasExtractionResult && !isExtracting && !extractionError ? (
          <ThemedView type="background" style={styles.emptyState}>
            <ThemedText type="smallBold">추출할 만한 아이디어를 찾지 못했습니다.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">원문을 보완한 뒤 다시 추출해 보세요. `candidateIdeas: []`는 정상 결과입니다.</ThemedText>
          </ThemedView>
        ) : null}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.four, borderRadius: Radius.large, borderWidth: 1, padding: Spacing.four },
  heading: { gap: Spacing.one },
  flowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  flowStep: { flexGrow: 1, flexBasis: 150, minHeight: 42, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  extractButton: { minHeight: ControlHeight.input, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  primaryButtonText: { color: '#ffffff', textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  section: { gap: Spacing.three },
  ocrInput: { minHeight: 150, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  secondaryButton: { minHeight: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#94a3b8', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  alertBox: { gap: Spacing.two, borderRadius: Radius.medium, padding: Spacing.three },
  retryButton: { minHeight: ControlHeight.touch, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: '#dc2626', borderRadius: Radius.medium },
  retryText: { color: '#b91c1c' },
  candidateToolbar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  textButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.two },
  textButtonLabel: { color: '#4050D0' },
  candidateList: { gap: Spacing.three },
  emptyState: { gap: Spacing.one, borderRadius: Radius.medium, padding: Spacing.three },
  errorText: { color: '#b91c1c' },
  successText: { color: '#168B51' },
  pressed: { opacity: 0.55 },
});
