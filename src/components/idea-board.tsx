import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { EmptyState } from '@/components/empty-state';
import { BlindSwipeEvaluation } from '@/components/blind-swipe-evaluation';
import { IdeaExtractionPanel } from '@/components/idea-extraction/idea-extraction-panel';
import { IdeaMindMap } from '@/components/idea-mind-map';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { MvpWorkflowPanel } from '@/components/mvp-workflow-panel';
import { PresentationWorkflowPanel } from '@/components/presentation-workflow-panel';
import { ProjectFlowSteps } from '@/components/project-flow-steps';
import { ProjectHomeSummary } from '@/components/project-home-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useIdeaFeedbacks } from '@/hooks/use-idea-feedbacks';
import { useIdeaCategories } from '@/hooks/use-idea-categories';
import { useIdeaDraftAnalysis } from '@/hooks/use-idea-draft-analysis';
import { useIdeaLikes } from '@/hooks/use-idea-likes';
import { useIdeas } from '@/hooks/use-ideas';
import { useMindMap } from '@/hooks/use-mind-map';
import { useProjectFlow } from '@/hooks/use-project-flow';
import { useTheme } from '@/hooks/use-theme';
import { candidateIdeaToIdeaInput } from '@/lib/candidate-idea';
import { validateMindMapIdeaField } from '@/lib/mind-map';
import { isMvpPlanCurrent, isPresentationCurrent } from '@/lib/project-flow';
import type { ProjectSection, ProjectWorkspaceLocation, ProjectWorkflowStep } from '@/lib/project-workspace';
import type { CandidateIdea, CandidateIdeaSaveResult } from '@/types/candidate-idea';
import type { IdeaFeedback } from '@/types/feedback';
import type { FinalAnalysisLevel } from '@/types/final-analysis';
import type { IdeaDraftAnalysisResult } from '@/types/idea-draft-analysis';
import type { MindMapIdeaDetailsInput, MindMapNode } from '@/types/mind-map';
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
  type IdeaStatus,
} from '@/types/idea';

type IdeaBoardProps = {
  projectId: string;
  projectTitle: string;
  projectDeadline?: string | null;
  initialSection?: ProjectSection;
  initialStep?: ProjectWorkflowStep;
  onLocationChange: (location: ProjectWorkspaceLocation) => void;
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
type CategoryFilter = typeof allCategoryFilter | IdeaCategory;
type StatusFilter = typeof allStatusFilter | IdeaStatus;
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
  thought: { background: '#EEF0FF', border: '#B9C2FF', text: '#3442B8' },
  research: { background: '#fff7ed', border: '#fdba74', text: '#c2410c' },
  approved: { background: '#E7F8EF', border: '#83DCAE', text: '#168B51' },
  selected: { background: '#EEF0FF', border: '#B9C2FF', text: '#4050D0' },
};

type CategoryPalette = { background: string; border: string; text: string };

const categoryColors: Record<DefaultIdeaCategoryKey, CategoryPalette> = {
  planning: { background: '#f8fafc', border: '#cbd5e1', text: '#475569' },
  design: { background: '#fdf2f8', border: '#f9a8d4', text: '#be185d' },
  develop: { background: '#E7F8EF', border: '#83DCAE', text: '#168B51' },
  research: { background: '#EEF0FF', border: '#B9C2FF', text: '#3442B8' },
};

const customCategoryPalette: CategoryPalette = {
  background: '#f8fafc',
  border: '#94a3b8',
  text: '#334155',
};

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

function StatusSelector({
  selectedStatus,
  onSelect,
}: {
  selectedStatus: IdeaStatus;
  onSelect: (status: IdeaStatus) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {IdeaStatuses.filter((status) => status !== 'selected').map((status) => {
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
      {selectedStatus === 'selected' ? (
        <ThemedText type="small" themeColor="textSecondary">최종 선정 변경은 AI 비교·선정 단계에서 할 수 있습니다.</ThemedText>
      ) : null}
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
  const theme = useTheme();

  return (
    <View style={styles.draftCoachRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="AI 초안 진단"
        disabled={isDisabled || isAnalyzing}
        onPress={onAnalyze}
        style={({ pressed }) => [
          styles.draftCoachAvatar,
          { backgroundColor: theme.primarySoft, borderColor: theme.primary },
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

      <ThemedView type="backgroundElement" style={[styles.draftCoachBubble, { borderColor: theme.border }]}>
        <View style={[styles.draftCoachBubbleTail, { backgroundColor: theme.surface, borderColor: theme.border }]} />
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
    <ThemedView type="backgroundElement" style={[styles.form, { borderColor: theme.border }, Shadows.card]}>
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
  const theme = useTheme();
  const palette = status === 'research'
    ? { background: theme.warningSoft, border: theme.warning, text: theme.warning }
    : status === 'approved'
      ? { background: theme.successSoft, border: theme.success, text: theme.success }
      : { background: theme.primarySoft, border: theme.primary, text: theme.primary };

  return (
    <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {IdeaStatusLabels[status]}
      </ThemedText>
    </View>
  );
}

function CategoryTag({ category }: { category: IdeaCategory }) {
  const theme = useTheme();

  return (
    <View style={[styles.tag, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
      <ThemedText type="captionStrong" style={{ color: theme.textSecondary }}>
        {getIdeaCategoryLabel(category)}
      </ThemedText>
    </View>
  );
}

function IdeaDetailSection({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ideaDetailSection}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText themeColor="textSecondary">{value}</ThemedText>
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
  const theme = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const status = normalizeIdeaStatus(idea.status);
  const category = normalizeIdeaCategory(idea.category);
  const currentStatusIndex = IdeaStatuses.indexOf(status);
  const statusAfterCurrent = IdeaStatuses[currentStatusIndex + 1];
  const nextStatus = statusAfterCurrent === 'selected' ? undefined : statusAfterCurrent;
  const hasStructuredDetails = Boolean(
    idea.summary || idea.problem || idea.targetusers.length || idea.solution || idea.corefeatures.length || idea.keywords.length,
  );
  const summary = idea.summary || (!hasStructuredDetails ? idea.content : idea.problem || idea.solution);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.ideaCard, { borderColor: theme.border }, compact && styles.compactIdeaCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.tagRow}>
          <CategoryTag category={category} />
          <StatusTag status={status} />
        </View>
        <View style={styles.cardActions}>
          <Pressable
            disabled={isBusy}
            onPress={() => setIsMenuOpen((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="아이디어 추가 작업"
            style={({ pressed }) => [
              styles.overflowButton,
              { borderColor: theme.border },
              (pressed || isBusy) && styles.pressed,
            ]}>
            <AppIcon name="more" color={theme.textSecondary} size={22} />
          </Pressable>
        </View>
      </View>
      {isMenuOpen ? (
        <View style={[styles.overflowMenu, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
          <Pressable
            disabled={isBusy}
            onPress={() => { setIsMenuOpen(false); onToggleFavorite(); }}
            style={({ pressed }) => [styles.overflowMenuItem, pressed && styles.pressed]}>
            <AppIcon name="favorite" color={idea.isfavorite ? theme.warning : theme.textSecondary} size={19} />
            <ThemedText type="button">{idea.isfavorite ? '즐겨찾기 해제' : '즐겨찾기'}</ThemedText>
          </Pressable>
          <Pressable
            disabled={isBusy}
            onPress={() => { setIsMenuOpen(false); onEdit(); }}
            style={({ pressed }) => [styles.overflowMenuItem, pressed && styles.pressed]}>
            <ThemedText type="button">수정</ThemedText>
          </Pressable>
          <Pressable
            disabled={isBusy}
            onPress={() => { setIsMenuOpen(false); onDelete(); }}
            style={({ pressed }) => [styles.overflowMenuItem, styles.overflowDangerItem, pressed && styles.pressed]}>
            <ThemedText type="button" style={{ color: theme.danger }}>삭제…</ThemedText>
          </Pressable>
        </View>
      ) : null}
      <ThemedText type="smallBold" style={styles.ideaTitle}>
        {idea.title}
      </ThemedText>
      {summary ? <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.ideaContent}>{summary}</ThemedText> : null}
      {idea.keywords.length > 0 ? (
        <View style={styles.keywordRow}>
          {idea.keywords.slice(0, 3).map((keyword) => (
            <View key={keyword} style={[styles.keywordChip, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="caption">#{keyword}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${idea.title} ${isExpanded ? '상세 접기' : '자세히 보기'}`}
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [styles.detailToggle, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>{isExpanded ? '접기' : '자세히 보기'}</ThemedText>
      </Pressable>
      {isExpanded ? (
        <View style={[styles.structuredDetails, { borderTopColor: theme.divider }]}>
          {hasStructuredDetails ? (
            <>
              {idea.summary ? <IdeaDetailSection label="요약" value={idea.summary} /> : null}
              {idea.problem ? <IdeaDetailSection label="해결하려는 문제" value={idea.problem} /> : null}
              {idea.targetusers.length ? <IdeaDetailSection label="대상 사용자" value={idea.targetusers.join(' · ')} /> : null}
              {idea.solution ? <IdeaDetailSection label="해결 방법" value={idea.solution} /> : null}
              {idea.corefeatures.length ? <IdeaDetailSection label="핵심 기능" value={idea.corefeatures.join(' · ')} /> : null}
              {idea.keywords.length ? <IdeaDetailSection label="키워드" value={idea.keywords.join(' · ')} /> : null}
            </>
          ) : <IdeaDetailSection label="내용" value={idea.content} />}
        </View>
      ) : null}
      <View style={styles.reactionRow}>
        <Pressable
          disabled={isBusy || isLoadingLikes}
          onPress={onToggleLike}
          accessibilityRole="button"
          accessibilityLabel={isLiked ? '공감 취소' : '공감하기'}
          style={({ pressed }) => [
            styles.likeButton,
            { borderColor: theme.primary },
            isLiked && { backgroundColor: theme.primary, borderColor: theme.primary },
            (pressed || isBusy || isLoadingLikes) && styles.pressed,
          ]}>
          {isLoadingLikes ? (
            <ActivityIndicator color={isLiked ? '#ffffff' : theme.primary} size="small" />
          ) : (
            <AppIcon name="like" color={isLiked ? '#FFFFFF' : theme.primary} size={18} />
          )}
          <ThemedText type="smallBold" style={isLiked ? styles.activeLikeText : styles.likeText}>
            공감
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.likeCountText}>
          {likesCount}명 공감
        </ThemedText>
      </View>
      {nextStatus ? (
        <Pressable
          disabled={isBusy}
          onPress={() => onStatusChange(nextStatus)}
          style={({ pressed }) => [styles.nextStatusButton, { backgroundColor: theme.primarySoft }, (pressed || isBusy) && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            다음 상태 · {IdeaStatusLabels[nextStatus]}
          </ThemedText>
        </Pressable>
      ) : null}
      {!compact && isExpanded ? (
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
                  borderColor: isSelected ? '#4050D0' : '#cbd5e1',
                  backgroundColor: isSelected ? '#EEF0FF' : 'transparent',
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: isSelected ? '#3442B8' : theme.text }}>
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
          placeholder="새 이름 또는 기존 카테고리"
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
          <ThemedText type="button">이름 변경</ThemedText>
        </Pressable>
        <Pressable
          disabled={isBusy || isSaving}
          onPress={handleDelete}
          style={({ pressed }) => [styles.compactDangerButton, (pressed || isBusy || isSaving) && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.dangerButtonText}>
            삭제
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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const categoryFilters: CategoryFilter[] = [allCategoryFilter, ...categories];

  return (
    <View style={styles.filterBlock}>
      <View style={styles.searchRow}>
        <TextInput
          value={searchDraft}
          onChangeText={onChangeSearchDraft}
          onSubmitEditing={onSubmitSearch}
          returnKeyType="search"
          placeholder="아이디어 검색"
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
          accessibilityRole="button"
          accessibilityLabel="아이디어 검색"
          onPress={onSubmitSearch}
          style={({ pressed }) => [styles.searchButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
          <AppIcon name="search" color="#FFFFFF" size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isAdvancedOpen ? '상세 필터 닫기' : '상세 필터 열기'}
          onPress={() => setIsAdvancedOpen((current) => !current)}
          style={({ pressed }) => [
            styles.advancedFilterButton,
            { borderColor: theme.border },
            isAdvancedOpen && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="filter" color={isAdvancedOpen ? theme.primary : theme.textSecondary} size={20} />
        </Pressable>
      </View>
      {isAdvancedOpen ? (
        <View style={styles.advancedFilters}>
          <View style={styles.filterHeader}>
            <ThemedText type="cardTitle">상세 필터</ThemedText>
            <Pressable
              onPress={onToggleFavorite}
              style={({ pressed }) => [
                styles.favoriteFilterButton,
                favoriteOnly && styles.activeFavoriteFilterButton,
                pressed && styles.pressed,
              ]}>
              <ThemedText type="button" style={favoriteOnly ? styles.activeFavoriteFilterText : styles.favoriteFilterText}>
                ★ 즐겨찾기만
              </ThemedText>
            </Pressable>
          </View>
      <View style={styles.filterGroup}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.filterGroupLabel}>
          정렬
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
                    borderColor: isSelected ? '#B9C2FF' : '#cbd5e1',
                    backgroundColor: isSelected ? '#EEF0FF' : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: isSelected ? '#3442B8' : theme.text }}>
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
      ) : null}
    </View>
  );
}

function AnalysisLevelBadge({ value }: { value: FinalAnalysisLevel }) {
  const palette =
    value === '높음'
      ? { background: '#E7F8EF', border: '#83DCAE', text: '#168B51' }
      : value === '보통'
        ? { background: '#EEF0FF', border: '#B9C2FF', text: '#3442B8' }
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
  return <View style={styles.analysisTextBlock}><ThemedText type="smallBold">{label}</ThemedText>{children}</View>;
}

export function IdeaBoard({
  projectId,
  projectTitle,
  projectDeadline,
  initialSection = 'home',
  initialStep = 'extraction',
  onLocationChange,
}: IdeaBoardProps) {
  const theme = useTheme();
  const {
    ideas,
    isLoadingIdeas,
    ideaError,
    createIdea,
    updateIdea,
    toggleIdeaFavorite,
    deleteIdea,
    loadIdeas,
  } = useIdeas(projectId);
  const flowController = useProjectFlow(projectId);
  const {
    mindMap,
    nodes: mindMapNodes,
    isLoadingMindMap,
    mindMapError,
    loadMindMap,
    composeIdeas,
    updateTopic,
    moveIdeaNode,
    createBranch,
    placeIdeaUnderBranch,
    updateBranch,
    deleteBranch,
  } = useMindMap(projectId, projectTitle);
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
  const section = initialSection;
  const workflowStep = initialStep;
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(allCategoryFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(allStatusFilter);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [isCreateIdeaOpen, setIsCreateIdeaOpen] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [highlightedIdeaIds, setHighlightedIdeaIds] = useState<Set<string>>(new Set());

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
  const currentError = ideaError || mindMapError || mutationError || categoryerror || feedbackError || likeError;
  const selectedIdeaId = flowController.flow?.selectedideaid
    ?? ideas.find((idea) => normalizeIdeaStatus(idea.status) === 'selected')?.id
    ?? null;
  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) ?? null;
  const currentSelectedIdeaId = selectedIdea?.id ?? null;
  const workflowIdeas = ideas.filter(
    (idea) => !idea.legacystructural && Boolean(idea.title.trim() || idea.content.trim()),
  );
  const hasCurrentMvp = isMvpPlanCurrent(flowController.flow?.mvpplan, currentSelectedIdeaId);
  const hasCurrentPresentation = isPresentationCurrent(
    flowController.flow?.presentationdata,
    currentSelectedIdeaId,
    flowController.flow?.mvpplan,
  );
  const completedSteps = {
    extraction: workflowIdeas.length > 0,
    selection: Boolean(selectedIdea),
    mvp: hasCurrentMvp,
    presentation: hasCurrentPresentation,
  };

  const navigateTo = (nextSection: ProjectSection, nextStep = workflowStep) => {
    onLocationChange({ section: nextSection, step: nextStep });
  };

  const handleFlowStepPress = (step: ProjectWorkflowStep) => {
    navigateTo('home', step);
  };

  const handleCreate = async (input: IdeaInput) => {
    setIsMutating(true);
    setMutationError('');

    const result = await createIdea(input);
    if (result.error) {
      setMutationError(result.error);
    } else if (result.idea && mindMap) {
      const composed = await composeIdeas([result.idea], mindMap.title);
      if (composed.error) setMutationError(composed.error);
      else setIsCreateIdeaOpen(false);
    } else {
      setIsCreateIdeaOpen(false);
    }

    setIsMutating(false);
  };

  const handleUpdateMindMapNode = async (ideaId: string, input: IdeaInput) => {
    setIsMutating(true);
    setMutationError('');

    const result = await updateIdea(ideaId, input);
    if (result.error || !result.idea) {
      const error = result.error || '아이디어를 수정하지 못했습니다.';
      setMutationError(error);
      setIsMutating(false);
      return { error };
    }
    if (mindMap) {
      const composed = await composeIdeas([result.idea], mindMap.title);
      if (composed.error) {
        setMutationError(composed.error);
        setIsMutating(false);
        return { error: composed.error };
      }
    }

    setIsMutating(false);
    return {};
  };

  const handleCreateMindMapChild = async (node: MindMapNode, input: MindMapIdeaDetailsInput) => {
    setIsMutating(true);
    setMutationError('');

    if (node.nodetype === 'root') {
      const result = await createBranch(input.title, input.summary);
      if (result.error) setMutationError(result.error);
      setIsMutating(false);
      return result;
    }

    const branchId = node.nodetype === 'branch' ? node.id : node.parentnodeid;
    if (!branchId) {
      const error = '아이디어를 추가할 가지를 찾을 수 없습니다.';
      setMutationError(error);
      setIsMutating(false);
      return { error };
    }

    const branch = mindMapNodes.find((candidate) => candidate.id === branchId && candidate.nodetype === 'branch');
    if (!branch) {
      const error = '아이디어를 추가할 가지를 찾을 수 없습니다.';
      setMutationError(error);
      setIsMutating(false);
      return { error };
    }
    if (branch.branchfield) {
      const validationError = validateMindMapIdeaField(input, branch.branchfield);
      if (validationError) {
        setMutationError(validationError);
        setIsMutating(false);
        return { error: validationError };
      }
    }

    const created = await createIdea({
      title: input.title,
      content: [input.summary, input.problem, input.solution, ...input.corefeatures].filter(Boolean).join('\n\n') || '마인드맵에서 추가한 아이디어입니다.',
      status: 'thought',
      category: 'planning',
      summary: input.summary,
      problem: input.problem,
      targetusers: input.targetusers,
      solution: input.solution,
      keywords: input.keywords,
      corefeatures: input.corefeatures,
    });
    if (created.error || !created.idea) {
      const error = created.error || '아이디어를 만들지 못했습니다.';
      setMutationError(error);
      setIsMutating(false);
      return { error };
    }

    const placed = await placeIdeaUnderBranch(created.idea, branchId);
    if (placed.error) setMutationError(placed.error);
    else {
      setHighlightedIdeaIds(new Set([created.idea.id]));
      globalThis.setTimeout(() => setHighlightedIdeaIds(new Set()), 4000);
    }
    setIsMutating(false);
    return placed;
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
    } else if (result.idea && mindMap) {
      const composed = await composeIdeas([result.idea], mindMap.title);
      if (composed.error) setMutationError(composed.error);
      else setEditingIdeaId(null);
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
      } else {
        await loadMindMap();
      }

      if (editingIdeaId === ideaId) {
        setEditingIdeaId(null);
      }

      setIsMutating(false);
    });
  };

  const handleDeleteMindMapIdea = async (ideaId: string) => {
    setIsMutating(true);
    setMutationError('');
    const result = await deleteIdea(ideaId);
    if (result.error) {
      setMutationError(result.error);
      setIsMutating(false);
      return { error: result.error };
    }
    await loadMindMap();
    setIsMutating(false);
    return {};
  };

  const handleSaveExtractedCandidates = async (
    candidates: CandidateIdea[],
    _extractionRunId: string,
    topic: string,
  ): Promise<CandidateIdeaSaveResult> => {
    if (candidates.length === 0) {
      return { savedCandidateIds: [], failures: [] };
    }

    setIsMutating(true);
    setMutationError('');

    const failures: CandidateIdeaSaveResult['failures'] = [];
    const savedCandidateIds: string[] = [];
    const placedIdeas: Idea[] = [];
    const existingByKey = new Map(
      ideas.map((idea) => [`${idea.title.trim()}\n${idea.summary.trim() || idea.content.trim()}`.toLocaleLowerCase(), idea]),
    );

    for (const candidate of candidates) {
      try {
        const input = candidateIdeaToIdeaInput(candidate);
        const duplicateKey = `${input.title.trim()}\n${input.summary?.trim() || input.content.trim()}`.toLocaleLowerCase();
        const existing = existingByKey.get(duplicateKey);
        if (existing) {
          placedIdeas.push(existing);
          savedCandidateIds.push(candidate.id);
          continue;
        }
        const result = await createIdea(input);

        if (result.error || !result.idea) {
          failures.push({
            candidateId: candidate.id,
            title: candidate.title,
            message: result.error || '아이디어를 저장하지 못했습니다.',
          });
        } else {
          existingByKey.set(duplicateKey, result.idea);
          placedIdeas.push(result.idea);
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

    if (placedIdeas.length > 0) {
      const composeResult = await composeIdeas(placedIdeas, topic);
      if (composeResult.error) {
        setMutationError(composeResult.error);
        failures.push({ candidateId: 'mind-map', title: '마인드맵 구성', message: composeResult.error });
      } else {
        setHighlightedIdeaIds(new Set(placedIdeas.map((idea) => idea.id)));
        globalThis.setTimeout(() => setHighlightedIdeaIds(new Set()), 4000);
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
          <ThemedText type="sectionTitle">
            {section === 'home' ? '과제 홈' : section === 'ideas' ? '아이디어 목록' : '마인드맵'}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            전체 {ideas.length}개 · 공감 {likeCount}개 · 즐겨찾기 {favoriteCount}개 · 피드백 {feedbacks.length}개
          </ThemedText>
        </View>
      </View>

      {section === 'home' ? (
        <>
          <View style={styles.homeOverview}>
            <ProjectHomeSummary
              deadline={projectDeadline}
              ideaCount={workflowIdeas.length}
              selectedIdeaTitle={selectedIdea?.title}
              workflowState={{
                hasIdeas: completedSteps.extraction,
                hasSelectedIdea: completedSteps.selection,
                hasCurrentMvp,
                hasCurrentPresentation,
              }}
            />
            <ProjectFlowSteps
              current={workflowStep}
              completed={completedSteps}
              onStepPress={handleFlowStepPress}
            />
          </View>

          {workflowStep === 'extraction' ? (
            <IdeaExtractionPanel
              projectId={projectId}
              defaultTopic={mindMap?.title || projectTitle}
              hasMindMap={mindMapNodes.some((node) => node.nodetype === 'idea' || node.nodetype === 'idea_field')}
              onSave={handleSaveExtractedCandidates}
              onGoToMindMap={() => navigateTo('mindmap')}
            />
          ) : null}

          {workflowStep === 'selection' ? (
            <BlindSwipeEvaluation
              projectId={projectId}
              ideas={ideas}
              isLoadingIdeas={isLoadingIdeas}
              loadIdeas={loadIdeas}
              flowController={flowController}
              onGoToExtraction={() => handleFlowStepPress('extraction')}
              onGoToList={() => {
                navigateTo('ideas');
                setIsCreateIdeaOpen(true);
              }}
              onGoToMvp={() => handleFlowStepPress('mvp')}
            />
          ) : null}

          {workflowStep === 'mvp' ? (
            selectedIdea ? (
              <MvpWorkflowPanel
                idea={selectedIdea}
                flowController={flowController}
                onGoToPresentation={() => handleFlowStepPress('presentation')}
              />
            ) : (
              <ThemedView type="backgroundElement" style={[styles.prerequisiteCard, { borderColor: theme.border }]}>
                <ThemedText type="cardTitle">먼저 최종 아이디어를 선정해 주세요.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">MVP 계획은 최종 선정 아이디어를 기준으로 생성됩니다.</ThemedText>
                <Pressable onPress={() => handleFlowStepPress('selection')} style={[styles.prerequisiteButton, { borderColor: theme.primary }]}>
                  <ThemedText type="button" style={{ color: theme.primary }}>AI 비교·선정으로 이동</ThemedText>
                </Pressable>
              </ThemedView>
            )
          ) : null}

          {workflowStep === 'presentation' ? (
            <PresentationWorkflowPanel
              projectId={projectId}
              idea={selectedIdea}
              flowController={flowController}
              onGoToSelection={() => handleFlowStepPress('selection')}
              onGoToMvp={() => handleFlowStepPress('mvp')}
            />
          ) : null}
        </>
      ) : null}

      {section === 'ideas' ? (
        <>
          <View style={styles.listToolbar}>
            <ThemedText type="body" themeColor="textSecondary">아이디어를 모으고 공감으로 우선순위를 정하세요.</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="아이디어 추가"
              onPress={() => { setMutationError(''); setIsCreateIdeaOpen(true); }}
              style={({ pressed }) => [styles.addIdeaButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              <AppIcon name="add" color="#FFFFFF" size={20} />
              <ThemedText type="button" style={styles.primaryButtonText}>아이디어 추가</ThemedText>
            </Pressable>
          </View>

          <Modal
            visible={isCreateIdeaOpen || Boolean(editingIdea)}
            transparent
            animationType="slide"
            onRequestClose={() => { setIsCreateIdeaOpen(false); setEditingIdeaId(null); }}>
            <View style={[styles.ideaModalOverlay, { backgroundColor: theme.overlay }]}>
              <ThemedView type="surfaceElevated" style={[styles.ideaModalPanel, { borderColor: theme.border }, Shadows.floating]}>
                <View style={styles.ideaModalHeader}>
                  <View style={styles.boardTitleBlock}>
                    <ThemedText type="sectionTitle">{editingIdea ? '아이디어 수정' : '아이디어 추가'}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">핵심을 짧게 적고 필요하면 AI 도움으로 다듬어 보세요.</ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="아이디어 입력 창 닫기"
                    onPress={() => { setIsCreateIdeaOpen(false); setEditingIdeaId(null); setMutationError(''); }}
                    style={({ pressed }) => [styles.overflowButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                    <AppIcon name="close" color={theme.textSecondary} size={21} />
                  </Pressable>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.ideaModalContent}>
                  <IdeaForm
                    idea={editingIdea}
                    categories={categories}
                    draftKey={editingIdea ? undefined : `ideadraft:${projectId}`}
                    projectId={editingIdea ? undefined : projectId}
                    submitLabel={editingIdea ? '저장' : '아이디어 등록'}
                    isBusy={isMutating}
                    error={mutationError}
                    onSubmit={editingIdea ? handleUpdate : handleCreate}
                    onCreateCategory={createCategory}
                    onCancel={() => { setIsCreateIdeaOpen(false); setEditingIdeaId(null); setMutationError(''); }}
                  />
                </ScrollView>
              </ThemedView>
            </View>
          </Modal>

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
            <LoadingSkeleton rows={3} />
          ) : visibleIdeas.length === 0 ? (
            <EmptyState
              icon="idea"
              title={ideas.length === 0 ? '첫 아이디어를 추가해 보세요' : '조건에 맞는 아이디어가 없어요'}
              description={ideas.length === 0 ? '완성된 문장일 필요 없어요. 떠오른 생각부터 기록해 보세요.' : '검색어나 상세 필터를 바꿔 보세요.'}
              actionLabel="아이디어 추가"
              onAction={() => setIsCreateIdeaOpen(true)}
            />
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

      {section === 'mindmap' ? (
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
              mindMap={mindMap}
              nodes={mindMapNodes}
              ideas={ideas}
              isBusy={isMutating}
              isLoading={isLoadingMindMap}
              highlightedIdeaIds={highlightedIdeaIds}
              onCreateDefault={() => composeIdeas(ideas, projectTitle)}
              onUpdateTopic={updateTopic}
              onUpdateIdea={handleUpdateMindMapNode}
              onReorganize={() => composeIdeas(ideas, mindMap?.title || projectTitle, true)}
              onMoveNode={moveIdeaNode}
              onCreateChild={handleCreateMindMapChild}
              onUpdateBranch={updateBranch}
              onDeleteBranch={deleteBranch}
              onDeleteIdea={handleDeleteMindMapIdea}
              onGoToAnalysis={() => handleFlowStepPress('selection')}
            />
          )}
        </>
      ) : null}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  board: {
    gap: Spacing.four,
  },
  homeOverview: { gap: Spacing.three },
  prerequisiteCard: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four },
  prerequisiteButton: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  boardTitleBlock: {
    gap: Spacing.one,
  },
  progressSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  progressSummaryHeading: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
  },
  progressMetrics: {
    flex: 1,
    minWidth: 280,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  progressMetric: {
    flex: 1,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  progressMetricDivider: {
    width: 1,
  },
  form: {
    gap: Spacing.four,
    borderRadius: Radius.large,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    fontSize: 16,
    lineHeight: 22,
    minHeight: ControlHeight.input,
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
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderRadius: Radius.pill,
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
    color: '#4050D0',
  },
  addCategoryInput: {
    flex: 1,
  },
  addCategoryButton: {
    minHeight: 46,
    borderRadius: Spacing.two,
    backgroundColor: '#4050D0',
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
    borderColor: '#B9C2FF',
    backgroundColor: '#EEF0FF',
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
    backgroundColor: '#3442B8',
  },
  draftCoachAvatarText: {
    color: '#3442B8',
    lineHeight: 18,
  },
  draftCoachBubble: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#CED4FF',
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
    backgroundColor: '#4050D0',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  draftCoachActionText: {
    color: '#ffffff',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.one,
  },
  modeButton: {
    minWidth: 0,
    flex: 1,
    minHeight: ControlHeight.touch,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
  },
  activeModeButton: {
    backgroundColor: '#4050D0',
  },
  modeButtonText: {
    color: '#475569',
  },
  activeModeButtonText: {
    color: '#ffffff',
  },
  modeButtonLabel: {
    textAlign: 'center',
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
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    minHeight: ControlHeight.input,
    borderRadius: Radius.medium,
    backgroundColor: '#4050D0',
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
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  favoriteFilterButton: {
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: Radius.pill,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  advancedFilterButton: {
    width: ControlHeight.input,
    height: ControlHeight.input,
    borderWidth: 1,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedFilters: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  ideaCard: {
    flexGrow: 1,
    flexBasis: 360,
    gap: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: 1,
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
    minHeight: 30,
    borderWidth: 1,
    borderRadius: Radius.pill,
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
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  keywordChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  detailToggle: {
    minHeight: ControlHeight.touch,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  structuredDetails: {
    gap: Spacing.three,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  ideaDetailSection: {
    gap: Spacing.half,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  likeButton: {
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderColor: '#B9C2FF',
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  activeLikeButton: {
    backgroundColor: '#4050D0',
    borderColor: '#4050D0',
  },
  likeMark: {
    color: '#4050D0',
  },
  activeLikeMark: {
    color: '#ffffff',
  },
  likeText: {
    color: '#3442B8',
  },
  activeLikeText: {
    color: '#ffffff',
  },
  likeCountText: {
    lineHeight: 20,
  },
  nextStatusButton: {
    alignSelf: 'flex-start',
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  nextStatusText: {
    color: '#3442B8',
  },
  listToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  addIdeaButton: {
    minHeight: ControlHeight.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  ideaModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  ideaModalPanel: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    borderWidth: 1,
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  ideaModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  ideaModalContent: {
    paddingBottom: Spacing.four,
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
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderRadius: Radius.medium,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  feedbackButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    backgroundColor: '#4050D0',
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
    borderRadius: Radius.medium,
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
    minHeight: ControlHeight.touch,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Radius.medium,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  feedbackResolvedButton: {
    borderColor: '#83DCAE',
    backgroundColor: '#E7F8EF',
  },
  feedbackResolveText: {
    color: '#475569',
  },
  feedbackResolvedText: {
    color: '#168B51',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: ControlHeight.button,
    borderRadius: Radius.medium,
    backgroundColor: '#4050D0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  favoriteButton: {
    width: ControlHeight.touch,
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
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
  overflowButton: {
    width: ControlHeight.touch,
    height: ControlHeight.touch,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowMenu: {
    alignSelf: 'flex-end',
    minWidth: 190,
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  overflowMenuItem: {
    minHeight: ControlHeight.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  overflowDangerItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
  },
  compactButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  compactDangerButton: {
    minHeight: ControlHeight.touch,
    borderRadius: Radius.medium,
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
    gap: Spacing.four,
    borderRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
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
    minHeight: ControlHeight.button,
    borderRadius: Radius.medium,
    backgroundColor: '#4050D0',
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
    borderRadius: Radius.large,
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
    color: '#4050D0',
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
    borderRadius: Radius.medium,
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
    borderRadius: Radius.pill,
    backgroundColor: '#4050D0',
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
    borderRadius: Radius.large,
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
