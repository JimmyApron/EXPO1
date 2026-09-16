import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

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
import {
  findCandidateDuplicateReferences,
  mergeCandidateIdeas,
  normalizeCandidateIdeas,
  toCandidateIdeasPayload,
  validateCandidateIdea,
} from '@/lib/candidate-idea';
import type { CandidateIdea, CandidateIdeaSaveResult, CandidateIdeasPayload } from '@/types/candidate-idea';
import type { CompleteProjectConditions } from '@/types/project-flow';

type IdeaExtractionPanelProps = {
  projectId: string;
  defaultTopic: string;
  hasMindMap: boolean;
  onSave: (candidates: CandidateIdea[], extractionRunId: string, topic: string) => Promise<CandidateIdeaSaveResult>;
  onGoToMindMap: () => void;
  onGoToSelection: () => void;
  conditions: CompleteProjectConditions;
  onSaveConditions: (conditions: CompleteProjectConditions) => Promise<{ error?: string }>;
  onPayloadChange?: (payload: CandidateIdeasPayload) => void;
};

type ConditionFieldKey = 'durationWeeks' | 'teamSize' | 'budget';
type ConditionFieldValues = Record<ConditionFieldKey, string>;
const skillLevels = ['초급', '중급', '고급'] as const;
type SkillLevel = (typeof skillLevels)[number];

function conditionInputValues(conditions: CompleteProjectConditions): ConditionFieldValues {
  return {
    durationWeeks: String(conditions.durationWeeks),
    teamSize: String(conditions.teamSize),
    budget: String(conditions.budget),
  };
}

function conditionFieldError(key: ConditionFieldKey, value: string) {
  if (!value) return '0 이상의 값을 입력해 주세요.';
  const numericValue = Number(value);
  if (key === 'durationWeeks' && (numericValue < 1 || numericValue > 104)) return '기간은 1~104주로 입력해 주세요.';
  if (key === 'teamSize' && (numericValue < 1 || numericValue > 100)) return '팀 인원은 1~100명으로 입력해 주세요.';
  return '';
}

function normalizedSkillLevel(value: string): SkillLevel {
  if (value.includes('고급')) return '고급';
  if (value.includes('중급')) return '중급';
  return '초급';
}

function createRunId() {
  return `extraction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function IdeaExtractionPanel({ projectId, defaultTopic, hasMindMap, onSave, onGoToMindMap, onGoToSelection, conditions, onSaveConditions, onPayloadChange }: IdeaExtractionPanelProps) {
  const theme = useTheme();
  const [mode, setMode] = useState<ExtractionSourceMode>('text');
  const [sourceText, setSourceText] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [candidates, setCandidates] = useState<CandidateIdea[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [memoIds, setMemoIds] = useState<Set<string>>(new Set());
  const [reviewMessage, setReviewMessage] = useState('');
  const [extractionRunId, setExtractionRunId] = useState('');
  const [hasExtractionResult, setHasExtractionResult] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedIdeaCount, setSavedIdeaCount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [topic, setTopic] = useState(defaultTopic);
  const [conditionValues, setConditionValues] = useState<ConditionFieldValues>(() => conditionInputValues(conditions));
  const [conditionErrors, setConditionErrors] = useState<Partial<Record<ConditionFieldKey, string>>>({});
  const conditionValuesRef = useRef<ConditionFieldValues>(conditionInputValues(conditions));
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(() => normalizedSkillLevel(conditions.skillLevel));
  const [isSavingConditions, setIsSavingConditions] = useState(false);
  const [conditionsSaveError, setConditionsSaveError] = useState('');
  const [conditionsSaved, setConditionsSaved] = useState(false);
  const {
    images,
    imageSelectionId,
    isPickingImages,
    isExtracting,
    permissionError,
    extractionError,
    pickImages,
    clearImages,
    canExtractImages,
    clearExtractionError,
    extract,
  } = useCandidateIdeaExtraction(projectId);
  const isBusy = isPickingImages || isExtracting || isSaving;
  const activeFlowStep = isSaving || savedIds.size > 0 ? 3 : candidates.length > 0 ? 2 : isExtracting ? 1 : 0;
  const flowSteps = ['1  자료 입력', '2  AI 추출', '3  후보 검토', '4  마인드맵 구성'];
  const unsavedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.id) && !savedIds.has(candidate.id) && !memoIds.has(candidate.id)),
    [candidates, memoIds, savedIds, selectedIds],
  );
  const duplicateReferences = useMemo(() => findCandidateDuplicateReferences(candidates), [candidates]);
  const mergeCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.id) && !savedIds.has(candidate.id) && !memoIds.has(candidate.id)),
    [candidates, memoIds, savedIds, selectedIds],
  );

  const updateCondition = (key: ConditionFieldKey, value: string) => {
    const sanitizedValue = value.replace(/\D/g, '');
    setConditionValues((current) => {
      const next = { ...current, [key]: sanitizedValue };
      conditionValuesRef.current = next;
      return next;
    });
    setConditionsSaveError('');
    setConditionsSaved(false);
    if (sanitizedValue) {
      const error = conditionFieldError(key, sanitizedValue);
      setConditionErrors((current) => ({ ...current, [key]: error }));
    }
  };

  const validateConditionField = (key: ConditionFieldKey) => {
    setConditionErrors((current) => ({ ...current, [key]: conditionFieldError(key, conditionValuesRef.current[key]) }));
  };

  const validateConditions = () => {
    const currentValues = conditionValuesRef.current;
    const nextErrors = Object.fromEntries(
      (Object.keys(currentValues) as ConditionFieldKey[])
        .map((key) => [key, conditionFieldError(key, currentValues[key])])
        .filter(([, error]) => error),
    ) as Partial<Record<ConditionFieldKey, string>>;
    setConditionErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const currentConditions = (): CompleteProjectConditions => ({
    ...conditions,
    durationWeeks: Number(conditionValuesRef.current.durationWeeks),
    teamSize: Number(conditionValuesRef.current.teamSize),
    skillLevel,
    budget: Number(conditionValuesRef.current.budget),
  });

  const selectSkillLevel = (nextSkillLevel: SkillLevel) => {
    setSkillLevel(nextSkillLevel);
    setConditionsSaveError('');
    setConditionsSaved(false);
  };

  const saveConditions = async () => {
    if (isSavingConditions || !validateConditions()) return;
    setIsSavingConditions(true);
    setConditionsSaveError('');
    setConditionsSaved(false);
    const result = await onSaveConditions(currentConditions());
    if (result.error) setConditionsSaveError(result.error);
    else setConditionsSaved(true);
    setIsSavingConditions(false);
  };

  const replaceCandidates = (nextCandidates: CandidateIdea[]) => {
    const normalized = normalizeCandidateIdeas(nextCandidates);
    setCandidates(normalized);
    setSelectedIds(new Set(normalized.map((candidate) => candidate.id)));
    setSavedIds(new Set());
    setMemoIds(new Set());
    setReviewMessage('');
    const payload = toCandidateIdeasPayload(normalized);
    onPayloadChange?.(payload);
  };

  const runExtraction = async (useEditedOcrText = false) => {
    setSaveError('');
    setSavedIdeaCount(null);
    clearExtractionError();
    if (!validateConditions()) return;

    const response = await extract(
      useEditedOcrText || mode === 'text'
        ? { type: 'text', text: useEditedOcrText ? extractedText : sourceText }
        : { type: 'image' },
      currentConditions(),
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

  const deleteCandidate = (candidateId: string) => {
    const nextCandidates = candidates.filter((candidate) => candidate.id !== candidateId);
    setCandidates(nextCandidates);
    setSelectedIds((current) => new Set([...current].filter((id) => id !== candidateId)));
    setMemoIds((current) => new Set([...current].filter((id) => id !== candidateId)));
    onPayloadChange?.(toCandidateIdeasPayload(nextCandidates));
    setSaveError('');
    setReviewMessage('후보를 삭제했습니다.');
  };

  const toggleMemo = (candidateId: string) => {
    const willBecomeMemo = !memoIds.has(candidateId);
    setMemoIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
    if (willBecomeMemo) {
      setSelectedIds((current) => new Set([...current].filter((id) => id !== candidateId)));
    }
    setSaveError('');
    setReviewMessage(willBecomeMemo ? '아이디어 저장 대상에서 제외하고 메모로 보관했습니다.' : '메모를 아이디어 후보로 복원했습니다.');
  };

  const mergeSelectedCandidates = () => {
    const merged = mergeCandidateIdeas(mergeCandidates);
    if (!merged) return;
    const removedIds = new Set(mergeCandidates.slice(1).map((candidate) => candidate.id));
    const nextCandidates = candidates
      .map((candidate) => candidate.id === merged.id ? merged : candidate)
      .filter((candidate) => !removedIds.has(candidate.id));
    setCandidates(nextCandidates);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => !removedIds.has(id)));
      next.add(merged.id);
      return next;
    });
    setMemoIds((current) => new Set([...current].filter((id) => !removedIds.has(id))));
    onPayloadChange?.(toCandidateIdeasPayload(nextCandidates));
    setSaveError('');
    setReviewMessage(`${mergeCandidates.length}개 후보를 “${merged.title}” 후보로 병합했습니다.`);
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
    setSavedIdeaCount(null);
    try {
      const result = await onSave(normalized, extractionRunId || createRunId(), topic.trim() || defaultTopic);
      if (result.savedCandidateIds.length > 0) {
        setSavedIds((current) => new Set([...current, ...result.savedCandidateIds]));
        setSelectedIds((current) => new Set([...current].filter((id) => !result.savedCandidateIds.includes(id))));
      }
      if (result.failures.length > 0) {
        setSaveError(
          `${result.savedCandidateIds.length}개 저장, ${result.failures.length}개 실패: ${result.failures
            .map((failure) => `${failure.title} (${failure.message})`)
            .join(', ')}`,
        );
      } else {
        setIsConfigOpen(false);
        setSavedIdeaCount(result.savedCandidateIds.length);
      }
    } catch {
      setSaveError('저장 중 예기치 못한 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectAll = () => setSelectedIds(new Set(candidates.filter((item) => !savedIds.has(item.id) && !memoIds.has(item.id)).map((item) => item.id)));
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

        <ThemedView type="background" style={[styles.conditionsCard, { borderColor: theme.border }]}>
          <View style={styles.conditionsHeading}>
            <View style={styles.conditionsCopy}>
              <ThemedText type="smallBold">프로젝트 조건</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">저장한 조건은 AI 추출과 이후 프로젝트 진행에 사용됩니다.</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="프로젝트 조건 저장"
              disabled={isSavingConditions}
              onPress={() => void saveConditions()}
              style={({ pressed }) => [
                styles.saveConditionsButton,
                { backgroundColor: theme.primary },
                (pressed || isSavingConditions) && styles.pressed,
              ]}>
              {isSavingConditions ? <ActivityIndicator color="#ffffff" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>조건 저장</ThemedText>}
            </Pressable>
          </View>
          <View style={styles.conditionsFields}>
            <View style={styles.conditionField}>
              <ThemedText type="smallBold">기간(주)</ThemedText>
              <TextInput
                accessibilityLabel="프로젝트 기간(주)"
                keyboardType="number-pad"
                value={conditionValues.durationWeeks}
                onBlur={() => validateConditionField('durationWeeks')}
                onChangeText={(value) => updateCondition('durationWeeks', value)}
                style={[styles.conditionInput, { color: theme.text, borderColor: conditionErrors.durationWeeks ? theme.danger : theme.border, backgroundColor: theme.background }]}
              />
              {conditionErrors.durationWeeks ? <ThemedText accessibilityRole="alert" type="small" style={[styles.conditionErrorText, { color: theme.danger }]}>{conditionErrors.durationWeeks}</ThemedText> : null}
            </View>
            <View style={styles.conditionField}>
              <ThemedText type="smallBold">팀 인원</ThemedText>
              <TextInput
                accessibilityLabel="프로젝트 팀 인원"
                keyboardType="number-pad"
                value={conditionValues.teamSize}
                onBlur={() => validateConditionField('teamSize')}
                onChangeText={(value) => updateCondition('teamSize', value)}
                style={[styles.conditionInput, { color: theme.text, borderColor: conditionErrors.teamSize ? theme.danger : theme.border, backgroundColor: theme.background }]}
              />
              {conditionErrors.teamSize ? <ThemedText accessibilityRole="alert" type="small" style={[styles.conditionErrorText, { color: theme.danger }]}>{conditionErrors.teamSize}</ThemedText> : null}
            </View>
            <View style={styles.conditionField}>
              <ThemedText type="smallBold">예산(원)</ThemedText>
              <TextInput
                accessibilityLabel="프로젝트 예산(원)"
                keyboardType="number-pad"
                value={conditionValues.budget}
                onBlur={() => validateConditionField('budget')}
                onChangeText={(value) => updateCondition('budget', value)}
                style={[styles.conditionInput, { color: theme.text, borderColor: conditionErrors.budget ? theme.danger : theme.border, backgroundColor: theme.background }]}
              />
              {conditionErrors.budget ? <ThemedText accessibilityRole="alert" type="small" style={[styles.conditionErrorText, { color: theme.danger }]}>{conditionErrors.budget}</ThemedText> : null}
            </View>
          </View>
          <View style={styles.skillLevelField}>
            <ThemedText type="smallBold">기술 수준</ThemedText>
            <View style={styles.skillLevelOptions} accessibilityLabel="프로젝트 기술 수준">
              {skillLevels.map((level) => {
                const isSelected = skillLevel === level;
                return (
                  <Pressable
                    key={level}
                    accessibilityRole="button"
                    accessibilityLabel={`기술 수준 ${level}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => selectSkillLevel(level)}
                    style={({ pressed }) => [
                      styles.skillLevelOption,
                      {
                        borderColor: isSelected ? theme.primary : theme.border,
                        backgroundColor: isSelected ? theme.primarySoft : theme.background,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: isSelected ? theme.primary : theme.text }}>{level}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {conditionsSaveError ? <ThemedText accessibilityRole="alert" type="small" style={[styles.errorText, { color: theme.danger }]}>{conditionsSaveError}</ThemedText> : null}
          {conditionsSaved ? <ThemedText accessibilityLiveRegion="polite" type="small" style={{ color: theme.success }}>프로젝트 조건을 저장했습니다.</ThemedText> : null}
        </ThemedView>

        <View style={styles.flowRow} accessibilityLabel="아이디어 추출 단계">
          {flowSteps.map((step, index) => (
            <View
              key={step}
              style={[
                styles.flowStep,
                { backgroundColor: index === activeFlowStep ? theme.primarySoft : theme.background, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold" style={{ color: index === activeFlowStep ? theme.primary : theme.textSecondary }}>
                {step}
              </ThemedText>
            </View>
          ))}
        </View>

        <ExtractionSourceInput
          mode={mode}
          text={sourceText}
          images={images}
          imageSelectionId={imageSelectionId}
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
          disabled={isBusy || (mode === 'text' ? !sourceText.trim() : !canExtractImages)}
          onPress={() => void runExtraction()}
          style={({ pressed }) => [
            styles.extractButton,
            { backgroundColor: theme.primary },
            (pressed || isBusy || (mode === 'text' ? !sourceText.trim() : !canExtractImages)) && styles.pressed,
          ]}>
          {isPickingImages || isExtracting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" />
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {isPickingImages ? '이미지 처리 중…' : mode === 'image' ? 'OCR 및 아이디어 추출 중…' : '아이디어 추출 중…'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="smallBold" style={styles.primaryButtonText}>{mode === 'image' ? '선택한 이미지로 OCR · 아이디어 추출' : '텍스트를 DeepSeek로 보내 아이디어 추출'}</ThemedText>
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
                  {unsavedCandidates.length}개 선택 · {memoIds.size}개 메모 · {savedIds.size}개 저장됨
                </ThemedText>
              </View>
              <View style={styles.toolbarActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="후보 전체 선택" disabled={isBusy} onPress={selectAll} style={({ pressed }) => [styles.textButton, (pressed || isBusy) && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.textButtonLabel}>전체 선택</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="후보 전체 선택 해제" disabled={isBusy} onPress={clearSelection} style={({ pressed }) => [styles.textButton, (pressed || isBusy) && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.textButtonLabel}>전체 해제</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`선택한 ${mergeCandidates.length}개 후보 병합`}
                  disabled={isBusy || mergeCandidates.length < 2}
                  onPress={mergeSelectedCandidates}
                  style={({ pressed }) => [styles.mergeButton, { borderColor: theme.primary }, (pressed || isBusy || mergeCandidates.length < 2) && styles.pressed]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>선택 후보 병합</ThemedText>
                </Pressable>
              </View>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              병합할 후보 2개 이상을 선택하거나, 각 카드에서 메모 전환·삭제를 할 수 있습니다.
            </ThemedText>
            {reviewMessage ? <ThemedText accessibilityLiveRegion="polite" type="small" style={{ color: theme.success }}>{reviewMessage}</ThemedText> : null}

            <View style={styles.candidateList}>
              {candidates.map((candidate) => (
                <CandidateIdeaCard
                  key={candidate.id}
                  candidate={candidate}
                  isSelected={selectedIds.has(candidate.id)}
                  isSaved={savedIds.has(candidate.id)}
                  isMemo={memoIds.has(candidate.id)}
                  isBusy={isBusy}
                  duplicateOfTitle={duplicateReferences[candidate.id]}
                  onToggle={() => toggleCandidate(candidate.id)}
                  onChange={updateCandidate}
                  onDelete={() => deleteCandidate(candidate.id)}
                  onToggleMemo={() => toggleMemo(candidate.id)}
                />
              ))}
            </View>

            {saveError ? <ThemedText accessibilityRole="alert" type="small" style={styles.errorText}>{saveError}</ThemedText> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`선택한 ${unsavedCandidates.length}개로 마인드맵 구성`}
              disabled={isBusy || unsavedCandidates.length === 0}
              onPress={() => {
                setTopic(defaultTopic);
                setIsConfigOpen(true);
              }}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.success },
                (pressed || isBusy || unsavedCandidates.length === 0) && styles.pressed,
              ]}>
              {isSaving ? <ActivityIndicator color="#ffffff" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>선택한 {unsavedCandidates.length}개로 마인드맵 구성</ThemedText>}
            </Pressable>
          </View>
        ) : hasExtractionResult && !isExtracting && !extractionError ? (
          <ThemedView type="background" style={styles.emptyState}>
            <ThemedText type="smallBold">추출할 만한 아이디어를 찾지 못했습니다.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">원문을 보완한 뒤 다시 추출해 보세요. `candidateIdeas: []`는 정상 결과입니다.</ThemedText>
          </ThemedView>
        ) : null}

        {savedIds.size > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI 비교·선정으로 이동"
            onPress={onGoToSelection}
            style={({ pressed }) => [
              styles.goToSelectionButton,
              { borderColor: theme.primary, backgroundColor: theme.primarySoft },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>AI 비교·선정으로 이동</ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>

      <Modal
        visible={isConfigOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfigOpen(false)}>
        <View accessibilityViewIsModal style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView type="surfaceElevated" style={[styles.configPanel, { borderColor: theme.border }, Shadows.floating]}>
            <View style={styles.saveCompleteCopy}>
              <ThemedText type="sectionTitle">마인드맵 구성</ThemedText>
              <ThemedText themeColor="textSecondary">저장 전에 중심 주제와 예상 구조를 확인하세요.</ThemedText>
            </View>
            <View style={styles.configField}>
              <ThemedText type="smallBold">중심 주제</ThemedText>
              <TextInput
                accessibilityLabel="마인드맵 중심 주제"
                value={topic}
                editable={!isSaving}
                onChangeText={setTopic}
                placeholder="중심 주제"
                placeholderTextColor={theme.textSecondary}
                style={[styles.configInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              />
            </View>
            <View style={styles.configField}>
              <ThemedText type="smallBold">추가 방식</ThemedText>
              <View accessibilityRole="radio" accessibilityState={{ checked: true }} style={[styles.selectedOption, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>{hasMindMap ? '기존 마인드맵에 추가' : '새 마인드맵 만들기'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">기존 아이디어는 유지하며 중복 배치를 막습니다.</ThemedText>
              </View>
            </View>
            <View style={styles.configField}>
              <ThemedText type="smallBold">구성 방식</ThemedText>
              <View accessibilityRole="radio" accessibilityState={{ checked: true }} style={[styles.selectedOption, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>AI가 주제별로 자동 분류</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">구조화된 필드를 분석하고, 실패하면 키워드 기반 규칙으로 분류합니다.</ThemedText>
              </View>
            </View>
            <ThemedView type="backgroundElement" style={[styles.preview, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">미리보기 · {topic.trim() || defaultTopic}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">해결할 문제 · 대상 사용자 · 해결 방법</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">선택한 {unsavedCandidates.length}개 아이디어가 관련 가지 아래에 배치됩니다.</ThemedText>
            </ThemedView>
            {saveError ? <ThemedText accessibilityRole="alert" type="small" style={styles.errorText}>{saveError}</ThemedText> : null}
            <View style={styles.saveCompleteActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="마인드맵 구성 취소" disabled={isSaving} onPress={() => setIsConfigOpen(false)} style={({ pressed }) => [styles.laterButton, { borderColor: theme.border }, (pressed || isSaving) && styles.pressed]}><ThemedText type="smallBold">취소</ThemedText></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="마인드맵 생성" disabled={isSaving || !topic.trim()} onPress={() => void handleSave()} style={({ pressed }) => [styles.goToMindMapButton, { backgroundColor: theme.primary }, (pressed || isSaving || !topic.trim()) && styles.pressed]}>{isSaving ? <ActivityIndicator color="#ffffff" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>마인드맵 생성</ThemedText>}</Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={savedIdeaCount !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedIdeaCount(null)}>
        <View
          accessibilityViewIsModal
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.saveCompletePanel, { borderColor: theme.border }, Shadows.floating]}>
            <View style={styles.saveCompleteCopy}>
              <ThemedText type="sectionTitle">마인드맵이 완성됐어요</ThemedText>
              <ThemedText themeColor="textSecondary">
                {savedIdeaCount}개 아이디어를 저장하고 마인드맵에 배치했습니다.{`\n`}
                지금 마인드맵으로 이동하시겠습니까?
              </ThemedText>
            </View>
            <View style={styles.saveCompleteActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSavedIdeaCount(null)}
                style={({ pressed }) => [
                  styles.laterButton,
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">나중에 하기</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSavedIdeaCount(null);
                  onGoToMindMap();
                }}
                style={({ pressed }) => [
                  styles.goToMindMapButton,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>이동하기</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.four, borderRadius: Radius.large, borderWidth: 1, padding: Spacing.four },
  heading: { gap: Spacing.one },
  conditionsCard: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  conditionsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  conditionsCopy: { flex: 1, minWidth: 200, gap: Spacing.half },
  conditionsFields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  conditionField: { flex: 1, minWidth: 120, gap: Spacing.one },
  conditionInput: { minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  conditionErrorText: { marginTop: -Spacing.half },
  skillLevelField: { gap: Spacing.one },
  skillLevelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  skillLevelOption: { flexGrow: 1, minWidth: 84, minHeight: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  saveConditionsButton: { minHeight: ControlHeight.touch, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  flowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  flowStep: { flexGrow: 1, flexBasis: 150, minHeight: 42, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  extractButton: { minHeight: ControlHeight.input, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  saveButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  goToSelectionButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
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
  textButtonLabel: { color: '#F59E0B' },
  mergeButton: { minHeight: ControlHeight.touch, justifyContent: 'center', paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Radius.medium },
  candidateList: { gap: Spacing.three },
  emptyState: { gap: Spacing.one, borderRadius: Radius.medium, padding: Spacing.three },
  errorText: { color: '#b91c1c' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  configPanel: { width: '100%', maxWidth: 560, maxHeight: '92%', gap: Spacing.three, borderWidth: 1, borderRadius: Radius.xlarge, padding: Spacing.four },
  configField: { gap: Spacing.one },
  configInput: { minHeight: ControlHeight.input, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  selectedOption: { gap: Spacing.half, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  preview: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  saveCompletePanel: { width: '100%', maxWidth: 420, gap: Spacing.four, borderWidth: 1, borderRadius: Radius.xlarge, padding: Spacing.four },
  saveCompleteCopy: { gap: Spacing.two },
  saveCompleteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  laterButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  goToMindMapButton: { minHeight: ControlHeight.touch, justifyContent: 'center', borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  pressed: { opacity: 0.55 },
});
