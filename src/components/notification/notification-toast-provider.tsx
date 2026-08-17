import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppNotification } from '@/types/notification';

type NotificationToastValue = {
  showNotificationToast: (notification: AppNotification) => void;
};

const NotificationToastContext = createContext<NotificationToastValue | null>(null);

export function NotificationToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const current = queue[0];

  const dismissCurrent = useCallback(() => {
    setQueue((items) => items.slice(1));
  }, []);

  const showNotificationToast = useCallback((notification: AppNotification) => {
    setQueue((items) => {
      if (items.some((item) => item.id === notification.id)) {
        return items;
      }

      return [...items, notification];
    });
  }, []);

  useEffect(() => {
    if (!current) {
      return;
    }

    const timeout = globalThis.setTimeout(dismissCurrent, 3200);
    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [current, dismissCurrent]);

  const value = useMemo(() => ({ showNotificationToast }), [showNotificationToast]);

  return (
    <NotificationToastContext.Provider value={value}>
      {children}
      {current ? (
        <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
          <View pointerEvents="box-none" style={styles.container}>
            <Pressable
              accessibilityRole="button"
              onPress={dismissCurrent}
              style={({ pressed }) => [
                styles.toast,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
                pressed && styles.pressed,
              ]}>
              <View style={styles.indicator} />
              <View style={styles.copy}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {current.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {current.message}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </NotificationToastContext.Provider>
  );
}

export function useNotificationToasts() {
  const context = useContext(NotificationToastContext);

  if (!context) {
    return {
      showNotificationToast: () => undefined,
    };
  }

  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 20,
  },
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  indicator: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: '#2563eb',
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.84,
  },
});
