import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { IdeaMindMap } from '@/components/idea-mind-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useIdeaFeedbacks } from '@/hooks/use-idea-feedbacks';
import { useIdeas } from '@/hooks/use-ideas';
import { useTheme } from '@/hooks/use-theme';
import { formatDeadlineLabel, getDDayLabel } from '@/lib/deadline';
import type { IdeaFeedback } from '@/types/feedback';
import {
  IdeaCategories,
  IdeaCategoryLabels,
  IdeaStatusLabels,
  IdeaStatuses,
  normalizeIdeaCategory,
  normalizeIdeaStatus,
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
  submitLabel: string;
  isBusy?: boolean;
  error?: string;
  onSubmit: (input: IdeaInput) => void | Promise<void>;
  onCancel?: () => void;
};

type IdeaCardProps = {
  idea: Idea;
  feedbacks: IdeaFeedback[];
  isBusy?: boolean;
  isLoadingFeedbacks?: boolean;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onStatusChange: (status: IdeaStatus) => void;
  onAddFeedback: (ideaId: string, content: string) => Promise<{ error?: string }>;
};

const allCategoryFilter = 'all';
const listMode = 'list';
const kanbanMode = 'kanban';
const mindMapMode = 'mindmap';
const finalMode = 'final';

type CategoryFilter = typeof allCategoryFilter | IdeaCategory;
type BoardMode = typeof listMode | typeof kanbanMode | typeof mindMapMode | typeof finalMode;

const categoryFilters: CategoryFilter[] = [allCategoryFilter, ...IdeaCategories];

const statusColors: Record<IdeaStatus, { background: string; border: string; text: string }> = {
  thought: { background: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  research: { background: '#fff7ed', border: '#fdba74', text: '#c2410c' },
  approved: { background: '#ecfdf5', border: '#86efac', text: '#15803d' },
  selected: { background: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
};

const categoryColors: Record<IdeaCategory, { background: string; border: string; text: string }> = {
  planning: { background: '#f8fafc', border: '#cbd5e1', text: '#475569' },
  design: { background: '#fdf2f8', border: '#f9a8d4', text: '#be185d' },
  develop: { background: '#ecfdf5', border: '#86efac', text: '#15803d' },
  research: { background: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
};

const boardTabs: { id: BoardMode; label: string }[] = [
  { id: listMode, label: '목록' },
  { id: kanbanMode, label: '칸반' },
  { id: mindMapMode, label: '마인드맵' },
  { id: finalMode, label: '최종안' },
];

function getCategoryLabel(filter: CategoryFilter) {
  return filter === allCategoryFilter ? '전체' : IdeaCategoryLabels[filter];
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
  selectedCategory,
  onSelect,
}: {
  selectedCategory: IdeaCategory;
  onSelect: (category: IdeaCategory) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {IdeaCategories.map((category) => {
        const palette = categoryColors[category];
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
              {IdeaCategoryLabels[category]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function IdeaForm({ idea, submitLabel, isBusy = false, error, onSubmit, onCancel }: IdeaFormProps) {
  const theme = useTheme();
  const [title, setTitle] = useState(idea?.title ?? '');
  const [content, setContent] = useState(idea?.content ?? '');
  const [category, setCategory] = useState<IdeaCategory>(normalizeIdeaCategory(idea?.category));
  const [status, setStatus] = useState<IdeaStatus>(normalizeIdeaStatus(idea?.status));
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');

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
      setTitle('');
      setContent('');
      setCategory('planning');
      setStatus('thought');
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="smallBold">아이디어 제목</ThemedText>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
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
        <CategorySelector selectedCategory={category} onSelect={setCategory} />
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
}: Pick<IdeaCardProps, 'idea' | 'feedbacks' | 'isLoadingFeedbacks' | 'onAddFeedback'>) {
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
              <ThemedText type="small" themeColor="textSecondary">
                {formatFeedbackDate(feedback.createdat)}
              </ThemedText>
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
  const palette = categoryColors[category];

  return (
    <View style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {IdeaCategoryLabels[category]}
      </ThemedText>
    </View>
  );
}

function IdeaCard({
  idea,
  feedbacks,
  isBusy = false,
  isLoadingFeedbacks = false,
  compact = false,
  onEdit,
  onDelete,
  onToggleFavorite,
  onStatusChange,
  onAddFeedback,
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
        />
      ) : null}
    </ThemedView>
  );
}

function FilterBlock({
  categoryFilter,
  favoriteOnly,
  onChangeCategory,
  onToggleFavorite,
}: {
  categoryFilter: CategoryFilter;
  favoriteOnly: boolean;
  onChangeCategory: (category: CategoryFilter) => void;
  onToggleFavorite: () => void;
}) {
  const theme = useTheme();

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
      <View style={styles.filterRow}>
        {categoryFilters.map((category) => {
          const isSelected = categoryFilter === category;
          const palette = category === allCategoryFilter ? null : categoryColors[category];
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
  );
}

function KanbanBoard({
  ideas,
  feedbacksByIdeaId,
  isBusy,
  onEdit,
  onDelete,
  onToggleFavorite,
  onStatusChange,
  onAddFeedback,
}: {
  ideas: Idea[];
  feedbacksByIdeaId: Map<string, IdeaFeedback[]>;
  isBusy: boolean;
  onEdit: (ideaId: string) => void;
  onDelete: (ideaId: string) => void;
  onToggleFavorite: (idea: Idea) => void;
  onStatusChange: (idea: Idea, status: IdeaStatus) => void;
  onAddFeedback: (ideaId: string, content: string) => Promise<{ error?: string }>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.kanbanScroll}>
      {IdeaStatuses.map((status) => {
        const statusIdeas = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === status);
        const palette = statusColors[status];

        return (
          <View key={status} style={styles.kanbanColumn}>
            <View style={[styles.kanbanHeader, { borderColor: palette.border, backgroundColor: palette.background }]}>
              <ThemedText type="smallBold" style={{ color: palette.text }}>
                {IdeaStatusLabels[status]}
              </ThemedText>
              <ThemedText type="small" style={{ color: palette.text }}>
                {statusIdeas.length}개
              </ThemedText>
            </View>
            <View style={styles.kanbanCards}>
              {statusIdeas.length === 0 ? (
                <ThemedView type="backgroundElement" style={styles.kanbanEmpty}>
                  <ThemedText type="small" themeColor="textSecondary">
                    아직 카드가 없습니다.
                  </ThemedText>
                </ThemedView>
              ) : (
                statusIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    compact
                    feedbacks={feedbacksByIdeaId.get(idea.id) ?? []}
                    isBusy={isBusy}
                    onEdit={() => onEdit(idea.id)}
                    onDelete={() => onDelete(idea.id)}
                    onToggleFavorite={() => onToggleFavorite(idea)}
                    onStatusChange={(nextStatus) => onStatusChange(idea, nextStatus)}
                    onAddFeedback={onAddFeedback}
                  />
                ))
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function FinalDraftView({ ideas }: { ideas: Idea[] }) {
  const selectedIdeas = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === 'selected');
  const approvedIdeas = ideas.filter((idea) => normalizeIdeaStatus(idea.status) === 'approved');
  const sourceIdeas = selectedIdeas.length > 0 ? selectedIdeas : approvedIdeas;

  if (sourceIdeas.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.emptyState}>
        <ThemedText type="smallBold">최종안에 넣을 아이디어가 없습니다.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
          칸반에서 좋은 아이디어를 쓸 만함 또는 최종 사용 상태로 올려 보세요.
        </ThemedText>
      </ThemedView>
    );
  }

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
  } = useIdeas(projectId);
  const {
    feedbacks,
    feedbacksByIdeaId,
    isLoadingFeedbacks,
    feedbackError,
    createFeedback,
  } = useIdeaFeedbacks(projectId);
  const [boardMode, setBoardMode] = useState<BoardMode>(kanbanMode);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(allCategoryFilter);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const favoriteCount = useMemo(() => ideas.filter((idea) => idea.isfavorite).length, [ideas]);
  const visibleIdeas = useMemo(
    () =>
      ideas.filter((idea) => {
        const matchesCategory =
          categoryFilter === allCategoryFilter || normalizeIdeaCategory(idea.category) === categoryFilter;
        const matchesFavorite = !favoriteOnly || idea.isfavorite;

        return matchesCategory && matchesFavorite;
      }),
    [categoryFilter, favoriteOnly, ideas],
  );
  const editingIdea = editingIdeaId ? ideas.find((idea) => idea.id === editingIdeaId) : undefined;
  const currentError = ideaError || mutationError || feedbackError;

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

  return (
    <ThemedView style={styles.board}>
      <View style={styles.boardHeader}>
        <View style={styles.boardTitleBlock}>
          <ThemedText type="smallBold">과제 진행 보드</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            전체 {ideas.length}개 · 즐겨찾기 {favoriteCount}개 · 피드백 {feedbacks.length}개
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

      {boardMode === listMode ? (
        <>
          <IdeaForm
            submitLabel="등록"
            isBusy={isMutating && !editingIdeaId}
            error={!editingIdeaId ? mutationError : ''}
            onSubmit={handleCreate}
          />

          {editingIdea ? (
            <View style={styles.editingBlock}>
              <ThemedText type="smallBold">아이디어 수정</ThemedText>
              <IdeaForm
                idea={editingIdea}
                submitLabel="저장"
                isBusy={isMutating}
                error={editingIdeaId ? mutationError : ''}
                onSubmit={handleUpdate}
                onCancel={() => {
                  setEditingIdeaId(null);
                  setMutationError('');
                }}
              />
            </View>
          ) : null}

          <FilterBlock
            categoryFilter={categoryFilter}
            favoriteOnly={favoriteOnly}
            onChangeCategory={setCategoryFilter}
            onToggleFavorite={() => setFavoriteOnly((current) => !current)}
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
                  isBusy={isMutating}
                  isLoadingFeedbacks={isLoadingFeedbacks}
                  onEdit={() => {
                    setEditingIdeaId(idea.id);
                    setMutationError('');
                  }}
                  onDelete={() => handleDelete(idea.id)}
                  onToggleFavorite={() => handleToggleFavorite(idea)}
                  onStatusChange={(status) => handleStatusChange(idea, status)}
                  onAddFeedback={handleAddFeedback}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {boardMode === kanbanMode ? (
        <>
          <IdeaForm
            submitLabel="아이디어 추가"
            isBusy={isMutating && !editingIdeaId}
            error={!editingIdeaId ? mutationError : ''}
            onSubmit={handleCreate}
          />
          {editingIdea ? (
            <View style={styles.editingBlock}>
              <ThemedText type="smallBold">아이디어 수정</ThemedText>
              <IdeaForm
                idea={editingIdea}
                submitLabel="저장"
                isBusy={isMutating}
                error={editingIdeaId ? mutationError : ''}
                onSubmit={handleUpdate}
                onCancel={() => {
                  setEditingIdeaId(null);
                  setMutationError('');
                }}
              />
            </View>
          ) : null}
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
            <KanbanBoard
              ideas={ideas}
              feedbacksByIdeaId={feedbacksByIdeaId}
              isBusy={isMutating}
              onEdit={(ideaId) => {
                setEditingIdeaId(ideaId);
                setMutationError('');
              }}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onStatusChange={handleStatusChange}
              onAddFeedback={handleAddFeedback}
            />
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
              onCreateNode={handleCreateMindMapNode}
              onUpdateNode={handleUpdateMindMapNode}
              onPersistNodeLayout={handlePersistMindMapLayout}
            />
          )}
        </>
      ) : null}

      {boardMode === finalMode ? <FinalDraftView ideas={ideas} /> : null}
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
  filterBlock: {
    gap: Spacing.two,
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
  kanbanScroll: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  kanbanColumn: {
    width: 280,
    gap: Spacing.two,
  },
  kanbanHeader: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  kanbanCards: {
    gap: Spacing.two,
  },
  kanbanEmpty: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.three,
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
