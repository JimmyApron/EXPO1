import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type IdeaStatus = 'draft' | 'review' | 'selected';

type Feedback = {
  id: string;
  ideaId: string;
  content: string;
  createdAt: Date;
};

type Idea = {
  id: string;
  title: string;
  author: string;
  status: IdeaStatus;
};

const initialIdeas: Idea[] = [
  { id: 'idea-1', title: 'AI 기반 과제 추천', author: '김민준', status: 'review' },
  { id: 'idea-2', title: '팀별 일정 공유 보드', author: '이서연', status: 'selected' },
  { id: 'idea-3', title: '피드백 요약 알림', author: '박지우', status: 'draft' },
  { id: 'idea-4', title: '최종 발표 자료 자동 점검', author: '최윤서', status: 'selected' },
];

const statusLabels: Record<IdeaStatus, string> = {
  draft: '등록',
  review: '검토 중',
  selected: '최종 선택',
};

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return isValid ? date : null;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getDDay(deadline: Date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDeadline = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate()
  );
  const diffDays = Math.ceil(
    (startOfDeadline.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 0) return `D-${diffDays}`;
  if (diffDays === 0) return 'D-Day';
  return `D+${Math.abs(diffDays)}`;
}

export default function DeadlineFeedbackScreen() {
  const [deadline, setDeadline] = useState(() => new Date(2026, 7, 31));
  const [deadlineInput, setDeadlineInput] = useState('2026-08-31');
  const [deadlineError, setDeadlineError] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [selectedIdeaId, setSelectedIdeaId] = useState(initialIdeas[0].id);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([
    {
      id: 'feedback-1',
      ideaId: 'idea-2',
      content: '팀 단위 사용 흐름이 명확해서 최종 후보로 유지하면 좋겠습니다.',
      createdAt: new Date(2026, 6, 5, 10, 20),
    },
  ]);
  const [feedbackInput, setFeedbackInput] = useState('');

  const selectedIdea = ideas.find((idea) => idea.id === selectedIdeaId) ?? ideas[0];
  const selectedIdeaFeedbacks = feedbacks.filter((feedback) => feedback.ideaId === selectedIdea.id);

  const stats = useMemo(
    () => ({
      registered: ideas.length,
      selected: ideas.filter((idea) => idea.status === 'selected').length,
      feedbackCount: feedbacks.length,
    }),
    [feedbacks.length, ideas]
  );

  const handleApplyDeadline = () => {
    const nextDeadline = parseDateInput(deadlineInput);

    if (!nextDeadline) {
      setDeadlineError('YYYY-MM-DD 형식의 올바른 날짜를 입력해 주세요.');
      return;
    }

    setDeadline(nextDeadline);
    setDeadlineError('');
  };

  const handleAddFeedback = () => {
    const content = feedbackInput.trim();

    if (!content) return;

    setFeedbacks((current) => [
      {
        id: `${Date.now()}`,
        ideaId: selectedIdea.id,
        content,
        createdAt: new Date(),
      },
      ...current,
    ]);
    setFeedbackInput('');
  };

  const handleStatusChange = (ideaId: string, status: IdeaStatus) => {
    setIdeas((current) => current.map((idea) => (idea.id === ideaId ? { ...idea, status } : idea)));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>과제 관리</Text>
        <Text style={styles.heading}>D-day 및 피드백</Text>
      </View>

      <View style={styles.deadlinePanel}>
        <View style={styles.deadlineCopy}>
          <Text style={styles.sectionTitle}>과제 마감일</Text>
          <Text style={styles.deadlineDate}>{formatDate(deadline)}</Text>
          <Text style={styles.helperText}>마감일을 바꾸면 남은 기간이 즉시 갱신됩니다.</Text>
        </View>
        <Text style={styles.dDay}>{getDDay(deadline)}</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel="과제 마감일"
          inputMode="numeric"
          onChangeText={setDeadlineInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#7f8794"
          style={styles.input}
          value={deadlineInput}
        />
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleApplyDeadline}>
          <Text style={styles.primaryButtonText}>설정</Text>
        </Pressable>
      </View>
      {deadlineError ? <Text style={styles.errorText}>{deadlineError}</Text> : null}

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.registered}</Text>
          <Text style={styles.statLabel}>등록된 아이디어</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.selected}</Text>
          <Text style={styles.statLabel}>최종 선택</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.feedbackCount}</Text>
          <Text style={styles.statLabel}>누적 피드백</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>아이디어 진행 상황</Text>
        <Text style={styles.helperText}>아이디어를 선택하면 해당 피드백 목록을 볼 수 있습니다.</Text>
      </View>

      <View style={styles.ideaList}>
        {ideas.map((idea) => {
          const isSelected = idea.id === selectedIdea.id;

          return (
            <Pressable
              key={idea.id}
              style={({ pressed }) => [
                styles.ideaCard,
                isSelected && styles.ideaCardSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => setSelectedIdeaId(idea.id)}>
              <View style={styles.ideaTopRow}>
                <View style={styles.ideaTitleGroup}>
                  <Text style={styles.ideaTitle}>{idea.title}</Text>
                  <Text style={styles.ideaMeta}>{idea.author}</Text>
                </View>
                <Text style={[styles.statusBadge, idea.status === 'selected' && styles.statusBadgeSelected]}>
                  {statusLabels[idea.status]}
                </Text>
              </View>

              <View style={styles.statusControls}>
                {(Object.keys(statusLabels) as IdeaStatus[]).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusButton,
                      idea.status === status && styles.statusButtonActive,
                    ]}
                    onPress={() => handleStatusChange(idea.id, status)}>
                    <Text
                      style={[
                        styles.statusButtonText,
                        idea.status === status && styles.statusButtonTextActive,
                      ]}>
                      {statusLabels[status]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.feedbackPanel}>
        <Text style={styles.sectionTitle}>{selectedIdea.title} 피드백</Text>
        <View style={styles.feedbackInputWrap}>
          <TextInput
            accessibilityLabel="아이디어 피드백"
            multiline
            onChangeText={setFeedbackInput}
            placeholder="이 아이디어에 남길 피드백을 입력해 주세요."
            placeholderTextColor="#7f8794"
            style={styles.feedbackInput}
            value={feedbackInput}
          />
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleAddFeedback}>
            <Text style={styles.primaryButtonText}>등록</Text>
          </Pressable>
        </View>

        <View style={styles.feedbackList}>
          {selectedIdeaFeedbacks.length === 0 ? (
            <Text style={styles.emptyText}>아직 등록된 피드백이 없습니다.</Text>
          ) : (
            selectedIdeaFeedbacks.map((feedback) => (
              <View key={feedback.id} style={styles.feedbackItem}>
                <Text style={styles.feedbackText}>{feedback.content}</Text>
                <Text style={styles.feedbackDate}>{formatDate(feedback.createdAt)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    paddingTop: 24,
    gap: 4,
  },
  eyebrow: {
    color: '#4661e6',
    fontSize: 13,
    fontWeight: '700',
  },
  heading: {
    color: '#151923',
    fontSize: 30,
    fontWeight: '800',
  },
  deadlinePanel: {
    alignItems: 'center',
    backgroundColor: '#151923',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  deadlineCopy: {
    flex: 1,
    gap: 6,
  },
  sectionTitle: {
    color: '#151923',
    fontSize: 18,
    fontWeight: '800',
  },
  deadlineDate: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  helperText: {
    color: '#687083',
    fontSize: 13,
    lineHeight: 19,
  },
  dDay: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dce7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151923',
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#4661e6',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  errorText: {
    color: '#cf2f42',
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  statValue: {
    color: '#151923',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: '#687083',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeader: {
    gap: 4,
  },
  ideaList: {
    gap: 10,
  },
  ideaCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  ideaCardSelected: {
    borderColor: '#4661e6',
    borderWidth: 2,
  },
  ideaTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  ideaTitleGroup: {
    flex: 1,
    gap: 4,
  },
  ideaTitle: {
    color: '#151923',
    fontSize: 16,
    fontWeight: '800',
  },
  ideaMeta: {
    color: '#687083',
    fontSize: 13,
  },
  statusBadge: {
    backgroundColor: '#edf0f8',
    borderRadius: 8,
    color: '#4d5568',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeSelected: {
    backgroundColor: '#dff7e8',
    color: '#16713b',
  },
  statusControls: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    alignItems: 'center',
    borderColor: '#d8dce7',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#151923',
    borderColor: '#151923',
  },
  statusButtonText: {
    color: '#687083',
    fontSize: 12,
    fontWeight: '800',
  },
  statusButtonTextActive: {
    color: '#ffffff',
  },
  feedbackPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  feedbackInputWrap: {
    gap: 10,
  },
  feedbackInput: {
    borderColor: '#d8dce7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#151923',
    fontSize: 15,
    minHeight: 92,
    padding: 12,
    textAlignVertical: 'top',
  },
  feedbackList: {
    gap: 10,
  },
  emptyText: {
    color: '#687083',
    fontSize: 14,
    textAlign: 'center',
  },
  feedbackItem: {
    backgroundColor: '#f6f7fb',
    borderRadius: 8,
    gap: 6,
    padding: 12,
  },
  feedbackText: {
    color: '#151923',
    fontSize: 15,
    lineHeight: 21,
  },
  feedbackDate: {
    color: '#687083',
    fontSize: 12,
    fontWeight: '700',
  },
});
