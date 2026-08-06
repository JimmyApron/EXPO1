import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthScreen } from '@/components/auth-screen';
import { BrandIcon } from '@/components/brand-icon';
import { NotificationToastProvider } from '@/components/notification/notification-toast-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { AppProvider } from '@/context/AppContext';

function AuthGate() {
  const { user, isauthloading } = useAuth();

  if (isauthloading) {
    return (
      <ThemedView style={styles.loading}>
        <BrandIcon size={72} />
        <ActivityIndicator />
        <ThemedText type="subtitle">Watt</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">워크스페이스를 불러오는 중입니다.</ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <NotificationToastProvider>
              <AnimatedSplashOverlay />
              <AuthGate />
            </NotificationToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
