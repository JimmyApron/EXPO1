import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { registerWattConsentPresenter } from '@/lib/invoke-watt-ai';

export function WattDailyConsentModal() {
  const theme = useTheme();
  const [units, setUnits] = useState<number | null>(null);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);

  useEffect(() => {
    const unregister = registerWattConsentPresenter(cost => new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setUnits(cost);
    }));
    return () => {
      unregister();
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  const choose = (accepted: boolean) => {
    setUnits(null);
    resolveRef.current?.(accepted);
    resolveRef.current = null;
  };

  return <Modal visible={units !== null} transparent animationType="fade" onRequestClose={() => choose(false)}>
    <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
      <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <ThemedText type="sectionTitle">오늘 무료 AI 사용량을 다 썼어요</ThemedText>
        <ThemedText type="body">이번 작업을 계속하면 AI {units}단위가 차감돼요.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">사용하면 오늘 자정까지 다시 묻지 않고, 텍스트 AI 작업마다 필요한 단위를 차감해요.{ '\n' }취소하면 AI 작업이 일시 중지돼요. 요금제에서 자동 차감을 켜면 다시 사용할 수 있어요.</ThemedText>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => choose(false)} style={[styles.button, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">취소</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => choose(true)} style={[styles.button, { backgroundColor: theme.primary, borderColor: theme.primary }]}>
            <ThemedText type="smallBold">사용</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
});
