import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useIdeas } from '@/hooks/use-ideas';
import { useTheme } from '@/hooks/use-theme';
import { IdeaStatuses, type Idea, type IdeaInput, type IdeaStatus } from '@/types/idea';

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
};

const allFilter = '전체';
type IdeaFilter = typeof allFilter | IdeaStatus;
const filterOptions: IdeaFilter[] = [allFilter, ...IdeaStatuses];

const statusColors: Record<IdeaStatus, { background: string; border: string; text: string }> = {
  '떠오른 생각': { background: '#eef6ff', border: '#95c8ff', text: '#0b5cad' },
  '조사 필요': { background: '#fff7e8', border: '#f2bd66', text: '#8a4b00' },
  '쓸 만함': { background: '#ecfdf3', border: '#7bd99a', text: '#137333' },
  '최종 사용': { background: '#f4efff', border: '#b8a2ff', text: '#5b38b5' },
};

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
    <View style={styles.statusRow}>
      {IdeaStatuses.map((status) => {
        const palette = statusColors[status];
        const isSelected = selectedStatus === status;

        return (
          <Pressable
            key={status}
            onPress={() => onSelect(status)}
            style={({ pressed }) => [
              styles.statusChip,
              {
                borderColor: palette.border,
                backgroundColor: isSelected ? palette.background : 'transparent',
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: isSelected ? palette.text : palette.border }}>
              {status}
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
  const [status, setStatus] = useState<IdeaStatus>(idea?.status ?? '떠오른 생각');
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

    await onSubmit({ title, content, status });

    if (!idea) {
      setTitle('');
      setContent('');
      setStatus('떠오른 생각');
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
          placeholder="떠오른 근거, 참고할 자료, 다음 행동을 적어두세요."
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

function IdeaCard({ idea, isBusy = false, onEdit, onDelete }: IdeaCardProps) {
  const palette = statusColors[idea.status];

  return (
    <ThemedView type="backgroundElement" style={styles.ideaCard}>
      <View style={styles.cardHeader}>
        <ThemedView style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <ThemedText type="smallBold" style={{ color: palette.text }}>
            {idea.status}
          </ThemedText>
        </ThemedView>
        <View style={styles.cardActions}>
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
  const { ideas, isLoadingIdeas, ideaError, createIdea, updateIdea, deleteIdea } = useIdeas(projectId);
  const theme = useTheme();
  const [filter, setFilter] = useState<IdeaFilter>(allFilter);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const visibleIdeas = useMemo(
    () => (filter === allFilter ? ideas : ideas.filter((idea) => idea.status === filter)),
    [filter, ideas],
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
            {ideas.length}개 아이디어
          </ThemedText>
        </View>
      </View>

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
        <ThemedText type="smallBold">아이디어 카드 필터</ThemedText>
        <View style={styles.filterRow}>
          {filterOptions.map((status) => {
            const isSelected = filter === status;
            const palette = status === allFilter ? null : statusColors[status];
            const textColor = isSelected
              ? palette?.text ?? theme.text
              : palette?.border ?? theme.text;

            return (
              <Pressable
                key={status}
                onPress={() => setFilter(status)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    borderColor: palette?.border ?? '#9aa2b1',
                    backgroundColor: isSelected ? palette?.background ?? '#e8eef8' : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: textColor }}>
                  {status}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {ideaError ? (
        <ThemedText type="small" style={styles.errorText}>
          {ideaError}
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
            제목과 내용을 적고 상태 태그를 선택해 아이디어를 쌓아보세요.
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
            />
          ))}
        </View>
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
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statusChip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
