import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sources = [
  ['Anthropic API 학습 정책', 'https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training'],
  ['Anthropic API 보관 정책', 'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data'],
  ['DeepSeek API 약관', 'https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html'],
  ['DeepSeek 개인정보처리방침', 'https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html'],
  ['Supabase 함수 로그 안내', 'https://supabase.com/docs/guides/functions/logging'],
];

export function ExtractionPrivacyNotice() {
  const theme = useTheme();
  const [details, setDetails] = useState(false);
  const [linkError, setLinkError] = useState('');
  return (
    <ThemedView type="warningSoft" style={[styles.notice, { borderColor: theme.warning }]}>
      <ThemedText type="smallBold">전송 전 개인정보 · AI 처리 안내</ThemedText>
      <ThemedText type="small">이미지는 Claude 비전 모델로 OCR·아이디어 추출을 처리합니다. 텍스트 입력과 수정한 OCR 원문의 재추출은 DeepSeek로 처리합니다.</ThemedText>
      <ThemedText type="small">이미지를 선택하거나 가리는 동안에는 AI로 전송하지 않습니다. 전송본을 확인한 뒤 추출 버튼을 누르면 AI에 전달됩니다.</ThemedText>
      <ThemedText type="small">현재 앱의 캡처 추출 경로는 원본·가림 이미지를 앱 DB/Storage에 저장하지 않습니다. OCR 원문과 입력 텍스트는 화면에만 남으며 프로젝트에 별도 저장하지 않습니다. 후보 아이디어는 검토 후 저장을 확정할 때 프로젝트 아이디어·마인드맵에 저장됩니다. 후보에 원문 일부가 포함될 수 있으니 저장 전 확인해 주세요.</ThemedText>
      <ThemedText type="small">Anthropic API는 공식 정책상 기본적으로 입력·출력을 학습에 사용하지 않으며, 표준 보관 정책은 30일 이내 삭제입니다. 별도 동의·계약, 안전·법적 의무 등 예외가 있어 이 앱에 대한 무보관·학습 제외를 보장하지 않습니다.</ThemedText>
      <ThemedText type="small">DeepSeek API의 이 앱 입력에 대한 학습 제외와 고정 보관 기간은 확인되지 않았습니다. 서비스 정책 기준으로 처리되며, 자세한 내용은 개인정보처리방침과 API 약관에서 확인이 필요합니다.</ThemedText>
      <ThemedText type="small">Supabase 함수 호출·운영 로그에는 요청·응답 정보가 포함될 수 있습니다. 로그와 저장된 프로젝트 데이터의 보관 기간은 서비스 설정·정책에 따르며, 현재 운영 설정의 확인이 필요합니다.</ThemedText>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={styles.link}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>{details ? '정책 근거 접기' : '공식 정책 근거 보기'}</ThemedText>
      </Pressable>
      {details ? <View style={styles.sources}>
        <ThemedText type="small">공식 정책 확인: 2026-09-07. 계정별 계약·보관 설정은 확인하지 않았습니다. DeepSeek의 일반 개인정보처리방침은 개발자가 만든 앱의 최종 사용자 처리 규칙을 직접 규정하지 않습니다.</ThemedText>
        {sources.map(([label, url]) => (
          <Pressable key={url} accessibilityRole="link" onPress={() => { setLinkError(''); void Linking.openURL(url).catch(() => setLinkError('정책 페이지를 열지 못했습니다. 다시 시도해 주세요.')); }} style={styles.link}>
            <ThemedText type="small" style={{ color: theme.primary }}>{label} ↗</ThemedText>
          </Pressable>
        ))}
        {linkError ? <ThemedText accessibilityRole="alert" type="small">{linkError}</ThemedText> : null}
      </View> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  notice: { gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  sources: { gap: Spacing.one }, link: { minHeight: 44, justifyContent: 'center' },
});
