import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { IdeaExtractionPanel } from '@/components/idea-extraction/idea-extraction-panel';
import { IdeaMindMap } from '@/components/idea-mind-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useIdeaFeedbacks } from '@/hooks/use-idea-feedbacks';
import { useIdeaCategories } from '@/hooks/use-idea-categories';
import { useIdeaDraftAnalysis } from '@/hooks/use-idea-draft-analysis';
import { useIdeaLikes } from '@/hooks/use-idea-likes';
import { useFinalIdeaAnalysis } from '@/hooks/use-final-idea-analysis';
import { useIdeas } from '@/hooks/use-ideas';
import { useTheme } from '@/hooks/use-theme';
import { candidateIdeaToIdeaInput } from '@/lib/candidate-idea';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { CandidateIdea, CandidateIdeaSaveResult } from '@/types/candidate-idea';
import type { IdeaFeedback } from '@/types/feedback';
import type { FinalIdeaAnalysis, FinalIdeaAnalysisResult, FinalAnalysisLevel } from '@/types/final-analysis';
import type { IdeaDraftAnalysisResult } from '@/types/idea-draft-analysis';
import {
  IdeaStatusLabels,
  IdeaStatuses,
  getIdeaCategoryLabel,
  normalizeIdeaCategory,
  normalizeIdeaStatus,
  type DefaultIdeaCategoryKey,
  type Idea,
  type IdeaCategory,
  type IdeaInput,
  type IdeaMindMapInput,
  type IdeaStatus,
} from '@/types/idea';

type IdeaBoardProps = {
  projectId: string;
  projectDeadline?: string | null;
};

type IdeaFormProps = {
  idea?: Idea;
  categories: IdeaCategory[];
  draftKey?: string;
  projectId?: string;
  submitLabel: string;
  isBusy?: boolean;
  error?: string;
  onSubmit: (input: IdeaInput) => void | Promise<void>;
  onCreateCategory: (name: string) => Promise<{ category?: IdeaCategory; error?: string }>;
  onCancel?: () => void;
};

type IdeaCardProps = {
  idea: Idea;
  feedbacks: IdeaFeedback[];
  likesCount: number;
  isLiked: boolean;
  isBusy?: boolean;
  isLoadingFeedbacks?: boolean;
  isLoadingLikes?: boolean;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onToggleLike: () => void;
  onStatusChange: (status: IdeaStatus) => void;
  onAddFeedback: (ideaId: string, content: string) => Promise<{ error?: string }>;
  onToggleFeedbackResolved: (feedbackId: string, isresolved: boolean) => Promise<{ error?: string }>;
};

const allCategoryFilter = 'all';
const allStatusFilter = 'all';
const listMode = 'list';
const mindMapMode = 'mindmap';
const finalMode = 'final';
const extractionMode = 'extraction';

type CategoryFilter = typeof allCategoryFilter | IdeaCategory;
type StatusFilter = typeof allStatusFilter | IdeaStatus;
type BoardMode = typeof listMode | typeof mindMapMode | typeof finalMode | typeof extractionMode;
type SortMode = 'newest' | 'oldest' | 'likes' | 'favorite' | 'status';

const statusFilters: StatusFilter[] = [allStatusFilter, ...IdeaStatuses];
const sortOptions: { id: SortMode; label: string }[] = [
  { id: 'newest', label: '최신순' },
  { id: 'oldest', label: '오래된순' },
  { id: 'likes', label: '공감순' },
  { id: 'favorite', label: '즐겨찾기순' },
  { id: 'status', label: '진행순' },
];

const statusColors: Record<IdeaStatus, { background: string; border: string; text: string }> = {
  thought: { background: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  research: { background: '#fff7ed', border: '#fdba74', text: '#c2410c' },
  approved: { background: '#ecfdf5', border: '#86efac', text: '#15803d' },
  selected: { background: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
};

type CategoryPalette = { background: string; border: string; text: string };

const categoryColors: Record<DefaultIdeaCategoryKey, CategoryPalette> = {
  planning: { background: '#f8fafc', border: '#cbd5e1', text: '#475569' },
  design: { background: '#fdf2f8', border: '#f9a8d4', text: '#be185d' },
  develop: { background: '#ecfdf5', border: '#86efac', text: '#15803d' },
  research: { background: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
};

const customCategoryPalette: CategoryPalette = {
  background: '#f8fafc',
  border: '#94a3b8',
  text: '#334155',
};

const boardTabs: { id: BoardMode; label: string }[] = [
  { id: extractionMode, label: '아이디어 추출' },
  { id: listMode, label: '목록' },
  { id: mindMapMode, label: '마인드맵' },
  { id: finalMode, label: '최종안' },
];

function getCategoryLabel(filter: CategoryFilter) {
  return filter === allCategoryFilter ? '전체' : getIdeaCategoryLabel(filter);
}

function getCategoryPalette(category: IdeaCategory) {
  return categoryColors[category as DefaultIdeaCategoryKey] ?? customCategoryPalette;
}

function getStatusLabel(filter: StatusFilter) {
  return filter === allStatusFilter ? '전체' : IdeaStatusLabels[filter];
}

function formatFeedbackDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('ko-KR');
}

function confirmDelete(onConfirm: () => void) {
  const message = '아이디어 카드를 삭제할까요? 삭제한 카드는 되돌릴 수 없습니다.';

  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) {
      onConfirm();
    }
    return;
  }

  Alert.alert('아이디어 삭제', message, [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: onConfirm },
  ]);
}

function ProgressStat({ label, value }: { label: string; value: number | string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.progressStat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.progressValue}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

function ProjectProgressSummary({
  ideas,
  projectDeadline,
}: {
  ideas: Idea[];
  projectDeadline?: string | null;
}) {
  const selectedCount = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === 'selected').length;
  const approvedCount = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === 'approved').length;

  return (
    <View style={styles.progressGrid}>
      <ProgressStat label="D-day" value={getDDayLabel(projectDeadline ?? null)} />
      <ProgressStat label="등록 아이디어" value={`${ideas.length}개`} />
      <ProgressStat label="쓸 만함" value={`${approvedCount}개`} />
      <ProgressStat label="최종 사용" value={`${selectedCount}개`} />
      <ThemedView type="backgroundElement" style={styles.deadlineInfo}>
        <ThemedText type="smallBold">마감 정보</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDeadlineLabel(projectDeadline ?? null)}
        </ThemedText>
      </ThemedView>
    </View>
  );
}

function StatusSelector({
  selectedStatus,
  onSelect,
}: {
  selectedStatus: IdeaStatus;
  onSelect: (status: IdeaStatus) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {IdeaStatuses.map((status) => {
        const palette = statusColors[status];
        const isSelected = selectedStatus === status;

        return (
          <Pressable
            key={status}
            onPress={() => onSelect(status)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: palette.border,
                backgroundColor: isSelected ? palette.background : 'transparent',
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: isSelected ? palette.text : palette.border }}>
              {IdeaStatusLabels[status]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function CategorySelector({
  categories,
  selectedCategory,
  onSelect,
  onOpenCreate,
}: {
  categories: IdeaCategory[];
  selectedCategory: IdeaCategory;
  onSelect: (category: IdeaCategory) => void;
  onOpenCreate: () => void;
}) {
  return (
    <View style={styles.chipRow}>
      {categories.map((category) => {
        const palette = getCategoryPalette(category);
        const isSelected = selectedCategory === category;

        return (
          <Pressable
            key={category}
            onPress={() => onSelect(category)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: palette.border,
                backgroundColor: isSelected ? palette.background : 'transparent',
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: isSelected ? palette.text : palette.border }}>
              {getIdeaCategoryLabel(category)}
            </ThemedText>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onOpenCreate}
        style={({ pressed }) => [styles.addCategoryInlineButton, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.addCategoryInlineText}>
          + 새 카테고리 추가하기
        </ThemedText>
      </Pressable>
    </View>
  );
}

function IdeaDraftCoach({
  analysis,
  analysisError,
  isAnalyzing,
  isDisabled,
  onAnalyze,
}: {
  analysis: IdeaDraftAnalysisResult | null;
  analysisError: string;
  isAnalyzing: boolean;
  isDisabled: boolean;
  onAnalyze: () => void;
}) {
  return (
    <View style={styles.draftCoachRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="AI 초안 진단"
        disabled={isDisabled || isAnalyzing}
        onPress={onAnalyze}
        style={({ pressed }) => [
          styles.draftCoachAvatar,
          (pressed || isDisabled || isAnalyzing) && styles.pressed,
        ]}>
        <View style={styles.draftCoachFace}>
          <View style={styles.draftCoachEyes}>
            <View style={styles.draftCoachEye} />
            <View style={styles.draftCoachEye} />
          </View>
          <ThemedText type="smallBold" style={styles.draftCoachAvatarText}>
            AI
          </ThemedText>
        </View>
      </Pressable>

      <ThemedView type="backgroundElement" style={styles.draftCoachBubble}>
        <View style={styles.draftCoachBubbleTail} />
        {isAnalyzing ? (
          <View style={styles.draftCoachLoading}>
            <ActivityIndicator size="small" />
            <ThemedText type="small" themeColor="textSecondary">
              초안을 읽고 있어요.
            </ThemedText>
          </View>
        ) : analysisError ? (
          <View style={styles.draftCoachContent}>
            <ThemedText type="smallBold">진단이 멈췄어요</ThemedText>
            <ThemedText type="small" style={styles.errorText}>
              {analysisError}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={isDisabled || isAnalyzing}
              onPress={onAnalyze}
              style={({ pressed }) => [
                styles.draftCoachActionButton,
                (pressed || isDisabled || isAnalyzing) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={styles.draftCoachActionText}>
                다시 진단
              </ThemedText>
            </Pressable>
          </View>
        ) : analysis ? (
          <View style={styles.draftCoachContent}>
            <View style={styles.draftCoachTitleRow}>
              <ThemedText type="smallBold">초안 진단</ThemedText>
              <AnalysisLevelBadge value={analysis.readiness} />
            </View>
            <AnalysisTextBlock label="요약">
              <ThemedText type="small" themeColor="textSecondary">
                {analysis.summary}
              </ThemedText>
            </AnalysisTextBlock>
            <AnalysisTextBlock label="제목">
              <ThemedText type="small" themeColor="textSecondary">
                {analysis.titleFeedback}
              </ThemedText>
            </AnalysisTextBlock>
            <AnalysisTextBlock label="내용">
              <ThemedText type="small" themeColor="textSecondary">
                {analysis.contentFeedback}
              </ThemedText>
            </AnalysisTextBlock>
            <AnalysisTextBlock label="보완할 점">
              <AnalysisBulletList items={analysis.improvements} />
            </AnalysisTextBlock>
            <AnalysisTextBlock label="다음 질문">
              <AnalysisBulletList items={analysis.nextQuestions} />
            </AnalysisTextBlock>
            <ThemedText type="small" themeColor="textSecondary" style={styles.analysisNotice}>
              {analysis.notice}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.draftCoachContent}>
            <ThemedText type="smallBold">등록 전에 한번 짚어볼게요.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              제목과 내용이 충분히 적히면 짧게 진단해줄 수 있어요.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={isDisabled || isAnalyzing}
              onPress={onAnalyze}
              style={({ pressed }) => [
                styles.draftCoachActionButton,
                (pressed || isDisabled || isAnalyzing) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={styles.draftCoachActionText}>
                초안 진단
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>
    </View>
  );
}

function IdeaForm({
  idea,
  categories,
  draftKey,
  projectId,
  submitLabel,
  isBusy = false,
  error,
  onSubmit,
  onCreateCategory,
  onCancel,
}: IdeaFormProps) {
  const theme = useTheme();
  const [title, setTitle] = useState(idea?.title ?? '');
  const [content, setContent] = useState(idea?.content ?? '');
  const [category, setCategory] = useState<IdeaCategory>(normalizeIdeaCategory(idea?.category));
  const [status, setStatus] = useState<IdeaStatus>(normalizeIdeaStatus(idea?.status));
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isCategoryInputOpen, setIsCategoryInputOpen] = useState(false);
  const {
    analysis: draftAnalysis,
    analysisError: draftAnalysisError,
    analyzeDraft,
    clearAnalysis,
    isAnalyzing,
  } = useIdeaDraftAnalysis(projectId);
  const showDraftCoach = !idea;

  useEffect(() => {
    if (!draftKey || idea) {
      return;
    }

    let isActive = true;
    AsyncStorage.getItem(draftKey).then((value) => {
      if (!isActive || !value) {
        return;
      }

      try {
        const draft = JSON.parse(value) as Partial<IdeaInput>;
        setTitle(typeof draft.title === 'string' ? draft.title : '');
        setContent(typeof draft.content === 'string' ? draft.content : '');
        setCategory(normalizeIdeaCategory(draft.category));
        setStatus(normalizeIdeaStatus(draft.status));
      } catch {
        // Ignore invalid local drafts.
      }
    });

    return () => {
      isActive = false;
    };
  }, [draftKey, idea]);

  useEffect(() => {
    if (!draftKey || idea) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      void AsyncStorage.setItem(
        draftKey,
        JSON.stringify({
          title,
          content,
          category,
          status,
        } satisfies IdeaInput),
      );
    }, 300);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [category, content, draftKey, idea, status, title]);

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.backgroundSelected,
      color: theme.text,
      backgroundColor: theme.background,
    },
  ];

  const handleSubmit = async () => {
    const nextTitleError = title.trim() ? '' : '아이디어 제목을 입력해 주세요.';
    const nextContentError = content.trim() ? '' : '아이디어 내용을 입력해 주세요.';

    setTitleError(nextTitleError);
    setContentError(nextContentError);

    if (nextTitleError || nextContentError) {
      return;
    }

    await onSubmit({ title, content, category, status });

    if (!idea) {
      if (draftKey) {
        void AsyncStorage.removeItem(draftKey);
      }
      setTitle('');
      setContent('');
      setCategory('planning');
      setStatus('thought');
    }
  };

  const handleCreateCategory = async () => {
    const nextCategory = newCategory.trim();
    if (!nextCategory) {
      setCategoryError('카테고리 이름을 입력해 주세요.');
      return;
    }

    setIsAddingCategory(true);
    setCategoryError('');

    const result = await onCreateCategory(nextCategory);
    if (result.error) {
      setCategoryError(result.error);
    } else if (result.category) {
      setCategory(result.category);
      setNewCategory('');
      setIsCategoryInputOpen(false);
    }

    setIsAddingCategory(false);
  };

  const handleAnalyzeDraft = () => {
    const nextTitleError = title.trim() ? '' : '아이디어 제목을 입력해 주세요.';
    const nextContentError = content.trim() ? '' : '아이디어 내용을 입력해 주세요.';

    setTitleError(nextTitleError);
    setContentError(nextContentError);

    if (nextTitleError || nextContentError) {
      return;
    }

    void analyzeDraft({ title, content, category, status });
  };

  return (
    <ThemedView type="backgroundElement" style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="smallBold">아이디어 제목</ThemedText>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            clearAnalysis();
            if (titleError) {
              setTitleError('');
            }
          }}
          placeholder="예: 발표 도입부를 실제 사례 질문으로 시작하기"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
        {titleError ? (
          <ThemedText type="small" style={styles.errorText}>
            {titleError}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">아이디어 내용</ThemedText>
        <TextInput
          value={content}
          onChangeText={(value) => {
            setContent(value);
            clearAnalysis();
            if (contentError) {
              setContentError('');
            }
          }}
          multiline
          placeholder="근거, 참고 자료, 다음 행동까지 같이 적어 두면 나중에 바로 발전시키기 좋습니다."
          placeholderTextColor={theme.textSecondary}
          style={[inputStyle, styles.multilineInput]}
        />
        {contentError ? (
          <ThemedText type="small" style={styles.errorText}>
            {contentError}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">카테고리</ThemedText>
        <CategorySelector
          categories={categories}
          selectedCategory={category}
          onSelect={setCategory}
          onOpenCreate={() => {
            setIsCategoryInputOpen((current) => {
              if (current) {
                setNewCategory('');
              }

              return !current;
            });
            setCategoryError('');
          }}
        />
        {isCategoryInputOpen ? (
          <View style={styles.addCategoryRow}>
            <TextInput
              value={newCategory}
              editable={!isBusy && !isAddingCategory}
              onChangeText={(value) => {
                setNewCategory(value);
                if (categoryError) {
                  setCategoryError('');
                }
              }}
              placeholder="새 카테고리"
              placeholderTextColor={theme.textSecondary}
              style={[inputStyle, styles.addCategoryInput]}
            />
            <Pressable
              disabled={isBusy || isAddingCategory}
              onPress={handleCreateCategory}
              style={({ pressed }) => [
                styles.addCategoryButton,
                (pressed || isBusy || isAddingCategory) && styles.pressed,
              ]}>
              {isAddingCategory ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  추가
                </ThemedText>
              )}
            </Pressable>
          </View>
        ) : null}
        {categoryError ? (
          <ThemedText type="small" style={styles.errorText}>
            {categoryError}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">상태</ThemedText>
        <StatusSelector selectedStatus={status} onSelect={setStatus} />
      </View>

      {error ? (
        <ThemedText type="small" style={styles.errorText}>
          {error}
        </ThemedText>
      ) : null}

      {showDraftCoach ? (
        <IdeaDraftCoach
          analysis={draftAnalysis}
          analysisError={draftAnalysisError}
          isAnalyzing={isAnalyzing}
          isDisabled={isBusy}
          onAnalyze={handleAnalyzeDraft}
        />
      ) : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable
            disabled={isBusy}
            onPress={onCancel}
            style={({ pressed }) => [styles.secondaryButton, (pressed || isBusy) && styles.pressed]}>
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          disabled={isBusy}
          onPress={handleSubmit}
          style={({ pressed }) => [styles.primaryButton, (pressed || isBusy) && styles.pressed]}>
          {isBusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              {submitLabel}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

function FeedbackSection({
  idea,
  feedbacks,
  isLoadingFeedbacks,
  onAddFeedback,
  onToggleFeedbackResolved,
}: Pick<IdeaCardProps, 'idea' | 'feedbacks' | 'isLoadingFeedbacks' | 'onAddFeedback' | 'onToggleFeedbackResolved'>) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const submitFeedback = async () => {
    if (!draft.trim()) {
      setFeedbackError('피드백 내용을 입력해 주세요.');
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackError('');

    const result = await onAddFeedback(idea.id, draft);
    if (result.error) {
      setFeedbackError(result.error);
    } else {
      setDraft('');
    }

    setIsSubmittingFeedback(false);
  };

  return (
    <View style={styles.feedbackBlock}>
      <View style={styles.feedbackHeader}>
        <ThemedText type="smallBold">피드백</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {feedbacks.length}개
        </ThemedText>
      </View>

      <View style={styles.feedbackInputRow}>
        <TextInput
          value={draft}
          editable={!isSubmittingFeedback}
          onChangeText={(value) => {
            setDraft(value);
            if (feedbackError) {
              setFeedbackError('');
            }
          }}
          placeholder="보완할 점이나 팀원 의견을 남겨 두세요."
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.feedbackInput,
            {
              borderColor: theme.backgroundSelected,
              color: theme.text,
              backgroundColor: theme.background,
            },
          ]}
        />
        <Pressable
          disabled={isSubmittingFeedback}
          onPress={submitFeedback}
          style={({ pressed }) => [
            styles.feedbackButton,
            (pressed || isSubmittingFeedback) && styles.pressed,
          ]}>
          {isSubmittingFeedback ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              등록
            </ThemedText>
          )}
        </Pressable>
      </View>

      {feedbackError ? (
        <ThemedText type="small" style={styles.errorText}>
          {feedbackError}
        </ThemedText>
      ) : null}

      {isLoadingFeedbacks ? (
        <ActivityIndicator size="small" />
      ) : feedbacks.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          아직 등록된 피드백이 없습니다.
        </ThemedText>
      ) : (
        <View style={styles.feedbackList}>
          {feedbacks.slice(0, 3).map((feedback) => (
            <ThemedView key={feedback.id} style={styles.feedbackItem}>
              <ThemedText style={styles.feedbackText}>{feedback.content}</ThemedText>
              <View style={styles.feedbackMetaRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatFeedbackDate(feedback.createdat)}
                </ThemedText>
                <Pressable
                  onPress={() => onToggleFeedbackResolved(feedback.id, !feedback.isresolved)}
                  style={({ pressed }) => [
                    styles.feedbackResolveButton,
                    feedback.isresolved && styles.feedbackResolvedButton,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={feedback.isresolved ? styles.feedbackResolvedText : styles.feedbackResolveText}>
                    {feedback.isresolved ? '반영함' : '미해결'}
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusTag({ status }: { status: IdeaStatus }) {
  const palette = statusColors[status];

  return (
    <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {IdeaStatusLabels[status]}
      </ThemedText>
    </View>
  );
}

function CategoryTag({ category }: { category: IdeaCategory }) {
  const palette = getCategoryPalette(category);

  return (
    <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {getIdeaCategoryLabel(category)}
      </ThemedText>
    </View>
  );
}

function IdeaCard({
  idea,
  feedbacks,
  likesCount,
  isLiked,
  isBusy = false,
  isLoadingFeedbacks = false,
  isLoadingLikes = false,
  compact = false,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleLike,
  onStatusChange,
  onAddFeedback,
  onToggleFeedbackResolved,
}: IdeaCardProps) {
  const status = normalizeIdeaStatus(idea.status);
  const category = normalizeIdeaCategory(idea.category);
  const currentStatusIndex = IdeaStatuses.indexOf(status);
  const nextStatus = IdeaStatuses[currentStatusIndex + 1];

  return (
    <ThemedView type="backgroundElement" style={[styles.ideaCard, compact && styles.compactIdeaCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.tagRow}>
          <CategoryTag category={category} />
          <StatusTag status={status} />
        </View>
        <View style={styles.cardActions}>
          <Pressable
            disabled={isBusy}
            onPress={onToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={idea.isfavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            style={({ pressed }) => [
              styles.favoriteButton,
              idea.isfavorite && styles.activeFavoriteButton,
              (pressed || isBusy) && styles.pressed,
            ]}>
            <ThemedText
              type="smallBold"
              style={idea.isfavorite ? styles.activeFavoriteText : styles.favoriteText}>
              {idea.isfavorite ? '★' : '☆'}
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={isBusy}
            onPress={onEdit}
            style={({ pressed }) => [styles.compactButton, (pressed || isBusy) && styles.pressed]}>
            <ThemedText type="smallBold">수정</ThemedText>
          </Pressable>
          <Pressable
            disabled={isBusy}
            onPress={onDelete}
            style={({ pressed }) => [styles.compactDangerButton, (pressed || isBusy) && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.dangerButtonText}>
              삭제
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <ThemedText type="smallBold" style={styles.ideaTitle}>
        {idea.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.ideaContent}>
        {idea.content}
      </ThemedText>
      <View style={styles.reactionRow}>
        <Pressable
          disabled={isBusy || isLoadingLikes}
          onPress={onToggleLike}
          accessibilityRole="button"
          accessibilityLabel={isLiked ? '공감 취소' : '공감하기'}
          style={({ pressed }) => [
            styles.likeButton,
            isLiked && styles.activeLikeButton,
            (pressed || isBusy || isLoadingLikes) && styles.pressed,
          ]}>
          {isLoadingLikes ? (
            <ActivityIndicator color={isLiked ? '#ffffff' : '#e11d48'} size="small" />
          ) : (
            <ThemedText type="smallBold" style={isLiked ? styles.activeLikeMark : styles.likeMark}>
              ♥
            </ThemedText>
          )}
          <ThemedText type="smallBold" style={isLiked ? styles.activeLikeText : styles.likeText}>
            공감
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.likeCountText}>
          팀원 {likesCount}명이 공감
        </ThemedText>
      </View>
      {nextStatus ? (
        <Pressable
          disabled={isBusy}
          onPress={() => onStatusChange(nextStatus)}
          style={({ pressed }) => [styles.nextStatusButton, (pressed || isBusy) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.nextStatusText}>
            다음 단계: {IdeaStatusLabels[nextStatus]}
          </ThemedText>
        </Pressable>
      ) : null}
      {!compact ? (
        <FeedbackSection
          idea={idea}
          feedbacks={feedbacks}
          isLoadingFeedbacks={isLoadingFeedbacks}
          onAddFeedback={onAddFeedback}
          onToggleFeedbackResolved={onToggleFeedbackResolved}
        />
      ) : null}
    </ThemedView>
  );
}

function CategoryManager({
  customCategories,
  isBusy,
  onRenameCategory,
  onDeleteCategory,
}: {
  customCategories: IdeaCategory[];
  isBusy?: boolean;
  onRenameCategory: (oldName: string, nextName: string) => Promise<{ error?: string }>;
  onDeleteCategory: (name: string) => Promise<{ error?: string }>;
}) {
  const theme = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [nextName, setNextName] = useState('');
  const [managerError, setManagerError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (customCategories.length === 0) {
    return null;
  }

  const activeCategory = selectedCategory || customCategories[0];

  const handleRename = async () => {
    setIsSaving(true);
    setManagerError('');
    const result = await onRenameCategory(activeCategory, nextName);
    if (result.error) {
      setManagerError(result.error);
    } else {
      setSelectedCategory('');
      setNextName('');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setManagerError('');
    const result = await onDeleteCategory(activeCategory);
    if (result.error) {
      setManagerError(result.error);
    } else {
      setSelectedCategory('');
      setNextName('');
    }
    setIsSaving(false);
  };

  return (
    <View style={styles.filterGroup}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
        직접 추가 카테고리 관리
      </ThemedText>
      <View style={styles.filterRow}>
        {customCategories.map((category) => {
          const isSelected = activeCategory === category;

          return (
            <Pressable
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: isSelected ? '#1d4ed8' : theme.text }}>
                {category}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.categoryManageRow}>
        <TextInput
          value={nextName}
          editable={!isBusy && !isSaving}
          onChangeText={(value) => {
            setNextName(value);
            if (managerError) {
              setManagerError('');
            }
          }}
          placeholder="New name or existing category"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            styles.categoryManageInput,
            {
              borderColor: theme.backgroundSelected,
              color: theme.text,
              backgroundColor: theme.background,
            },
          ]}
        />
        <Pressable
          disabled={isBusy || isSaving}
          onPress={handleRename}
          style={({ pressed }) => [styles.compactButton, (pressed || isBusy || isSaving) && styles.pressed]}>
          <ThemedText type="smallBold">Rename</ThemedText>
        </Pressable>
        <Pressable
          disabled={isBusy || isSaving}
          onPress={handleDelete}
          style={({ pressed }) => [styles.compactDangerButton, (pressed || isBusy || isSaving) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.dangerButtonText}>
            Delete
          </ThemedText>
        </Pressable>
      </View>
      {managerError ? (
        <ThemedText type="small" style={styles.errorText}>
          {managerError}
        </ThemedText>
      ) : null}
    </View>
  );
}

function FilterBlock({
  categories,
  customCategories,
  categoryFilter,
  statusFilter,
  favoriteOnly,
  searchDraft,
  sortMode,
  onChangeCategory,
  onChangeStatus,
  onToggleFavorite,
  onChangeSearchDraft,
  onSubmitSearch,
  onChangeSort,
  onRenameCategory,
  onDeleteCategory,
  isBusy,
}: {
  categories: IdeaCategory[];
  customCategories: IdeaCategory[];
  categoryFilter: CategoryFilter;
  statusFilter: StatusFilter;
  favoriteOnly: boolean;
  searchDraft: string;
  sortMode: SortMode;
  onChangeCategory: (category: CategoryFilter) => void;
  onChangeStatus: (status: StatusFilter) => void;
  onToggleFavorite: () => void;
  onChangeSearchDraft: (query: string) => void;
  onSubmitSearch: () => void;
  onChangeSort: (sortMode: SortMode) => void;
  onRenameCategory: (oldName: string, nextName: string) => Promise<{ error?: string }>;
  onDeleteCategory: (name: string) => Promise<{ error?: string }>;
  isBusy?: boolean;
}) {
  const theme = useTheme();
  const categoryFilters: CategoryFilter[] = [allCategoryFilter, ...categories];

  return (
    <View style={styles.filterBlock}>
      <View style={styles.filterHeader}>
        <ThemedText type="smallBold">필터</ThemedText>
        <Pressable
          onPress={onToggleFavorite}
          style={({ pressed }) => [
            styles.favoriteFilterButton,
            favoriteOnly && styles.activeFavoriteFilterButton,
            pressed && styles.pressed,
          ]}>
          <ThemedText
            type="smallBold"
            style={favoriteOnly ? styles.activeFavoriteFilterText : styles.favoriteFilterText}>
            ★ 즐겨찾기만
          </ThemedText>
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={searchDraft}
          onChangeText={onChangeSearchDraft}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
          placeholder="Search ideas"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            styles.searchInput,
            {
              borderColor: theme.backgroundSelected,
              color: theme.text,
              backgroundColor: theme.background,
            },
          ]}
        />
        <Pressable
          onPress={onSubmitSearch}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.primaryButtonText}>
            입력
          </ThemedText>
        </Pressable>
      </View>
      <View style={styles.filterGroup}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
          Sort
        </ThemedText>
        <View style={styles.filterRow}>
          {sortOptions.map((option) => {
            const isSelected = sortMode === option.id;

            return (
              <Pressable
                key={option.id}
                onPress={() => onChangeSort(option.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    borderColor: isSelected ? '#93c5fd' : '#cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: isSelected ? '#1d4ed8' : theme.text }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.filterGroup}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
          분류
        </ThemedText>
        <View style={styles.filterRow}>
          {categoryFilters.map((category) => {
            const isSelected = categoryFilter === category;
            const palette = category === allCategoryFilter ? null : getCategoryPalette(category);
            const textColor = isSelected ? palette?.text ?? theme.text : palette?.border ?? theme.text;

            return (
              <Pressable
                key={category}
                onPress={() => onChangeCategory(category)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    borderColor: palette?.border ?? '#cbd5e1',
                    backgroundColor: isSelected ? palette?.background ?? '#f1f5f9' : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: textColor }}>
                  {getCategoryLabel(category)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.filterGroup}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
          상태
        </ThemedText>
        <View style={styles.filterRow}>
          {statusFilters.map((status) => {
            const isSelected = statusFilter === status;
            const palette = status === allStatusFilter ? null : statusColors[status];
            const textColor = isSelected ? palette?.text ?? theme.text : palette?.border ?? theme.text;

            return (
              <Pressable
                key={status}
                onPress={() => onChangeStatus(status)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    borderColor: palette?.border ?? '#cbd5e1',
                    backgroundColor: isSelected ? palette?.background ?? '#f1f5f9' : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: textColor }}>
                  {getStatusLabel(status)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <CategoryManager
        customCategories={customCategories}
        isBusy={isBusy}
        onRenameCategory={onRenameCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </View>
  );
}

function buildFinalDraftText(ideas: Idea[]) {
  return ideas
    .map((idea, index) => `${index + 1}. ${idea.title}\n${idea.content}`)
    .join('\n\n');
}

function AnalysisLevelBadge({ value }: { value: FinalAnalysisLevel }) {
  const palette =
    value === '높음'
      ? { background: '#ecfdf5', border: '#86efac', text: '#15803d' }
      : value === '보통'
        ? { background: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' }
        : { background: '#fff7ed', border: '#fdba74', text: '#c2410c' };

  return (
    <View style={[styles.analysisBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

function AnalysisBulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.analysisBulletList}>
      {items.map((item, index) => (
        <View key={`${item}:${index}`} style={styles.analysisBulletItem}>
          <ThemedText type="small" style={styles.analysisBulletDot}>
            {'\u2022'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.analysisBulletText}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function AnalysisTextBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.analysisTextBlock}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
    </View>
  );
}

function IdeaAnalysisCard({ analysis }: { analysis: FinalIdeaAnalysis }) {
  return (
    <ThemedView type="backgroundElement" style={styles.analysisCard}>
      <ThemedText type="smallBold" style={styles.analysisCardTitle}>
        {analysis.title || '제목 없는 아이디어'}
      </ThemedText>

      <AnalysisTextBlock label="핵심 요약">
        <ThemedText type="small" themeColor="textSecondary">
          {analysis.summary}
        </ThemedText>
      </AnalysisTextBlock>

      <AnalysisTextBlock label="장점">
        <AnalysisBulletList items={analysis.strengths} />
      </AnalysisTextBlock>

      <AnalysisTextBlock label="보완점">
        <AnalysisBulletList items={analysis.improvements} />
      </AnalysisTextBlock>

      <View style={styles.analysisLevelRow}>
        <View style={styles.analysisLevelItem}>
          <ThemedText type="smallBold">실현 가능성</ThemedText>
          <AnalysisLevelBadge value={analysis.feasibility} />
        </View>
        <View style={styles.analysisLevelItem}>
          <ThemedText type="smallBold">과제 적합성</ThemedText>
          <AnalysisLevelBadge value={analysis.projectFit} />
        </View>
      </View>
    </ThemedView>
  );
}

function OverallAnalysisCard({ result, ideas }: { result: FinalIdeaAnalysisResult; ideas: Idea[] }) {
  const ideaTitleById = useMemo(() => {
    const titles = new Map<string, string>();
    ideas.forEach((idea) => {
      titles.set(idea.id, idea.title.trim() || '제목 없는 아이디어');
    });
    return titles;
  }, [ideas]);
  const recommendedTitles = result.overall.recommendedIdeaIds
    .map((ideaId) => ideaTitleById.get(ideaId))
    .filter((title): title is string => Boolean(title));

  return (
    <ThemedView type="backgroundElement" style={styles.analysisCard}>
      <ThemedText type="smallBold" style={styles.analysisCardTitle}>
        전체 종합 의견
      </ThemedText>

      <AnalysisTextBlock label="전체 비교 의견">
        <ThemedText type="small" themeColor="textSecondary">
          {result.overall.comparison}
        </ThemedText>
      </AnalysisTextBlock>

      <AnalysisTextBlock label="추천 아이디어">
        <ThemedText type="small" themeColor="textSecondary">
          {recommendedTitles.length > 0 ? recommendedTitles.join(', ') : '추천 후보를 확인할 수 없습니다.'}
        </ThemedText>
      </AnalysisTextBlock>

      <AnalysisTextBlock label="추천 이유">
        <ThemedText type="small" themeColor="textSecondary">
          {result.overall.recommendationReason}
        </ThemedText>
      </AnalysisTextBlock>

      <AnalysisTextBlock label="아이디어 결합 제안">
        <ThemedText type="small" themeColor="textSecondary">
          {result.overall.combinationSuggestion}
        </ThemedText>
      </AnalysisTextBlock>

      <ThemedText type="small" themeColor="textSecondary" style={styles.analysisNotice}>
        {result.notice}
      </ThemedText>
    </ThemedView>
  );
}

function FinalDraftView({ ideas, projectId }: { ideas: Idea[]; projectId: string }) {
  const selectedIdeas = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === 'selected');
  const approvedIdeas = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === 'approved');
  const sourceIdeas = selectedIdeas.length > 0 ? selectedIdeas : approvedIdeas;
  const [copyMessage, setCopyMessage] = useState('');
  const {
    analysis,
    analysisError,
    analyzeIdeas,
    canAnalyze,
    emptyFinalIdeaMessage,
    isAnalyzing,
    isLimited,
    maxAnalysisIdeas,
    requestIdeas,
    skippedBlankCount,
  } = useFinalIdeaAnalysis(projectId, selectedIdeas);

  if (sourceIdeas.length === 0) {
    return (
      <View style={styles.finalBlock}>
        <ThemedView type="backgroundElement" style={styles.emptyState}>
          <ThemedText type="smallBold">최종안에 넣을 아이디어가 없습니다.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            목록에서 좋은 아이디어를 쓸 만함 또는 최종 사용 상태로 올려 보세요.
          </ThemedText>
        </ThemedView>
        <View style={styles.finalAnalysisBlock}>
          <Pressable disabled style={[styles.finalAnalysisButton, styles.disabledButton]}>
            <ThemedText type="smallBold" style={styles.primaryButtonText}>
              AI 비교 분석
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            {emptyFinalIdeaMessage}
          </ThemedText>
        </View>
      </View>
    );
  }

  const finalDraftText = buildFinalDraftText(sourceIdeas);

  const copyFinalDraft = async () => {
    setCopyMessage('');

    if (Platform.OS === 'web' && globalThis.navigator?.clipboard) {
      await globalThis.navigator.clipboard.writeText(finalDraftText);
      setCopyMessage('Copied');
      return;
    }

    setCopyMessage('Select the text below to copy');
  };

  return (
    <View style={styles.finalBlock}>
      <ThemedView type="backgroundElement" style={styles.finalPanel}>
        <ThemedText type="smallBold" style={styles.finalTitle}>
          발표/보고서 구성안
        </ThemedText>
        <View style={styles.outlineList}>
          {sourceIdeas.map((idea, index) => (
            <View key={idea.id} style={styles.outlineItem}>
              <View style={styles.outlineNumber}>
                <ThemedText type="smallBold" style={styles.outlineNumberText}>
                  {index + 1}
                </ThemedText>
              </View>
              <View style={styles.outlineBody}>
                <ThemedText type="smallBold">{idea.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {idea.content}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.finalAnalysisBlock}>
          <Pressable
            disabled={!canAnalyze || isAnalyzing}
            onPress={analyzeIdeas}
            style={({ pressed }) => [
              styles.finalAnalysisButton,
              (!canAnalyze || isAnalyzing) && styles.disabledButton,
              pressed && canAnalyze && !isAnalyzing && styles.pressed,
            ]}>
            {isAnalyzing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                AI 비교 분석
              </ThemedText>
            )}
          </Pressable>
          {!canAnalyze ? (
            <ThemedText type="small" themeColor="textSecondary">
              {emptyFinalIdeaMessage}
            </ThemedText>
          ) : null}
          {isLimited ? (
            <ThemedText type="small" themeColor="textSecondary">
              최대 {maxAnalysisIdeas}개까지 분석할 수 있어 {requestIdeas.length}개 후보만 보냅니다.
            </ThemedText>
          ) : null}
          {skippedBlankCount > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              제목과 내용이 모두 없는 아이디어 {skippedBlankCount}개는 제외했습니다.
            </ThemedText>
          ) : null}
          {isAnalyzing ? (
            <ThemedView type="backgroundElement" style={styles.analysisLoadingPanel}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                AI가 최종 후보 아이디어를 비교하고 있습니다.
              </ThemedText>
            </ThemedView>
          ) : null}
          {analysisError ? (
            <ThemedView type="backgroundElement" style={styles.analysisErrorPanel}>
              <ThemedText type="small" style={styles.errorText}>
                {analysisError}
              </ThemedText>
              {canAnalyze ? (
                <Pressable
                  disabled={isAnalyzing}
                  onPress={analyzeIdeas}
                  style={({ pressed }) => [styles.secondaryButton, (pressed || isAnalyzing) && styles.pressed]}>
                  <ThemedText type="smallBold">다시 시도</ThemedText>
                </Pressable>
              ) : null}
            </ThemedView>
          ) : null}
          {analysis ? (
            <View style={styles.analysisResultBlock}>
              {analysis.analyses.map((item) => (
                <IdeaAnalysisCard key={item.ideaId} analysis={item} />
              ))}
              <OverallAnalysisCard result={analysis} ideas={selectedIdeas} />
              <Pressable
                disabled={isAnalyzing}
                onPress={analyzeIdeas}
                style={({ pressed }) => [styles.secondaryButton, (pressed || isAnalyzing) && styles.pressed]}>
                <ThemedText type="smallBold">다시 분석하기</ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={styles.finalExportActions}>
          <Pressable onPress={copyFinalDraft} style={({ pressed }) => [styles.compactButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold">Copy outline</ThemedText>
          </Pressable>
          {copyMessage ? (
            <ThemedText type="small" themeColor="textSecondary">
              {copyMessage}
            </ThemedText>
          ) : null}
        </View>
        <TextInput
          value={finalDraftText}
          editable={false}
          multiline
          selectTextOnFocus
          style={styles.finalExportInput}
        />
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.finalPanel}>
        <ThemedText type="smallBold">최종 사용 체크리스트</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          1. 각 아이디어의 근거 자료를 확인하기
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          2. 발표 흐름에 맞게 순서 조정하기
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          3. 중복되는 아이디어는 하나로 합치기
        </ThemedText>
      </ThemedView>
    </View>
  );
}

export function IdeaBoard({ projectId, projectDeadline }: IdeaBoardProps) {
  const {
    ideas,
    isLoadingIdeas,
    ideaError,
    createIdea,
    updateIdea,
    toggleIdeaFavorite,
    updateIdeaMindMap,
    deleteIdea,
    loadIdeas,
  } = useIdeas(projectId);
  const usedCategories = useMemo(
    () => ideas.map((idea) => normalizeIdeaCategory(idea.category)),
    [ideas],
  );
  const {
    categories,
    customCategories,
    categoryerror,
    createCategory,
    renameCategory,
    deleteCategory,
  } = useIdeaCategories(projectId, usedCategories);
  const {
    feedbacks,
    feedbacksByIdeaId,
    isLoadingFeedbacks,
    feedbackError,
    createFeedback,
    toggleFeedbackResolved,
  } = useIdeaFeedbacks(projectId);
  const {
    likes,
    likeCountsByIdeaId,
    likedIdeaIds,
    isLoadingLikes,
    likeError,
    toggleLike,
  } = useIdeaLikes(projectId);
  const [boardMode, setBoardMode] = useState<BoardMode>(listMode);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(allCategoryFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(allStatusFilter);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const extractionRoots = useRef(new Map<string, { id: string; x: number; y: number }>());

  const favoriteCount = useMemo(() => ideas.filter((idea) => idea.isfavorite).length, [ideas]);
  const ideaIds = useMemo(() => new Set(ideas.map((idea) => idea.id)), [ideas]);
  const likeCount = useMemo(
    () => likes.filter((like) => ideaIds.has(like.ideaid)).length,
    [ideaIds, likes],
  );
  const visibleIdeas = useMemo(
    () => {
      const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
      const filteredIdeas = ideas.filter((idea) => {
        const matchesCategory =
          categoryFilter === allCategoryFilter || normalizeIdeaCategory(idea.category) === categoryFilter;
        const matchesStatus = statusFilter === allStatusFilter || normalizeIdeaStatus(idea.status) === statusFilter;
        const matchesFavorite = !favoriteOnly || idea.isfavorite;
        const ideaFeedbacks = feedbacksByIdeaId.get(idea.id) ?? [];
        const searchableText = [
          idea.title,
          idea.content,
          getIdeaCategoryLabel(normalizeIdeaCategory(idea.category)),
          getStatusLabel(normalizeIdeaStatus(idea.status)),
          ...ideaFeedbacks.map((feedback) => feedback.content),
        ]
          .join(' ')
          .toLocaleLowerCase();
        const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);

        return matchesCategory && matchesStatus && matchesFavorite && matchesSearch;
      });

      return [...filteredIdeas].sort((left, right) => {
        if (sortMode === 'oldest') {
          return left.createdat.localeCompare(right.createdat);
        }

        if (sortMode === 'likes') {
          return (likeCountsByIdeaId.get(right.id) ?? 0) - (likeCountsByIdeaId.get(left.id) ?? 0);
        }

        if (sortMode === 'favorite') {
          return Number(right.isfavorite) - Number(left.isfavorite) || right.createdat.localeCompare(left.createdat);
        }

        if (sortMode === 'status') {
          return (
            IdeaStatuses.indexOf(normalizeIdeaStatus(right.status)) -
              IdeaStatuses.indexOf(normalizeIdeaStatus(left.status)) ||
            right.createdat.localeCompare(left.createdat)
          );
        }

        return right.createdat.localeCompare(left.createdat);
      });
    },
    [categoryFilter, favoriteOnly, feedbacksByIdeaId, ideas, likeCountsByIdeaId, searchQuery, sortMode, statusFilter],
  );
  const editingIdea = editingIdeaId ? ideas.find((idea) => idea.id === editingIdeaId) : undefined;
  const currentError = ideaError || mutationError || categoryerror || feedbackError || likeError;

  const handleCreate = async (input: IdeaInput) => {
    setIsMutating(true);
    setMutationError('');

    const result = await createIdea(input);
    if (result.error) {
      setMutationError(result.error);
    }

    setIsMutating(false);
  };

  const handleCreateMindMapNode = async (input: IdeaInput, mindMapInput: IdeaMindMapInput) => {
    setIsMutating(true);
    setMutationError('');

    const result = await createIdea(input, mindMapInput);
    if (result.error) {
      setMutationError(result.error);
      setIsMutating(false);
      return { error: result.error };
    }

    setIsMutating(false);
    return {};
  };

  const handlePersistMindMapLayout = async (ideaId: string, mindMapInput: IdeaMindMapInput) => {
    const result = await updateIdeaMindMap(ideaId, mindMapInput);
    if (result.error) {
      setMutationError(result.error);
      return { error: result.error };
    }

    return {};
  };

  const handleUpdateMindMapNode = async (ideaId: string, input: IdeaInput) => {
    setIsMutating(true);
    setMutationError('');

    const result = await updateIdea(ideaId, input);
    if (result.error) {
      setMutationError(result.error);
      setIsMutating(false);
      return { error: result.error };
    }

    setIsMutating(false);
    return {};
  };

  const handleUpdate = async (input: IdeaInput) => {
    if (!editingIdeaId) {
      return;
    }

    setIsMutating(true);
    setMutationError('');

    const result = await updateIdea(editingIdeaId, input);
    if (result.error) {
      setMutationError(result.error);
    } else {
      setEditingIdeaId(null);
    }

    setIsMutating(false);
  };

  const handleToggleFavorite = async (idea: Idea) => {
    setIsMutating(true);
    setMutationError('');

    const result = await toggleIdeaFavorite(idea.id, !idea.isfavorite);
    if (result.error) {
      setMutationError(result.error);
    }

    setIsMutating(false);
  };

  const handleStatusChange = async (idea: Idea, status: IdeaStatus) => {
    setIsMutating(true);
    setMutationError('');

    const result = await updateIdea(idea.id, {
      title: idea.title,
      content: idea.content,
      category: normalizeIdeaCategory(idea.category),
      status,
    });

    if (result.error) {
      setMutationError(result.error);
    }

    setIsMutating(false);
  };

  const handleAddFeedback = async (ideaId: string, content: string) => {
    const result = await createFeedback(ideaId, content);

    if (result.error) {
      return { error: result.error };
    }

    return {};
  };

  const handleToggleFeedbackResolved = async (feedbackId: string, isresolved: boolean) => {
    const result = await toggleFeedbackResolved(feedbackId, isresolved);

    if (result.error) {
      return { error: result.error };
    }

    return {};
  };

  const handleRenameCategory = async (oldName: string, nextName: string) => {
    setMutationError('');
    const result = await renameCategory(oldName, nextName);
    if (result.error) {
      setMutationError(result.error);
      return { error: result.error };
    }

    if (categoryFilter === oldName) {
      setCategoryFilter(result.category ?? allCategoryFilter);
    }

    await loadIdeas();
    return {};
  };

  const handleDeleteCategory = async (name: string) => {
    setMutationError('');
    const result = await deleteCategory(name);
    if (result.error) {
      setMutationError(result.error);
      return { error: result.error };
    }

    if (categoryFilter === name) {
      setCategoryFilter(allCategoryFilter);
    }

    await loadIdeas();
    return {};
  };

  const handleToggleLike = async (idea: Idea) => {
    setIsMutating(true);
    setMutationError('');

    const result = await toggleLike(idea.id, likedIdeaIds.has(idea.id));
    if (result.error) {
      setMutationError(result.error);
    }

    setIsMutating(false);
  };

  const handleDelete = (ideaId: string) => {
    confirmDelete(async () => {
      setIsMutating(true);
      setMutationError('');

      const result = await deleteIdea(ideaId);
      if (result.error) {
        setMutationError(result.error);
      }

      if (editingIdeaId === ideaId) {
        setEditingIdeaId(null);
      }

      setIsMutating(false);
    });
  };

  const handleSaveExtractedCandidates = async (
    candidates: CandidateIdea[],
    extractionRunId: string,
  ): Promise<CandidateIdeaSaveResult> => {
    if (candidates.length === 0) {
      return { savedCandidateIds: [], failures: [] };
    }

    setIsMutating(true);
    setMutationError('');

    const failures: CandidateIdeaSaveResult['failures'] = [];
    const savedCandidateIds: string[] = [];
    let root = extractionRoots.current.get(extractionRunId);

    if (!root) {
      const centerIdea = ideas.find((idea) => idea.side === 'center') ?? ideas[ideas.length - 1];
      const rootX = centerIdea
        ? Math.max(...ideas.map((idea) => idea.x ?? 0), centerIdea.x ?? 0) + 360
        : 0;
      const rootY = centerIdea?.y ?? 0;
      const rootResult = await createIdea(
        {
          title: '회의 아이디어',
          content: `회의록 또는 채팅에서 추출한 후보 ${candidates.length}개의 묶음입니다.`,
          status: 'thought',
          category: 'planning',
        },
        centerIdea
          ? { parentnodeid: centerIdea.id, x: rootX, y: rootY, side: 'right' }
          : { parentnodeid: null, x: 0, y: 0, side: 'center' },
      );

      if (rootResult.error || !rootResult.idea) {
        const message = rootResult.error || '마인드맵 루트 노드를 만들지 못했습니다.';
        setMutationError(message);
        setIsMutating(false);
        return {
          savedCandidateIds,
          failures: candidates.map((candidate) => ({ candidateId: candidate.id, title: candidate.title, message })),
        };
      }

      root = { id: rootResult.idea.id, x: rootResult.idea.x ?? rootX, y: rootResult.idea.y ?? rootY };
      extractionRoots.current.set(extractionRunId, root);
    }

    const offsets = [
      { side: 'right' as const, x: 360, y: 0 },
      { side: 'bottom' as const, x: 0, y: 240 },
      { side: 'left' as const, x: -360, y: 0 },
      { side: 'top' as const, x: 0, y: -240 },
      { side: 'bottomright' as const, x: 360, y: 240 },
      { side: 'bottomleft' as const, x: -360, y: 240 },
      { side: 'topright' as const, x: 360, y: -240 },
      { side: 'topleft' as const, x: -360, y: -240 },
    ];
    const existingKeys = new Set(
      ideas
        .filter((idea) => idea.parentnodeid === root.id)
        .map((idea) => `${idea.title.trim()}\n${idea.content.trim()}`),
    );

    for (const [index, candidate] of candidates.entries()) {
      try {
        const input = candidateIdeaToIdeaInput(candidate);
        const duplicateKey = `${input.title}\n${input.content}`;
        if (existingKeys.has(duplicateKey)) {
          savedCandidateIds.push(candidate.id);
          continue;
        }

        const offset = offsets[index % offsets.length];
        const ring = Math.floor(index / offsets.length) + 1;
        const result = await createIdea(input, {
          parentnodeid: root.id,
          x: root.x + offset.x * ring,
          y: root.y + offset.y * ring,
          side: offset.side,
        });

        if (result.error || !result.idea) {
          failures.push({
            candidateId: candidate.id,
            title: candidate.title,
            message: result.error || '아이디어를 저장하지 못했습니다.',
          });
        } else {
          existingKeys.add(duplicateKey);
          savedCandidateIds.push(candidate.id);
        }
      } catch (error) {
        failures.push({
          candidateId: candidate.id,
          title: candidate.title,
          message: error instanceof Error ? error.message : '후보 아이디어 형식이 올바르지 않습니다.',
        });
      }
    }

    if (failures.length > 0) {
      setMutationError(`${failures.length}개 아이디어를 저장하지 못했습니다.`);
    }
    setIsMutating(false);

    return { savedCandidateIds, failures };
  };

  return (
    <ThemedView style={styles.board}>
      <View style={styles.boardHeader}>
        <View style={styles.boardTitleBlock}>
          <ThemedText type="smallBold">과제 진행 보드</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            전체 {ideas.length}개 · 공감 {likeCount}개 · 즐겨찾기 {favoriteCount}개 · 피드백 {feedbacks.length}개
          </ThemedText>
        </View>
      </View>

      <ProjectProgressSummary ideas={ideas} projectDeadline={projectDeadline} />

      <View style={styles.modeToggle}>
        {boardTabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setBoardMode(tab.id)}
            style={({ pressed }) => [
              styles.modeButton,
              boardMode === tab.id && styles.activeModeButton,
              pressed && styles.pressed,
            ]}>
            <ThemedText
              type="smallBold"
              style={boardMode === tab.id ? styles.activeModeButtonText : styles.modeButtonText}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {boardMode === extractionMode ? (
        <IdeaExtractionPanel projectId={projectId} onSave={handleSaveExtractedCandidates} />
      ) : null}

      {boardMode === listMode ? (
        <>
          <IdeaForm
            categories={categories}
            draftKey={`ideadraft:${projectId}`}
            projectId={projectId}
            submitLabel="등록"
            isBusy={isMutating && !editingIdeaId}
            error={!editingIdeaId ? mutationError : ''}
            onSubmit={handleCreate}
            onCreateCategory={createCategory}
          />

          {editingIdea ? (
            <View style={styles.editingBlock}>
              <ThemedText type="smallBold">아이디어 수정</ThemedText>
              <IdeaForm
                idea={editingIdea}
                categories={categories}
                submitLabel="저장"
                isBusy={isMutating}
                error={editingIdeaId ? mutationError : ''}
                onSubmit={handleUpdate}
                onCreateCategory={createCategory}
                onCancel={() => {
                  setEditingIdeaId(null);
                  setMutationError('');
                }}
              />
            </View>
          ) : null}

          <FilterBlock
            categories={categories}
            customCategories={customCategories}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            favoriteOnly={favoriteOnly}
            searchDraft={searchDraft}
            sortMode={sortMode}
            onChangeCategory={setCategoryFilter}
            onChangeStatus={setStatusFilter}
            onToggleFavorite={() => setFavoriteOnly((current) => !current)}
            onChangeSearchDraft={setSearchDraft}
            onSubmitSearch={() => setSearchQuery(searchDraft)}
            onChangeSort={setSortMode}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            isBusy={isMutating}
          />

          {currentError ? (
            <ThemedText type="small" style={styles.errorText}>
              {currentError}
            </ThemedText>
          ) : null}

          {isLoadingIdeas ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ActivityIndicator />
            </ThemedView>
          ) : visibleIdeas.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="smallBold">표시할 아이디어가 없습니다.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                필터를 바꾸거나 새 아이디어를 등록해 보세요.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.ideaList}>
              {visibleIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  feedbacks={feedbacksByIdeaId.get(idea.id) ?? []}
                  likesCount={likeCountsByIdeaId.get(idea.id) ?? 0}
                  isLiked={likedIdeaIds.has(idea.id)}
                  isBusy={isMutating}
                  isLoadingFeedbacks={isLoadingFeedbacks}
                  isLoadingLikes={isLoadingLikes}
                  onEdit={() => {
                    setEditingIdeaId(idea.id);
                    setMutationError('');
                  }}
                  onDelete={() => handleDelete(idea.id)}
                  onToggleFavorite={() => handleToggleFavorite(idea)}
                  onToggleLike={() => handleToggleLike(idea)}
                  onStatusChange={(status) => handleStatusChange(idea, status)}
                  onAddFeedback={handleAddFeedback}
                  onToggleFeedbackResolved={handleToggleFeedbackResolved}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {boardMode === mindMapMode ? (
        <>
          {currentError ? (
            <ThemedText type="small" style={styles.errorText}>
              {currentError}
            </ThemedText>
          ) : null}

          {isLoadingIdeas ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ActivityIndicator />
            </ThemedView>
          ) : (
            <IdeaMindMap
              ideas={ideas}
              isBusy={isMutating}
              likeCountsByIdeaId={likeCountsByIdeaId}
              likedIdeaIds={likedIdeaIds}
              isLoadingLikes={isLoadingLikes}
              onCreateNode={handleCreateMindMapNode}
              onUpdateNode={handleUpdateMindMapNode}
              onPersistNodeLayout={handlePersistMindMapLayout}
              onToggleLike={handleToggleLike}
            />
          )}
        </>
      ) : null}

      {boardMode === finalMode ? <FinalDraftView ideas={ideas} projectId={projectId} /> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  board: {
    gap: Spacing.three,
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  boardTitleBlock: {
    gap: Spacing.one,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  progressStat: {
    flexGrow: 1,
    minWidth: 140,
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  progressValue: {
    color: '#2563eb',
  },
  deadlineInfo: {
    flexGrow: 1,
    minWidth: 180,
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  form: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  multilineInput: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addCategoryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  addCategoryInlineButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addCategoryInlineText: {
    color: '#2563eb',
  },
  addCategoryInput: {
    flex: 1,
  },
  addCategoryButton: {
    minHeight: 46,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  draftCoachRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  draftCoachAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCoachFace: {
    alignItems: 'center',
    gap: 2,
  },
  draftCoachEyes: {
    flexDirection: 'row',
    gap: 8,
  },
  draftCoachEye: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1d4ed8',
  },
  draftCoachAvatarText: {
    color: '#1d4ed8',
    lineHeight: 18,
  },
  draftCoachBubble: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: Spacing.three,
  },
  draftCoachBubbleTail: {
    position: 'absolute',
    left: -7,
    top: 22,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#ffffff',
    transform: [{ rotate: '45deg' }],
  },
  draftCoachContent: {
    gap: Spacing.two,
  },
  draftCoachLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  draftCoachTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  draftCoachActionButton: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  draftCoachActionText: {
    color: '#ffffff',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: '#f1f5f9',
    padding: Spacing.one,
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  activeModeButton: {
    backgroundColor: '#2563eb',
  },
  modeButtonText: {
    color: '#475569',
  },
  activeModeButtonText: {
    color: '#ffffff',
  },
  filterHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterGroup: {
    gap: Spacing.one,
  },
  filterGroupLabel: {
    paddingHorizontal: Spacing.one,
  },
  filterBlock: {
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    minHeight: 46,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  categoryManageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryManageInput: {
    flex: 1,
    minWidth: 180,
  },
  filterChip: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  favoriteFilterButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  activeFavoriteFilterButton: {
    backgroundColor: '#fef3c7',
  },
  favoriteFilterText: {
    color: '#b45309',
  },
  activeFavoriteFilterText: {
    color: '#92400e',
  },
  editingBlock: {
    gap: Spacing.two,
  },
  ideaList: {
    gap: Spacing.three,
  },
  ideaCard: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  compactIdeaCard: {
    padding: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tag: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  ideaTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  ideaContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  likeButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  activeLikeButton: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  likeMark: {
    color: '#e11d48',
  },
  activeLikeMark: {
    color: '#ffffff',
  },
  likeText: {
    color: '#be123c',
  },
  activeLikeText: {
    color: '#ffffff',
  },
  likeCountText: {
    lineHeight: 20,
  },
  nextStatusButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: Spacing.two,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  nextStatusText: {
    color: '#1d4ed8',
  },
  feedbackBlock: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: Spacing.three,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  feedbackInputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  feedbackInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: Spacing.two,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  feedbackButton: {
    minHeight: 42,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  feedbackList: {
    gap: Spacing.two,
  },
  feedbackItem: {
    gap: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: '#f8fafc',
    padding: Spacing.two,
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 22,
  },
  feedbackMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  feedbackResolveButton: {
    minHeight: 30,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  feedbackResolvedButton: {
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
  },
  feedbackResolveText: {
    color: '#475569',
  },
  feedbackResolvedText: {
    color: '#15803d',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  favoriteButton: {
    width: 34,
    minHeight: 34,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFavoriteButton: {
    backgroundColor: '#fef3c7',
  },
  favoriteText: {
    color: '#b45309',
  },
  activeFavoriteText: {
    color: '#92400e',
  },
  compactButton: {
    minHeight: 34,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  compactDangerButton: {
    minHeight: 34,
    borderRadius: Spacing.two,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  dangerButtonText: {
    color: '#ffffff',
  },
  finalBlock: {
    gap: Spacing.three,
  },
  finalPanel: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  finalTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  finalExportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  finalAnalysisBlock: {
    gap: Spacing.two,
  },
  finalAnalysisButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  disabledButton: {
    opacity: 0.48,
  },
  analysisLoadingPanel: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  analysisErrorPanel: {
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: Spacing.three,
  },
  analysisResultBlock: {
    gap: Spacing.three,
  },
  analysisCard: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
  },
  analysisCardTitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  analysisTextBlock: {
    gap: Spacing.one,
  },
  analysisBulletList: {
    gap: Spacing.one,
  },
  analysisBulletItem: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  analysisBulletDot: {
    color: '#2563eb',
    lineHeight: 20,
  },
  analysisBulletText: {
    flex: 1,
    lineHeight: 20,
  },
  analysisLevelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  analysisLevelItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  analysisBadge: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  analysisNotice: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: Spacing.two,
  },
  finalExportInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    padding: Spacing.two,
    textAlignVertical: 'top',
  },
  outlineList: {
    gap: Spacing.three,
  },
  outlineItem: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  outlineNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineNumberText: {
    color: '#ffffff',
  },
  outlineBody: {
    flex: 1,
    gap: Spacing.one,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#dc2626',
  },
  pressed: {
    opacity: 0.72,
  },
});
