import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RoomPanel } from '@/components/room-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function RoomsScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="screenTitle">방</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">팀원을 초대하고 함께 과제와 아이디어를 관리하세요.</ThemedText>
          </View>
          <RoomPanel />
        </ThemedView>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: 'center', paddingBottom: Spacing.five },
  safeArea: { width: '100%', alignItems: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, gap: Spacing.four },
  header: { gap: Spacing.one, paddingTop: Spacing.two },
});
