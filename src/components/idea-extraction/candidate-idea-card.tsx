import { useState } from 'react';
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

export function CandidateIdeaCard({
  candidate,
  isSelected,
  isSaved,
  isBusy,
  onToggle,
  onChange,
}: CandidateIdeaCardProps) {
  const theme = useTheme();
  // 기본적으로 상세 내용은 접어두고 (false), 눌렀을 때만 열리도록 상태 관리
  const [isExpanded, setIsExpanded] = useState(false);

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
      {/* 1. 상단 헤더: 선택 체크박스 & ID */}
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

      {/* 2. 기본 노출 영역: 제목 */}
      <View style={styles.field}>
        <ThemedText type="smallBold">제목</ThemedText>
        <TextInput
          accessibilityLabel="후보 아이디어 제목"
          value={candidate.title}
          editable={!isBusy && !isSaved}
          onChangeText={(value) => onChange({ ...candidate, title: value })}
          placeholder="제목을 입력해 주세요."
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, inputStyle, { fontWeight: 'bold' }]}
        />
      </View>

      {/* 3. 기본 노출 영역: 한 줄 요약 */}
      <View style={styles.field}>
        <ThemedText type="smallBold">한 줄 요약</ThemedText>
        <TextInput
          accessibilityLabel="후보 아이디어 요약"
          value={candidate.summary}
          editable={!isBusy && !isSaved}
          multiline
          onChangeText={(value) => onChange({ ...candidate, summary: value })}
          placeholder="핵심 요약을 입력해 주세요."
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, styles.summaryInput, inputStyle]}
        />
      </View>

      {/* 4. 기본 노출 영역: 키워드 태그 */}
      <View style={styles.field}>
        <ThemedText type="smallBold">키워드</ThemedText>
        <View style={styles.keywordList}>
          {candidate.keywords && candidate.keywords.length > 0 ? (
            candidate.keywords.map((kw, idx) => (
              <View key={idx} style={[styles.keywordBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  #{kw.trim()}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              (등록된 키워드 없음)
            </ThemedText>
          )}
        </View>
      </View>

      {/* 5. 상세 내용 열기/접기 토글 버튼 */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsExpanded((prev) => !prev)}
        style={({ pressed }) => [
          styles.toggleButton,
          { borderColor: theme.border, backgroundColor: theme.background },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          {isExpanded ? '상세 내용 접기 ▲' : '자세한 내용 보기 (문제/대상/해결) ▼'}
        </ThemedText>
      </Pressable>

      {/* 6. 아코디언 상세 영역 (눌렀을 때만 노출) */}
      {isExpanded ? (
        <View style={[styles.detailSection, { borderTopColor: theme.border }]}>
          {/* 가지 1: 문제 */}
          <View style={styles.field}>
            <ThemedText type="smallBold" style={{ color: '#dc2626' }}>
              🚨 해결할 문제
            </ThemedText>
            <TextInput
              value={candidate.problem}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, problem: value })}
              placeholder="해결하려는 문제를 입력하세요."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.multiline, inputStyle]}
            />
          </View>

          {/* 가지 2: 대상 사용자 */}
          <View style={styles.field}>
            <ThemedText type="smallBold" style={{ color: '#2563eb' }}>
              👥 대상 사용자
            </ThemedText>
            <TextInput
              value={candidate.targetUsers?.join('\n') ?? ''}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, targetUsers: value.split('\n').slice(0, 12) })}
              placeholder="대상 사용자를 한 줄에 하나씩 입력하세요."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.arrayInput, inputStyle]}
            />
          </View>

          {/* 가지 3: 해결 방법 */}
          <View style={styles.field}>
            <ThemedText type="smallBold" style={{ color: '#16a34a' }}>
              💡 해결 방법
            </ThemedText>
            <TextInput
              value={candidate.solution}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, solution: value })}
              placeholder="어떻게 해결할 것인지 입력하세요."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.multiline, inputStyle]}
            />
          </View>

          {/* 추가: 핵심 기능 (키워드 수정 포함) */}
          <View style={styles.field}>
            <ThemedText type="smallBold">✨ 핵심 기능</ThemedText>
            <TextInput
              value={candidate.coreFeatures?.join('\n') ?? ''}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, coreFeatures: value.split('\n').slice(0, 12) })}
              placeholder="핵심 기능을 한 줄에 하나씩 입력하세요."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.arrayInput, inputStyle]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="smallBold">🏷️ 키워드 직접 편집</ThemedText>
            <TextInput
              value={candidate.keywords?.join('\n') ?? ''}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, keywords: value.split('\n').slice(0, 12) })}
              placeholder="키워드를 한 줄에 하나씩 입력하세요."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.arrayInput, inputStyle]}
            />
          </View>
        </View>
      ) : null}
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
  input: { minHeight: ControlHeight.touch, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 15 },
  summaryInput: { minHeight: 60, textAlignVertical: 'top' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  arrayInput: { minHeight: 72, textAlignVertical: 'top' },
  keywordList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: 2 },
  keywordBadge: { borderWidth: 1, borderRadius: Radius.small, paddingHorizontal: Spacing.two, paddingVertical: 4 },
  toggleButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    marginVertical: Spacing.one,
  },
  detailSection: { gap: Spacing.three, paddingTop: Spacing.three, borderTopWidth: 1 },
  pressed: { opacity: 0.6 },
});