import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import type { CandidateIdea } from '@/types/candidate-idea';

// 🎨 디자인 시스템 컬러 팔레트
const PALETTE = {
  primary: '#F59E0B',        // 메인 옐로우/오렌지
  primaryLight: '#FEF3C7',   // 선택된 카드 배경 (연노랑)
  primaryBorder: '#FDE68A',  // 선택된 카드 테두리
  primaryDark: '#D97706',    // 딥 오렌지 (텍스트 및 버튼)
  card: '#FFFFFF',           // 기본 흰색 카드
  cardBorder: '#F3E8D6',     // 연한 크림 테두리
  inputBg: '#FAF7F2',        // 입력 필드 크림색
  inputBorder: '#E2E8F0',    // 인풋 테두리
  text: '#1E293B',           // 짙은 네이비 본문
  textSecondary: '#64748B',  // 보조 텍스트
  tagBg: '#FAF7F2',          // 키워드 태그 배경
  tagBorder: '#EFE6D8',      // 키워드 태그 테두리
  success: '#10B981',        // 저장됨/완료 초록
  successLight: '#ECFDF5',   // 저장됨 배경
  danger: '#EF4444',         // 문제/경고 빨강
  info: '#3B82F6',           // 대상 사용자 파랑
};

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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View
      style={[
        styles.card,
        isSelected && styles.selectedCard,
        isSaved && styles.savedCard,
        Shadows.card,
      ]}>
      {/* 1. 상단 헤더: 선택 체크박스 & ID */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${candidate.title || '제목 없는 아이디어'} 선택`}
          accessibilityState={{ checked: isSelected, disabled: isBusy || isSaved }}
          disabled={isBusy || isSaved}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.checkboxButton,
            (pressed || isBusy || isSaved) && styles.pressed,
          ]}>
          <View
            style={[
              styles.checkbox,
              isSelected && styles.checkedBox,
              isSaved && styles.savedBox,
            ]}>
            {isSelected || isSaved ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
          </View>
          <ThemedText
            style={[
              styles.statusText,
              isSelected && styles.selectedStatusText,
              isSaved && styles.savedStatusText,
            ]}>
            {isSaved ? '저장됨' : isSelected ? '선택됨' : '선택'}
          </ThemedText>
        </Pressable>
        <ThemedText style={styles.idText}>
          {candidate.id}
        </ThemedText>
      </View>

      {/* 2. 기본 노출 영역: 제목 */}
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>제목</ThemedText>
        <TextInput
          accessibilityLabel="후보 아이디어 제목"
          value={candidate.title}
          editable={!isBusy && !isSaved}
          onChangeText={(value) => onChange({ ...candidate, title: value })}
          placeholder="제목을 입력해 주세요."
          placeholderTextColor={PALETTE.textSecondary}
          style={[styles.input, styles.titleInput]}
        />
      </View>

      {/* 3. 기본 노출 영역: 한 줄 요약 */}
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>한 줄 요약</ThemedText>
        <TextInput
          accessibilityLabel="후보 아이디어 요약"
          value={candidate.summary}
          editable={!isBusy && !isSaved}
          multiline
          onChangeText={(value) => onChange({ ...candidate, summary: value })}
          placeholder="핵심 요약을 입력해 주세요."
          placeholderTextColor={PALETTE.textSecondary}
          style={[styles.input, styles.summaryInput]}
        />
      </View>

      {/* 4. 기본 노출 영역: 키워드 태그 */}
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>키워드</ThemedText>
        <View style={styles.keywordList}>
          {candidate.keywords && candidate.keywords.length > 0 ? (
            candidate.keywords.map((kw, idx) => (
              <View key={idx} style={styles.keywordBadge}>
                <ThemedText style={styles.keywordText}>
                  #{kw.trim()}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={styles.emptyKeywordText}>
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
          isExpanded && styles.activeToggleButton,
          pressed && styles.pressed,
        ]}>
        <ThemedText style={styles.toggleButtonText}>
          {isExpanded ? '상세 내용 접기 ▲' : '자세한 내용 보기 (문제/대상/해결) ▼'}
        </ThemedText>
      </Pressable>

      {/* 6. 아코디언 상세 영역 (눌렀을 때만 노출) */}
      {isExpanded ? (
        <View style={styles.detailSection}>
          {/* 가지 1: 문제 */}
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: PALETTE.danger }]}>
              🚨 해결할 문제
            </ThemedText>
            <TextInput
              value={candidate.problem}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, problem: value })}
              placeholder="해결하려는 문제를 입력하세요."
              placeholderTextColor={PALETTE.textSecondary}
              style={[styles.input, styles.multiline]}
            />
          </View>

          {/* 가지 2: 대상 사용자 */}
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: PALETTE.info }]}>
              👥 대상 사용자
            </ThemedText>
            <TextInput
              value={candidate.targetUsers?.join('\n') ?? ''}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) =>
                onChange({ ...candidate, targetUsers: value.split('\n').slice(0, 12) })
              }
              placeholder="대상 사용자를 한 줄에 하나씩 입력하세요."
              placeholderTextColor={PALETTE.textSecondary}
              style={[styles.input, styles.arrayInput]}
            />
          </View>

          {/* 가지 3: 해결 방법 */}
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: PALETTE.success }]}>
              💡 해결 방법
            </ThemedText>
            <TextInput
              value={candidate.solution}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) => onChange({ ...candidate, solution: value })}
              placeholder="어떻게 해결할 것인지 입력하세요."
              placeholderTextColor={PALETTE.textSecondary}
              style={[styles.input, styles.multiline]}
            />
          </View>

          {/* 추가: 핵심 기능 */}
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>✨ 핵심 기능</ThemedText>
            <TextInput
              value={candidate.coreFeatures?.join('\n') ?? ''}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) =>
                onChange({ ...candidate, coreFeatures: value.split('\n').slice(0, 12) })
              }
              placeholder="핵심 기능을 한 줄에 하나씩 입력하세요."
              placeholderTextColor={PALETTE.textSecondary}
              style={[styles.input, styles.arrayInput]}
            />
          </View>

          {/* 추가: 키워드 직접 편집 */}
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>🏷️ 키워드 직접 편집</ThemedText>
            <TextInput
              value={candidate.keywords?.join('\n') ?? ''}
              editable={!isBusy && !isSaved}
              multiline
              onChangeText={(value) =>
                onChange({ ...candidate, keywords: value.split('\n').slice(0, 12) })
              }
              placeholder="키워드를 한 줄에 하나씩 입력하세요."
              placeholderTextColor={PALETTE.textSecondary}
              style={[styles.input, styles.arrayInput]}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.card,
    borderColor: PALETTE.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.large,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  selectedCard: {
    backgroundColor: PALETTE.primaryLight,
    borderColor: PALETTE.primaryBorder,
  },
  savedCard: {
    borderColor: PALETTE.success,
    backgroundColor: PALETTE.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkboxButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkedBox: {
    borderColor: PALETTE.primary,
    backgroundColor: PALETTE.primary,
  },
  savedBox: {
    borderColor: PALETTE.success,
    backgroundColor: PALETTE.success,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.textSecondary,
  },
  selectedStatusText: {
    color: PALETTE.primaryDark,
  },
  savedStatusText: {
    color: PALETTE.success,
  },
  idText: {
    fontSize: 12,
    color: PALETTE.textSecondary,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.text,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: PALETTE.inputBorder,
    backgroundColor: PALETTE.inputBg,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    color: PALETTE.text,
  },
  titleInput: {
    fontWeight: '700',
    fontSize: 15,
  },
  summaryInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  multiline: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  arrayInput: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  keywordList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  keywordBadge: {
    backgroundColor: PALETTE.tagBg,
    borderColor: PALETTE.tagBorder,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
  },
  keywordText: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  emptyKeywordText: {
    fontSize: 12,
    color: PALETTE.textSecondary,
  },
  toggleButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    backgroundColor: PALETTE.tagBg,
    borderRadius: Radius.medium,
    marginVertical: 2,
  },
  activeToggleButton: {
    backgroundColor: PALETTE.primaryLight,
    borderColor: PALETTE.primaryBorder,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.primaryDark,
  },
  detailSection: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: PALETTE.cardBorder,
  },
  pressed: {
    opacity: 0.7,
  },
});
