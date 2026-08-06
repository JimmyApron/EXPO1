import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  const theme = useTheme();

  return (
    <View accessibilityLabel="콘텐츠를 불러오는 중" style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={[styles.title, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.line, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.shortLine, { backgroundColor: theme.backgroundSelected }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: { gap: 10, borderRadius: Radius.large, padding: Spacing.three, opacity: 0.72 },
  title: { width: '58%', height: 20, borderRadius: Radius.small },
  line: { width: '100%', height: 12, borderRadius: Radius.small },
  shortLine: { width: '38%', height: 12, borderRadius: Radius.small },
});
