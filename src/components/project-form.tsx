import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Project, ProjectInput } from '@/types/project';

type ProjectFormProps = {
  project?: Project;
  submitLabel: string;
  isbusy?: boolean;
  error?: string;
  onSubmit: (input: ProjectInput) => void | Promise<void>;
  onCancel?: () => void;
};

type CalendarPickerProps = {
  visible: boolean;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
};

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

function getInitialMonth(selectedDate: string) {
  const selected = parseDate(selectedDate) ?? new Date();

  return new Date(selected.getFullYear(), selected.getMonth(), 1);
}

function CalendarPicker({ visible, selectedDate, onSelect, onClear, onClose }: CalendarPickerProps) {
  const theme = useTheme();
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialMonth(selectedDate));
  const selected = parseDate(selectedDate);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const dayCount = new Date(year, month + 1, 0).getDate();

    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: dayCount }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const openToday = () => {
    const today = new Date();
    onSelect(formatDate(today));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.calendarPanel, { backgroundColor: theme.background }]}>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => moveMonth(-1)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">{'<'}</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.calendarTitle}>
              {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
            </ThemedText>
            <Pressable
              onPress={() => moveMonth(1)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">{'>'}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {weekdays.map((weekday) => (
              <ThemedText key={weekday} type="small" themeColor="textSecondary" style={styles.weekday}>
                {weekday}
              </ThemedText>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {days.map((date, index) => {
              const dateValue = date ? formatDate(date) : '';
              const isSelected = Boolean(selected && dateValue === formatDate(selected));

              return (
                <View key={`${dateValue}-${index}`} style={styles.dayCell}>
                  {date ? (
                    <Pressable
                      onPress={() => onSelect(dateValue)}
                      style={({ pressed }) => [
                        styles.dayButton,
                        isSelected && styles.selectedDayButton,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={isSelected && styles.selectedDayButtonText}>
                        {date.getDate()}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.calendarActions}>
            <Pressable
              onPress={onClear}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">마감일 없이 선택</ThemedText>
            </Pressable>
            <Pressable
              onPress={openToday}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">오늘</ThemedText>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                닫기
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

export function ProjectForm({
  project,
  submitLabel,
  isbusy = false,
  error,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const theme = useTheme();
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [deadline, setDeadline] = useState(project?.deadline ?? '');
  const [titleError, setTitleError] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.backgroundSelected,
      color: theme.text,
      backgroundColor: theme.background,
    },
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      setTitleError('제목은 필수입니다.');
      return;
    }

    await onSubmit({ title, description, deadline: deadline.trim() });

    if (!project) {
      setTitle('');
      setDescription('');
      setDeadline('');
    }
    setTitleError('');
  };

  return (
    <ThemedView type="backgroundElement" style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="smallBold">제목</ThemedText>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            if (titleError) {
              setTitleError('');
            }
          }}
          placeholder="예: UX 리서치 발표 과제"
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
        <ThemedText type="smallBold">설명</ThemedText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="과제 조건, 참고할 주제, 메모를 적으세요."
          placeholderTextColor={theme.textSecondary}
          style={[inputStyle, styles.multilineInput]}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="smallBold">마감일</ThemedText>
        <Pressable
          onPress={() => setIsCalendarOpen(true)}
          style={({ pressed }) => [
            styles.dateSelectButton,
            {
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
            pressed && styles.pressed,
          ]}>
          <ThemedText themeColor={deadline ? 'text' : 'textSecondary'}>
            {deadline || '마감일 없음'}
          </ThemedText>
        </Pressable>
      </View>

      {isCalendarOpen ? (
        <CalendarPicker
          visible
          selectedDate={deadline}
          onSelect={(date) => {
            setDeadline(date);
            setIsCalendarOpen(false);
          }}
          onClear={() => {
            setDeadline('');
            setIsCalendarOpen(false);
          }}
          onClose={() => setIsCalendarOpen(false)}
        />
      ) : null}

      {error ? (
        <ThemedText type="small" style={styles.errorText}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable
            disabled={isbusy}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.secondaryButton,
              (pressed || isbusy) && styles.pressed,
            ]}>
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          disabled={isbusy}
          onPress={handleSubmit}
          style={({ pressed }) => [styles.primaryButton, (pressed || isbusy) && styles.pressed]}>
          {isbusy ? (
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

const styles = StyleSheet.create({
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
    minHeight: 96,
    textAlignVertical: 'top',
  },
  dateSelectButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    padding: Spacing.three,
  },
  calendarPanel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  calendarTitle: {
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: Spacing.half,
  },
  dayButton: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDayButton: {
    backgroundColor: '#2868d8',
  },
  selectedDayButtonText: {
    color: '#ffffff',
  },
  calendarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
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
  errorText: {
    color: '#d92d20',
  },
  pressed: {
    opacity: 0.72,
  },
});
