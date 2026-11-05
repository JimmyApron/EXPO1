import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useMemo } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, View, type TextInputProps } from 'react-native';
import { ScaledTextInput as TextInput } from '@/components/scaled-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ControlHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Confirmation = { message: string; onConfirm: () => void };
type ConfirmAction = (message: string, onConfirm: () => void) => void;
const WorkspaceConfirmContext = createContext<ConfirmAction>(() => {});

export function WorkspaceConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const theme = useTheme();
  const cancel = () => setConfirmation(null);
  const confirm = () => {
    const action = confirmation?.onConfirm;
    setConfirmation(null);
    action?.();
  };

  return <WorkspaceConfirmContext.Provider value={(message, onConfirm) => setConfirmation({ message, onConfirm })}>
    {children}
    <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={cancel}>
      <View accessibilityViewIsModal style={[styles.confirmOverlay, { backgroundColor: theme.overlay }]}>
        <ThemedView type="surfaceElevated" style={[styles.confirmPanel, { borderColor: theme.border }, Shadows.floating]}>
          <ThemedText type="cardTitle">내용 변경 확인</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{confirmation?.message}</ThemedText>
          <View style={styles.confirmActions}>
            <WorkspaceButton onPress={cancel}>취소</WorkspaceButton>
            <Pressable accessibilityRole="button" onPress={confirm} style={[styles.confirmButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.primaryText }}>확인</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  </WorkspaceConfirmContext.Provider>;
}

export function useWorkspaceConfirm() {
  return useContext(WorkspaceConfirmContext);
}
export const workspaceStyles = StyleSheet.create({
  panel: { gap: 16, padding: 18, borderWidth: 1, borderRadius: 14 },
  group: { gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  item: { gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EFE6D8' },
  editor: { minHeight: 260, textAlignVertical: 'top', fontSize: 16, lineHeight: 26 },
});
export function WorkspaceButton({ children, onPress, disabled = false, selected = false, danger = false }: { children: string; onPress: () => void; disabled?: boolean; selected?: boolean; danger?: boolean }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={children} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primarySoft : t.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
    <ThemedText type="smallBold" style={{ color: danger ? t.danger : t.text }}>{children}</ThemedText>
  </Pressable>;
}
export function WorkspaceField({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return <View style={{ gap: 6 }}>{label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
    <TextInput accessibilityLabel={label} placeholderTextColor={t.textSecondary} multiline {...props}
      style={[{ minHeight: props.multiline === false ? 44 : 72, borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, color: t.text, backgroundColor: t.background, textAlignVertical: 'top' }, props.style]} />
  </View>;
}
const MIN_SUGGESTION_HEIGHT = 140;
const MAX_SUGGESTION_HEIGHT = 720;
const RESIZE_STEP = 32;

function WorkspaceFieldResizeHandle({ edge, height, onHeightChange }: { edge: 'top' | 'bottom'; height: number; onHeightChange: Dispatch<SetStateAction<number>> }) {
  const [heightAtStart, setHeightAtStart] = useState(height);
  const theme = useTheme();
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => setHeightAtStart(height),
    onPanResponderMove: (_, gesture) => {
      const direction = edge === 'bottom' ? 1 : -1;
      onHeightChange(Math.max(MIN_SUGGESTION_HEIGHT, Math.min(MAX_SUGGESTION_HEIGHT, heightAtStart + direction * gesture.dy)));
    },
  }), [edge, height, heightAtStart, onHeightChange]);
  return <View
    {...pan.panHandlers}
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel={`${edge === 'top' ? '위쪽' : '아래쪽'} 크기 조절 손잡이`}
    accessibilityHint="위아래로 끌어 제안 입력창 높이를 조절합니다. 접근성 동작으로도 높이를 바꿀 수 있습니다."
    accessibilityActions={[{ name: 'increment', label: '높이 늘리기' }, { name: 'decrement', label: '높이 줄이기' }]}
    onAccessibilityAction={event => {
      const amount = event.nativeEvent.actionName === 'increment' ? RESIZE_STEP : -RESIZE_STEP;
      onHeightChange(Math.max(MIN_SUGGESTION_HEIGHT, Math.min(MAX_SUGGESTION_HEIGHT, height + amount)));
    }}
    style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}
  >
    <View style={{ width: 64, height: 7, borderRadius: 4, backgroundColor: theme.primary }} />
  </View>;
}

export function WorkspaceResizableField({ label, initialHeight = 280, ...props }: TextInputProps & { label: string; initialHeight?: number }) {
  const [height, setHeight] = useState(initialHeight);
  return <View style={{ gap: 6 }}>
    {label ? <ThemedText type="smallBold">{label}</ThemedText> : null}
    <ThemedText type="caption" themeColor="textSecondary">↕ 위·아래 주황색 손잡이를 끌어 크기를 조절하세요 · 현재 {height}px</ThemedText>
    <WorkspaceFieldResizeHandle edge="top" height={height} onHeightChange={setHeight} />
    <WorkspaceField label="" {...props} style={[props.style, { height, textAlignVertical: 'top' }]} />
    <WorkspaceFieldResizeHandle edge="bottom" height={height} onHeightChange={setHeight} />
  </View>;
}
export function WorkspacePanel({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return <View style={[workspaceStyles.panel, { backgroundColor: t.surface, borderColor: t.border }]}><ThemedText type="sectionTitle">{title}</ThemedText>{children}</View>;
}

const styles = StyleSheet.create({
  confirmOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  confirmPanel: { width: '100%', maxWidth: 460, gap: Spacing.three, padding: Spacing.four, borderWidth: 1, borderRadius: Radius.large },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  confirmButton: { minHeight: ControlHeight.touch, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.medium },
});
