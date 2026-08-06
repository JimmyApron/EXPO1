import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdea } from '@/types/candidate-idea';

type CandidateIdeaCardProps = {
  candidate: CandidateIdea;
  isSelected: boolean;
  isSaved: boolean;
  isBusy: boolean;
  onToggle: () => void;
  onChange: (candidate: CandidateIdea) => void;
};

type TextField = 'title' | 'summary' | 'problem' | 'solution';
type ArrayField = 'targetUsers' | 'keywords' | 'coreFeatures';

const textFields: { key: TextField; label: string; multiline?: boolean }[] = [
  { key: 'title', label: '제목' },
  { key: 'summary', label: '요약', multiline: true },
  { key: 'problem', label: '문제', multiline: true },
  { key: 'solution', label: '해결 방법', multiline: true },
];

const arrayFields: { key: ArrayField; label: string; placeholder: string }[] = [
  { key: 'targetUsers', label: '대상 사용자', placeholder: '한 줄에 한 항목씩 입력' },
  { key: 'coreFeatures', label: '핵심 기능', placeholder: '한 줄에 한 항목씩 입력' },
  { key: 'keywords', label: '키워드', placeholder: '한 줄에 한 항목씩 입력' },
];

export function CandidateIdeaCard({
  candidate,
  isSelected,
  isSaved,
  isBusy,
  onToggle,
  onChange,
}: CandidateIdeaCardProps) {
  const theme = useTheme();
  const inputStyle = {
    color: theme.text,
    borderColor: theme.backgroundSelected,
    backgroundColor: theme.background,
  };

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        { borderColor: theme.border },
        isSelected && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
        isSaved && { borderColor: theme.success },
      ]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${candidate.title || '제목 없는 아이디어'} 선택`}
          accessibilityState={{ checked: isSelected, disabled: isBusy || isSaved }}
          disabled={isBusy || isSaved}
          onPress={onToggle}
          style={({ pressed }) => [styles.checkboxButton, (pressed || isBusy || isSaved) && styles.pressed]}>
          <View
            style={[
              styles.checkbox,
              { borderColor: theme.textTertiary },
              isSelected && { borderColor: theme.primary, backgroundColor: theme.primary },
            ]}>
            {isSelected ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
          </View>
          <ThemedText type="smallBold">{isSaved ? '저장됨' : isSelected ? '선택됨' : '선택'}</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {candidate.id}
        </ThemedText>
      </View>

      {textFields.map((field) => (
        <View key={field.key} style={styles.field}>
          <ThemedText type="smallBold">{field.label}</ThemedText>
          <TextInput
            accessibilityLabel={`후보 아이디어 ${field.label}`}
            value={candidate[field.key]}
            editable={!isBusy && !isSaved}
            multiline={field.multiline}
            onChangeText={(value) => onChange({ ...candidate, [field.key]: value })}
            placeholder={`${field.label}을 입력해 주세요.`}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, field.multiline && styles.multiline, inputStyle]}
          />
        </View>
      ))}

      {arrayFields.map((field) => (
        <View key={field.key} style={styles.field}>
          <ThemedText type="smallBold">{field.label}</ThemedText>
          <TextInput
            accessibilityLabel={`후보 아이디어 ${field.label}`}
            value={candidate[field.key].join('\n')}
            editable={!isBusy && !isSaved}
            multiline
            onChangeText={(value) => onChange({ ...candidate, [field.key]: value.split('\n').slice(0, 12) })}
            placeholder={field.placeholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.arrayInput, inputStyle]}
          />
        </View>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  checkboxButton: { minHeight: ControlHeight.touch, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#ffffff', lineHeight: 20 },
  field: { gap: Spacing.one },
  input: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  arrayInput: { minHeight: 92, textAlignVertical: 'top' },
  pressed: { opacity: 0.6 },
});
