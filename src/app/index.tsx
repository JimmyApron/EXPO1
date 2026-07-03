import * as Device from 'expo-device';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// 보관함(Context) 불러오기
import { useApp } from '../context/AppContext';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  // 보관함 데이터 꺼내기
  const { categoryfilter, setCategoryfilter, favoriteids, togglefavorite } = useApp();

  // 테스트용 임시 아이디어 ID 배열
  const sampleideas = [101, 102, 103];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        {/* 1. 카테고리 필터 영역 */}
        <ThemedText type="small" style={{ fontWeight: 'bold' }}>[ CATEGORY FILTER ]</ThemedText>
        <ThemedView style={styles.tabContainer}>
          {['all', 'design', 'develop'].map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategoryfilter(cat)}
              style={[
                styles.tabButton,
                categoryfilter === cat && styles.activeTabButton
              ]}
            >
              <ThemedText style={categoryfilter === cat ? styles.activeTabText : styles.tabText}>
                {cat.toUpperCase()}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        {/* 2. 즐겨찾기 테스트 영역 */}
        <ThemedText type="small" style={{ fontWeight: 'bold', marginTop: Spacing.two }}>[ IDEA CARD FAVORITES ]</ThemedText>
        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          {sampleideas.map((ideaid) => {
            const isfavorite = favoriteids?.includes(ideaid);
            return (
              <HintRow
                key={ideaid}
                title={`Idea ID: ${ideaid}`}
                hint={
                  <Pressable onPress={() => togglefavorite(ideaid)} style={styles.favoriteButton}>
                    <ThemedText style={{ color: isfavorite ? '#ff4757' : '#ced6e0', fontWeight: 'bold' }}>
                      {isfavorite ? '❤️' : '🖤'}
                    </ThemedText>
                  </Pressable>
                }
              />
            );
          })}
        </ThemedView>

        {/* 3. 기본 안내 영역 */}
        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },

  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  tabButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    backgroundColor: '#f1f2f6',
  },
  activeTabButton: {
    backgroundColor: '#2f3542',
  },
  tabText: {
    color: '#2f3542',
    fontSize: 12,
  },
  activeTabText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  favoriteButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f2f6',
  }
});
