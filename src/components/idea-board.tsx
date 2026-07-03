import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IdeaMindMap } from '@/components/idea-mind-map';
import { Spacing } from '@/constants/theme';
import { useIdeas } from '@/hooks/use-ideas';
import { useTheme } from '@/hooks/use-theme';
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
  isBusy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
};

const allCategoryFilter = 'all';
const listMode = 'list';
const mindMapMode = 'mindmap';
type CategoryFilter = typeof allCategoryFilter | IdeaCategory;
type BoardMode = typeof listMode | typeof mindMapMode;
const categoryFilters: CategoryFilter[] = [allCategoryFilter, ...IdeaCategories];

const statusColors: Record<IdeaStatus, { background: string; border: string; text: string }> = {
  thought: { background: '#eef6ff', border: '#95c8ff', text: '#0b5cad' },
  research: { background: '#fff7e8', border: '#f2bd66', text: '#8a4b00' },
  approved: { background: '#ecfdf3', border: '#7bd99a', text: '#137333' },
  selected: { background: '#f3efff', border: '#b8a2ff', text: '#5b38b5' },
};

const categoryColors: Record<IdeaCategory, { background: string; border: string; text: string }> = {
  planning: { background: '#f4f6f8', border: '#9aa2b1', text: '#3f4652' },
  design: { background: '#fff0f6', border: '#f19ac0', text: '#9b1b57' },
  develop: { background: '#eaf8f1', border: '#6dc99a', text: '#0f6b3f' },
  research: { background: '#eef4ff', border: '#8ab3f8', text: '#2457a7' },
};

function getCategoryLabel(filter: CategoryFilter) {
  return filter === allCategoryFilter ? '전체' : IdeaCategoryLabels[filter];
}

function confirmDelete(onConfirm: () => void) {
  const message = '이 아이디어 카드를 삭제할까요? 삭제한 카드는 되돌릴 수 없습니다.';

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
    const nextTitleError = title.trim() ? '' : '아이디어 제목을 입력해주세요.';
    const nextContentError = content.trim() ? '' : '아이디어 내용을 입력해주세요.';

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
          placeholder="예: 발표 도입부를 사용자 사례로 시작하기"
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
          placeholder="아이디어의 근거, 참고 자료, 다음 행동을 적어주세요."
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
        <ThemedText type="smallBold">상태 태그</ThemedText>
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

function IdeaCard({ idea, isBusy = false, onEdit, onDelete, onToggleFavorite }: IdeaCardProps) {
  const status = normalizeIdeaStatus(idea.status);
  const category = normalizeIdeaCategory(idea.category);
  const statusPalette = statusColors[status];
  const categoryPalette = categoryColors[category];

  return (
    <ThemedView type="backgroundElement" style={styles.ideaCard}>
      <View style={styles.cardHeader}>
        <View style={styles.tagRow}>
          <ThemedView
            style={[
              styles.tag,
              { backgroundColor: categoryPalette.background, borderColor: categoryPalette.border },
            ]}>
            <ThemedText type="smallBold" style={{ color: categoryPalette.text }}>
              {IdeaCategoryLabels[category]}
            </ThemedText>
          </ThemedView>
          <ThemedView
            style={[
              styles.tag,
              { backgroundColor: statusPalette.background, borderColor: statusPalette.border },
            ]}>
            <ThemedText type="smallBold" style={{ color: statusPalette.text }}>
              {IdeaStatusLabels[status]}
            </ThemedText>
          </ThemedView>
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
    </ThemedView>
  );
}

export function IdeaBoard({ projectId }: IdeaBoardProps) {
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
  const theme = useTheme();
  const [boardMode, setBoardMode] = useState<BoardMode>(listMode);
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
          <ThemedText type="smallBold">아이디어 카드</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            전체 {ideas.length}개 · 즐겨찾기 {favoriteCount}개
          </ThemedText>
        </View>
      </View>

      <View style={styles.modeToggle}>
        <Pressable
          onPress={() => setBoardMode(listMode)}
          style={({ pressed }) => [
            styles.modeButton,
            boardMode === listMode && styles.activeModeButton,
            pressed && styles.pressed,
          ]}>
          <ThemedText
            type="smallBold"
            style={boardMode === listMode ? styles.activeModeButtonText : styles.modeButtonText}>
            목록 모드
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setBoardMode(mindMapMode)}
          style={({ pressed }) => [
            styles.modeButton,
            boardMode === mindMapMode && styles.activeModeButton,
            pressed && styles.pressed,
          ]}>
          <ThemedText
            type="smallBold"
            style={boardMode === mindMapMode ? styles.activeModeButtonText : styles.modeButtonText}>
            마인드맵 모드
          </ThemedText>
        </Pressable>
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

          <View style={styles.filterBlock}>
            <View style={styles.filterHeader}>
              <ThemedText type="smallBold">카테고리 필터</ThemedText>
              <Pressable
                onPress={() => setFavoriteOnly((current) => !current)}
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
                    onPress={() => setCategoryFilter(category)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        borderColor: palette?.border ?? '#9aa2b1',
                        backgroundColor: isSelected ? palette?.background ?? '#e8eef8' : 'transparent',
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

          {ideaError || mutationError ? (
            <ThemedText type="small" style={styles.errorText}>
              {ideaError || mutationError}
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
                카테고리나 즐겨찾기 필터를 바꾸거나 새 아이디어를 등록해보세요.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.ideaList}>
              {visibleIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  isBusy={isMutating}
                  onEdit={() => {
                    setEditingIdeaId(idea.id);
                    setMutationError('');
                  }}
                  onDelete={() => handleDelete(idea.id)}
                  onToggleFavorite={() => handleToggleFavorite(idea)}
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          {ideaError || mutationError ? (
            <ThemedText type="small" style={styles.errorText}>
              {ideaError || mutationError}
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
      )}
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
  form: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
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
    gap: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#eef1f6',
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
    backgroundColor: '#2868d8',
  },
  modeButtonText: {
    color: '#3f4652',
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
    borderColor: '#d6a62a',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  activeFavoriteFilterButton: {
    backgroundColor: '#fff4cc',
  },
  favoriteFilterText: {
    color: '#9a6a00',
  },
  activeFavoriteFilterText: {
    color: '#6f4d00',
  },
  editingBlock: {
    gap: Spacing.two,
  },
  ideaList: {
    gap: Spacing.three,
  },
  ideaCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: Spacing.two,
    backgroundColor: '#2868d8',
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
    borderColor: '#9aa2b1',
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
    borderColor: '#d6a62a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFavoriteButton: {
    backgroundColor: '#fff4cc',
  },
  favoriteText: {
    color: '#9a6a00',
  },
  activeFavoriteText: {
    color: '#6f4d00',
  },
  compactButton: {
    minHeight: 34,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#9aa2b1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  compactDangerButton: {
    minHeight: 34,
    borderRadius: Spacing.two,
    backgroundColor: '#d92d20',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  dangerButtonText: {
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#d92d20',
  },
  pressed: {
    opacity: 0.72,
  },
});
