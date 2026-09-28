import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sources = [
  ['Anthropic API 학습 정책', 'https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training'],
  ['Anthropic API 보관 정책', 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data'],
  ['DeepSeek API 약관', 'https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html'],
  ['DeepSeek 개인정보처리방침', 'https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html'],
  ['Supabase 함수 로그 안내', 'https://supabase.com/docs/guides/functions/logging'],
];

type ExtractionPrivacyNoticeProps = {
  consented: boolean;
  onConsentChange: (consented: boolean) => void;
};

export function ExtractionPrivacyNotice({ consented, onConsentChange }: ExtractionPrivacyNoticeProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [linkError, setLinkError] = useState('');

  const chooseConsent = (nextConsent: boolean) => {
    onConsentChange(nextConsent);
    setIsOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="전송 전 개인정보 및 AI 처리 안내 열기"
        accessibilityHint="이미지 첨부에 필요한 동의 내용을 확인합니다"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.notice,
          {
            backgroundColor: consented ? theme.successSoft : theme.warningSoft,
            borderColor: consented ? theme.success : theme.warning,
          },
          pressed && styles.pressed,
        ]}>
        <View style={styles.noticeCopy}>
          <ThemedText type="smallBold">전송 전 개인정보 · AI 처리 안내</ThemedText>
          <ThemedText type="small" themeColor={consented ? 'success' : 'textSecondary'}>
            {consented ? '동의 완료 · 눌러서 안내 다시 보기' : '이미지를 첨부하려면 안내를 확인하고 동의해 주세요.'}
          </ThemedText>
        </View>
        <ThemedText type="sectionTitle" style={{ color: consented ? theme.success : theme.warning }}>›</ThemedText>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View
          accessibilityViewIsModal
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <ThemedView
            type="surfaceElevated"
            style={[styles.modalPanel, { borderColor: theme.border }, Shadows.floating]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <View style={styles.modalTitle}>
                <ThemedText type="sectionTitle">전송 전 개인정보 · AI 처리 안내</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  아래 내용을 확인한 뒤 이미지 첨부 여부를 선택해 주세요.
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="안내 닫기"
                onPress={() => setIsOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText type="sectionTitle" themeColor="textSecondary">×</ThemedText>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator>
              <ThemedView type="warningSoft" style={[styles.summary, { borderColor: theme.warning }]}>
                <ThemedText type="smallBold">이미지 첨부 전에 꼭 확인해 주세요</ThemedText>
                <ThemedText type="small">
                  선택한 이미지 내용은 별도 가림 없이 외부 AI 서비스로 전달됩니다. 민감한 개인정보가 없는 이미지인지 먼저 확인해 주세요.
                </ThemedText>
              </ThemedView>

              <View style={styles.section}>
                <ThemedText type="smallBold">처리 방식</ThemedText>
                <ThemedText type="small">이미지는 Claude 비전 모델로 OCR·아이디어 추출을 처리합니다. 텍스트 입력과 수정한 OCR 원문의 재추출은 DeepSeek로 처리합니다.</ThemedText>
                <ThemedText type="small">앱에서 이름이나 프로필 사진을 자동으로 가리지 않습니다. 필요한 경우 휴대폰 사진 편집 기능 등으로 개인정보를 미리 가린 이미지를 선택해 주세요.</ThemedText>
                <ThemedText type="small">이미지를 선택하는 동안에는 AI로 전송하지 않습니다. 추출 버튼을 누르면 선택한 이미지 내용이 AI에 전달됩니다.</ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">저장 및 보관</ThemedText>
                <ThemedText type="small">현재 앱의 캡처 추출 경로는 선택한 이미지를 앱 DB/Storage에 저장하지 않습니다. OCR 원문과 입력 텍스트는 화면에만 남으며 프로젝트에 별도 저장하지 않습니다.</ThemedText>
                <ThemedText type="small">후보 아이디어는 검토 후 저장을 확정할 때 프로젝트 아이디어·마인드맵에 저장됩니다. 후보에 원문 일부가 포함될 수 있으니 저장 전 확인해 주세요.</ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText type="smallBold">외부 서비스 정책</ThemedText>
                <ThemedText type="small">Anthropic API는 공식 정책상 기본적으로 입력·출력을 학습에 사용하지 않으며, 표준 보관 정책은 30일 이내 삭제입니다. 별도 동의·계약, 안전·법적 의무 등 예외가 있어 이 앱에 대한 무보관·학습 제외를 보장하지 않습니다.</ThemedText>
                <ThemedText type="small">DeepSeek API의 이 앱 입력에 대한 학습 제외와 고정 보관 기간은 확인되지 않았습니다. 서비스 정책 기준으로 처리되며, 자세한 내용은 개인정보처리방침과 API 약관에서 확인이 필요합니다.</ThemedText>
                <ThemedText type="small">Supabase 함수 호출·운영 로그에는 요청·응답 정보가 포함될 수 있습니다. 로그와 저장된 프로젝트 데이터의 보관 기간은 서비스 설정·정책에 따르며, 현재 운영 설정의 확인이 필요합니다.</ThemedText>
              </View>

              <View style={styles.sources}>
                <ThemedText type="smallBold">공식 정책 근거</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">공식 정책 확인: 2026-09-07. 계정별 계약·보관 설정은 확인하지 않았습니다. DeepSeek의 일반 개인정보처리방침은 개발자가 만든 앱의 최종 사용자 처리 규칙을 직접 규정하지 않습니다.</ThemedText>
                {sources.map(([label, url]) => (
                  <Pressable
                    key={url}
                    accessibilityRole="link"
                    onPress={() => {
                      setLinkError('');
                      void Linking.openURL(url).catch(() => setLinkError('정책 페이지를 열지 못했습니다. 다시 시도해 주세요.'));
                    }}
                    style={styles.link}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>{label} ↗</ThemedText>
                  </Pressable>
                ))}
                {linkError ? <ThemedText accessibilityRole="alert" type="small" style={{ color: theme.danger }}>{linkError}</ThemedText> : null}
              </View>

              <View style={[styles.consentActions, { borderTopColor: theme.divider }]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => chooseConsent(false)}
                  style={({ pressed }) => [
                    styles.consentButton,
                    { borderColor: theme.border, backgroundColor: theme.background },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold">동의 안 함</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => chooseConsent(true)}
                  style={({ pressed }) => [
                    styles.consentButton,
                    { borderColor: theme.primary, backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={styles.consentButtonText}>동의함</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  notice: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noticeCopy: { flex: 1, gap: Spacing.half },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  modalPanel: { width: '100%', maxWidth: 600, maxHeight: '90%', borderWidth: 1, borderRadius: Radius.xlarge, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, borderBottomWidth: 1, padding: Spacing.three },
  modalTitle: { flex: 1, gap: Spacing.one },
  closeButton: { width: ControlHeight.touch, height: ControlHeight.touch, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flexShrink: 1 },
  modalContent: { gap: Spacing.three, padding: Spacing.three },
  summary: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  section: { gap: Spacing.two },
  sources: { gap: Spacing.one },
  link: { minHeight: ControlHeight.touch, justifyContent: 'center' },
  consentActions: { flexDirection: 'row', gap: Spacing.two, borderTopWidth: 1, paddingTop: Spacing.three },
  consentButton: { flex: 1, minHeight: ControlHeight.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.two },
  consentButtonText: { color: '#ffffff' },
  pressed: { opacity: 0.6 },
});
