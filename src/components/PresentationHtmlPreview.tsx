import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export default function PresentationHtmlPreview({ html }: { html: string }) {
  const theme = useTheme();
  return <View style={[styles.fallback, { borderColor: theme.border }]}><ThemedText type="small" themeColor="textSecondary">HTML 파일은 다운로드해 브라우저에서 열 수 있습니다. 저장된 슬라이드 데이터를 그대로 사용합니다.</ThemedText><ThemedText type="caption" themeColor="textSecondary">HTML 크기: {Math.round(html.length / 1024)} KB</ThemedText></View>;
}

const styles = StyleSheet.create({ fallback: { minHeight: 72, gap: 6, justifyContent: 'center', borderWidth: 1, borderRadius: 12, padding: 12 } });
